import {
  Prisma,
  LogisticsStatus,
  OrderOccurrenceType,
  PaymentAttemptStatus,
  WebhookProcessingStatus,
  StockMovementType,
} from '@prisma/client'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { prisma } from '@/lib/prisma'
import { confirmReservationAtomically } from '@/lib/stock/reservation_service'

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
 * - Trava atômica no banco: `paymentStatus: { not: 'PAID' }`.
 * - Verifica idempotência em PaymentWebhookLog pelo ID do pagamento (eventId @unique).
 * - Valida externalReference contra order.id. Se divergente, registra OrderOccurrence e rejeita.
 * - Valida moeda (BRL) e transaction_amount contra order.totalAmount. Se divergente, registra OrderOccurrence.
 * - Se o pedido já estiver CANCELLED, registra OrderOccurrence (LATE_PAYMENT_AFTER_CANCEL).
 * - Consome a reserva de estoque chamando `confirmReservationAtomically` (decrementa stock e reservedStock).
 * - Atualiza Order para PAID (`paidAt: now`, `externalPaymentId`).
 * - Atualiza PaymentAttempt para APPROVED.
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

    if (existingLog && existingLog.processingStatus === WebhookProcessingStatus.PROCESSED) {
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

    // Se o pedido já está pago, não reprocessa
    if (order.paymentStatus === 'PAID') {
      return { confirmed: false, alreadyProcessed: true }
    }

    // Se o pedido já estava cancelado, registra ocorrência de pagamento tardio
    if (order.logisticsStatus === 'CANCELLED') {
      await tx.orderOccurrence.create({
        data: {
          orderId: order.id,
          externalPaymentId: cleanPaymentId,
          type: OrderOccurrenceType.LATE_PAYMENT_AFTER_CANCEL,
          description: `Pagamento recebido após cancelamento do pedido (Pagamento ID: ${cleanPaymentId}).`,
          metadata: {
            paymentId: cleanPaymentId,
            transactionAmount: String(transactionAmount),
            currencyId,
          },
        },
      })
      await tx.order.update({
        where: { id: order.id },
        data: { hasOpenOccurrence: true },
      })
      throw new Error('Pagamento rejeitado: pedido cancelado anteriormente.')
    }

    // 2. Validação obrigatória de external_reference contra order.id do banco
    if (!cleanExternalRef || cleanExternalRef !== order.id) {
      await tx.orderOccurrence.create({
        data: {
          orderId: order.id,
          externalPaymentId: cleanPaymentId,
          type: OrderOccurrenceType.COLLECTOR_OR_ENV_MISMATCH,
          description: `external_reference divergente: esperado "${order.id}", recebido "${cleanExternalRef}".`,
          metadata: {
            paymentId: cleanPaymentId,
            expected: order.id,
            received: cleanExternalRef,
          },
        },
      })
      await tx.order.update({
        where: { id: order.id },
        data: { hasOpenOccurrence: true },
      })
      throw new Error(
        'O external_reference do pagamento não coincide com o ID do pedido no banco.'
      )
    }

    // 3. Validação de moeda (BRL) e do valor pago (transaction_amount) contra order.totalAmount
    if (currencyId !== 'BRL') {
      await tx.orderOccurrence.create({
        data: {
          orderId: order.id,
          externalPaymentId: cleanPaymentId,
          type: OrderOccurrenceType.AMOUNT_OR_CURRENCY_MISMATCH,
          description: `Moeda inválida: esperada "BRL", recebida "${String(currencyId)}".`,
          metadata: {
            paymentId: cleanPaymentId,
            currencyId,
          },
        },
      })
      await tx.order.update({
        where: { id: order.id },
        data: { hasOpenOccurrence: true },
      })
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
      await tx.orderOccurrence.create({
        data: {
          orderId: order.id,
          externalPaymentId: cleanPaymentId,
          type: OrderOccurrenceType.AMOUNT_OR_CURRENCY_MISMATCH,
          description: `Valor pago (${paidDecimal.toFixed(2)}) diverge do total do pedido (${order.totalAmount.toFixed(2)}).`,
          metadata: {
            paymentId: cleanPaymentId,
            expected: order.totalAmount.toFixed(2),
            received: paidDecimal.toFixed(2),
          },
        },
      })
      await tx.order.update({
        where: { id: order.id },
        data: { hasOpenOccurrence: true },
      })
      throw new Error(
        `Valor pago (${paidDecimal.toFixed(2)}) diverge do total do pedido (${order.totalAmount.toFixed(2)}).`
      )
    }

    const hasMadeToOrderItem = order.items.some((item) =>
      Boolean(item.isMadeToOrder || isMadeToOrderProduct(item.product))
    )

    // Bifurcação automática pós-pagamento:
    // - Pedido 100% Pronta Entrega: avança direto para READY_FOR_SHIPPING ("Pronto p/ Envio")
    // - Pedido 100% Sob Encomenda ou Híbrido: inicia em PREPARING ("Na Fila" ou "Aguardando Produção")
    const targetLogisticsStatus = hasMadeToOrderItem
      ? LogisticsStatus.PREPARING
      : LogisticsStatus.READY_FOR_SHIPPING

    // 4. Atualizar Order para PAID com trava atômica: paymentStatus: { not: 'PAID' }
    const result = await tx.order.updateMany({
      where: {
        id: order.id,
        paymentStatus: { not: 'PAID' },
        logisticsStatus: { not: 'CANCELLED' },
      },
      data: {
        paymentStatus: 'PAID',
        paidAt: new Date(),
        externalPaymentId: cleanPaymentId,
        logisticsStatus: targetLogisticsStatus,
      },
    })

    if (result.count === 0) {
      return { confirmed: false, alreadyProcessed: true }
    }

    // 5. Atualizar PaymentWebhookLog
    await tx.paymentWebhookLog.upsert({
      where: { eventId: cleanPaymentId },
      update: {
        status: 'approved',
        processingStatus: WebhookProcessingStatus.PROCESSED,
        orderId: order.id,
        processedAt: new Date(),
      },
      create: {
        eventId: cleanPaymentId,
        status: 'approved',
        provider: 'MERCADOPAGO',
        processingStatus: WebhookProcessingStatus.PROCESSED,
        orderId: order.id,
        processedAt: new Date(),
      },
    })

    // 6. Atualizar PaymentAttempt vinculado
    await tx.paymentAttempt.updateMany({
      where: {
        orderId: order.id,
        OR: [
          { externalPaymentId: cleanPaymentId },
          { status: { in: [PaymentAttemptStatus.INITIATED, PaymentAttemptStatus.PENDING, PaymentAttemptStatus.IN_PROCESS] } },
        ],
      },
      data: {
        externalPaymentId: cleanPaymentId,
        status: PaymentAttemptStatus.APPROVED,
        paidAmount: paidDecimal,
        lastReconciledAt: new Date(),
      },
    })

    // 7. Confirmar reserva de estoque atômica (decrementa stock e reservedStock simultaneamente)
    await confirmReservationAtomically(tx, { orderId: order.id })

    // 8. Para itens sem reserva prévia ativa (legado ou compra direta), efetua baixa física direta
    const existingReservations = await tx.stockReservation.findMany({
      where: { orderId: order.id },
      select: { orderItemId: true },
    })
    const reservedOrderItemIds = new Set(existingReservations.map((r) => r.orderItemId))

    for (const item of order.items) {
      const isItemMadeToOrder = Boolean(
        item.isMadeToOrder || isMadeToOrderProduct(item.product)
      )
      if (isItemMadeToOrder || !item.productId || !item.product) {
        continue
      }

      if (reservedOrderItemIds.has(item.id)) {
        continue
      }

      if (item.variantId) {
        const affected = await tx.$executeRaw`
          UPDATE "variants"
          SET "stock" = "stock" - ${item.quantity}
          WHERE "id" = ${item.variantId}
            AND "stock" >= ${item.quantity}
        `
        if (affected === 0) {
          throw new Error(
            `Estoque insuficiente para baixa da variante "${item.variantId}" do item "${item.productTitle}".`
          )
        }
      } else {
        const affected = await tx.$executeRaw`
          UPDATE "products"
          SET "stock" = "stock" - ${item.quantity}
          WHERE "id" = ${item.productId}
            AND "archivedAt" IS NULL
            AND "stock" >= ${item.quantity}
        `
        if (affected === 0) {
          throw new Error(
            `Estoque insuficiente para baixa do item "${item.productTitle}".`
          )
        }
      }

      await tx.stockMovement.create({
        data: {
          idempotencyKey: `consume-direct-${item.id}-${cleanPaymentId}`,
          productId: item.productId,
          variantId: item.variantId,
          orderId: order.id,
          orderItemId: item.id,
          type: StockMovementType.CONSUME_RESERVE,
          quantity: item.quantity,
          reason: 'Baixa definitiva direta por confirmação de pagamento',
        },
      })
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
