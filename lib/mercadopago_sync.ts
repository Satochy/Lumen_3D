import { Prisma } from '@prisma/client'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { prisma } from '@/lib/prisma'

/**
 * Identifica se um produto/item é Sob Encomenda (não baixa estoque físico pronto)
 * ou Pronta Entrega (baixa estoque físico em stock) usando exclusivamente o campo explícito isMadeToOrder.
 */
function isMadeToOrderProduct(product?: {
  isMadeToOrder?: boolean | null
} | null): boolean {
  return Boolean(product?.isMadeToOrder)
}

/**
 * Confirma de forma atômica e idempotente o pagamento aprovado de um pedido.
 *
 * Regras (Documento-Mestre D02 a D07):
 * - Verifica idempotência em PaymentWebhookLog pelo ID do pagamento (eventId @unique).
 * - Valida que externalReference coincide obrigatoriamente com order.id do banco.
 * - Valida integridade financeira (transaction_amount contra order.totalAmount em Prisma.Decimal).
 * - Atualiza Order.paymentStatus para 'PAID'.
 * - Para itens de Pronta Entrega, efetua a baixa atômica condicional de stock (produto ou variante).
 * - Para itens Sob Encomenda, não altera o estoque (vai para a fila de produção no Admin).
 */
export async function confirmApprovedPaymentInDb(params: {
  orderId: string
  paymentId: string
  externalReference: string
  transactionAmount: number | string | Prisma.Decimal | null | undefined
  currencyId?: string | null
}): Promise<{ confirmed: boolean; alreadyProcessed: boolean }> {
  const {
    orderId,
    paymentId,
    externalReference,
    transactionAmount,
    currencyId = 'BRL',
  } = params
  const cleanPaymentId = String(paymentId).trim()
  const cleanExternalRef = String(externalReference || '').trim()

  return prisma.$transaction(async (tx) => {
    // 1. Idempotência: verificar se o pagamento já foi processado no PaymentWebhookLog
    const existingLog = await tx.paymentWebhookLog.findFirst({
      where: {
        OR: [
          { eventId: cleanPaymentId },
          { eventId: `mp-approved-${cleanPaymentId}` },
        ],
      },
    })

    if (existingLog) {
      return { confirmed: false, alreadyProcessed: true }
    }

    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    })

    if (!order) {
      throw new Error(`Pedido "${orderId}" não encontrado no banco de dados.`)
    }

    // 2. Validação obrigatória de external_reference contra order.id do banco
    if (!cleanExternalRef || cleanExternalRef !== order.id) {
      console.error(
        `[SEGURANÇA FINANCEIRA] external_reference divergente para o pagamento ${cleanPaymentId}: esperado "${order.id}", recebido "${cleanExternalRef}".`
      )
      throw new Error(
        'O external_reference do pagamento não coincide com o ID do pedido no banco.'
      )
    }

    // 3. Validação obrigatória de moeda (BRL) e do valor pago (transaction_amount) contra order.totalAmount
    if (currencyId !== 'BRL') {
      console.error(
        `[SEGURANÇA FINANCEIRA] Moeda inválida no pagamento ${cleanPaymentId} do pedido ${order.id}: esperado "BRL", recebido "${String(currencyId)}".`
      )
      throw new Error(
        `Moeda do pagamento inválida (${String(currencyId)}). Apenas BRL é aceito.`
      )
    }

    if (transactionAmount === undefined || transactionAmount === null) {
      throw new Error(
        `Valor do pagamento (transaction_amount) ausente para o pedido "${order.id}".`
      )
    }

    const paidDecimal =
      transactionAmount instanceof Prisma.Decimal
        ? transactionAmount
        : new Prisma.Decimal(Number(transactionAmount).toFixed(2))

    if (!paidDecimal.isFinite() || !paidDecimal.equals(order.totalAmount)) {
      console.error(
        `[SEGURANÇA FINANCEIRA] Divergência de transaction_amount no pedido ${order.id}: esperado ${order.totalAmount.toFixed(2)}, recebido ${paidDecimal.toFixed(2)}.`
      )
      throw new Error(
        `Valor pago (${paidDecimal.toFixed(2)}) diverge do total do pedido (${order.totalAmount.toFixed(2)}).`
      )
    }

    const hasMadeToOrderItem = order.items.some((item) =>
      Boolean(item.isMadeToOrder || isMadeToOrderProduct(item.product))
    )

    // 4. Atualizar Order para PAID de forma atômica condicional (proteção contra Race Condition e transição inválida)
    // Exige paymentStatus === 'PENDING' e logisticsStatus !== 'CANCELLED'.
    // Regra D06/D07: Pedido somente de Pronta Entrega vai para READY_FOR_SHIPPING;
    // pedido com item Sob Encomenda permanece na fila de produção (PREPARING).
    const result = await tx.order.updateMany({
      where: {
        id: order.id,
        paymentStatus: 'PENDING',
        logisticsStatus: { not: 'CANCELLED' },
      },
      data: {
        paymentStatus: 'PAID',
        ...(!hasMadeToOrderItem && order.logisticsStatus === 'PREPARING'
          ? { logisticsStatus: 'READY_FOR_SHIPPING' }
          : {}),
      },
    })

    if (result.count === 0) {
      return { confirmed: false, alreadyProcessed: true }
    }

    // 5. Registrar evento no PaymentWebhookLog
    await tx.paymentWebhookLog.upsert({
      where: { eventId: cleanPaymentId },
      update: { status: 'approved' },
      create: {
        eventId: cleanPaymentId,
        status: 'approved',
      },
    })

    // 6. Iterar sobre os OrderItems: baixar estoque apenas de Pronta Entrega
    for (const item of order.items) {
      const isItemMadeToOrder = Boolean(
        item.isMadeToOrder || isMadeToOrderProduct(item.product)
      )

      if (isItemMadeToOrder || !item.productId || !item.product) {
        // Produto Sob Encomenda ou item personalizado: não mexe no estoque físico; segue para fila de produção no Admin
        continue
      }

      if (item.variantId) {
        if (!item.variant || item.variant.stock < item.quantity) {
          throw new Error(
            `Estoque insuficiente para a variante "${item.variantId}" do item "${item.productTitle}" (disponível: ${item.variant?.stock ?? 0}, solicitado: ${item.quantity}).`
          )
        }

        const updatedVariant = await tx.variant.updateMany({
          where: {
            id: item.variantId,
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
          },
        })
        if (updatedVariant.count === 0) {
          throw new Error(
            `Estoque insuficiente para baixa da variante "${item.variantId}" do item "${item.productTitle}".`
          )
        }
      } else {
        if (item.product.stock < item.quantity) {
          throw new Error(
            `Estoque insuficiente para o item "${item.productTitle}" (disponível: ${item.product.stock}, solicitado: ${item.quantity}).`
          )
        }

        const updatedProduct = await tx.product.updateMany({
          where: {
            id: item.productId,
            archivedAt: null,
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
          },
        })
        if (updatedProduct.count === 0) {
          throw new Error(
            `Estoque insuficiente para baixa do item "${item.productTitle}".`
          )
        }
      }
    }

    return { confirmed: true, alreadyProcessed: false }
  })
}

/**
 * Consulta a API oficial do Mercado Pago por paymentId ou por external_reference (orderId)
 * e reconcilia o status do pedido no banco caso o pagamento esteja approved.
 */
export async function syncOrderWithMercadoPago(
  orderId: string,
  paymentId?: string | null
): Promise<{ isPaid: boolean; status: string }> {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) {
    return { isPaid: false, status: 'pending' }
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, totalAmount: true, paymentStatus: true },
    })

    if (!order) {
      return { isPaid: false, status: 'pending' }
    }

    if (order.paymentStatus === 'PAID') {
      return { isPaid: true, status: 'approved' }
    }

    const mpConfig = new MercadoPagoConfig({
      accessToken,
      options: { timeout: 15000 },
    })
    const paymentClient = new Payment(mpConfig)

    if (paymentId) {
      const mpPayment = await paymentClient.get({ id: String(paymentId) })
      const externalReference = String(mpPayment.external_reference || '').trim()

      if (externalReference !== order.id) {
        console.error(
          `[SEGURANÇA FINANCEIRA] Sync rejeitado: external_reference "${externalReference}" difere de order.id "${order.id}".`
        )
        return { isPaid: false, status: mpPayment.status || 'pending' }
      }

      if (mpPayment.currency_id !== 'BRL') {
        console.error(
          `[SEGURANÇA FINANCEIRA] Sync rejeitado: moeda "${String(mpPayment.currency_id)}" inválida para order.id "${order.id}".`
        )
        return { isPaid: false, status: mpPayment.status || 'pending' }
      }

      if (mpPayment.status === 'approved' && mpPayment.id) {
        await confirmApprovedPaymentInDb({
          orderId: order.id,
          paymentId: String(mpPayment.id),
          externalReference,
          transactionAmount: mpPayment.transaction_amount,
          currencyId: mpPayment.currency_id,
        })
        return { isPaid: true, status: 'approved' }
      }
      return {
        isPaid: false,
        status: mpPayment.status || 'pending',
      }
    }

    const searchResult = await paymentClient.search({
      options: {
        external_reference: order.id,
      },
    })

    const results = searchResult.results || []
    const approvedPayment = results.find(
      (p) =>
        p.status === 'approved' &&
        p.currency_id === 'BRL' &&
        p.id &&
        String(p.external_reference || '').trim() === order.id
    )

    if (approvedPayment && approvedPayment.id) {
      await confirmApprovedPaymentInDb({
        orderId: order.id,
        paymentId: String(approvedPayment.id),
        externalReference: String(approvedPayment.external_reference || '').trim(),
        transactionAmount: approvedPayment.transaction_amount,
        currencyId: approvedPayment.currency_id,
      })
      return { isPaid: true, status: 'approved' }
    }

    const latestStatus = results[0]?.status || 'pending'
    return { isPaid: false, status: latestStatus }
  } catch (error) {
    console.error('Erro ao sincronizar pedido com Mercado Pago:', error)
    return { isPaid: false, status: 'pending' }
  }
}
