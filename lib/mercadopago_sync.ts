import { MercadoPagoConfig, Payment } from 'mercadopago'
import { prisma } from '@/lib/prisma'

/**
 * Identifica se um produto/item é Sob Encomenda (não baixa estoque físico pronto)
 * ou Pronta Entrega (baixa estoque físico em stock).
 */
function isMadeToOrderProduct(product: {
  category: string
  stock: number
} & Record<string, unknown>): boolean {
  if (product.isMadeToOrder === true) return true
  if (product.category.toLowerCase().includes('encomenda')) return true
  if (product.stock <= 0) return true
  return false
}

/**
 * Confirma de forma atômica e idempotente o pagamento aprovado de um pedido.
 *
 * Regras (Documento-Mestre D02 a D07):
 * - Verifica idempotência em PaymentWebhookLog pelo ID do pagamento (eventId @unique).
 * - Atualiza Order.paymentStatus para 'PAID'.
 * - Para itens de Pronta Entrega, efetua a baixa atômica de stock.
 * - Para itens Sob Encomenda, não altera o estoque (vai para a fila de produção no Admin).
 */
export async function confirmApprovedPaymentInDb(params: {
  orderId: string
  paymentId: string
}): Promise<{ confirmed: boolean; alreadyProcessed: boolean }> {
  const { orderId, paymentId } = params
  const cleanPaymentId = String(paymentId).trim()

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
      return { confirmed: false, alreadyProcessed: false }
    }

    // 2. Registrar evento no PaymentWebhookLog
    await tx.paymentWebhookLog.create({
      data: {
        eventId: cleanPaymentId,
        status: 'approved',
      },
    })

    if (order.paymentStatus === 'PAID') {
      return { confirmed: false, alreadyProcessed: true }
    }

    // 3. Atualizar Order para PAID
    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'PAID',
      },
    })

    // 4. Iterar sobre os OrderItems: baixar estoque apenas de Pronta Entrega
    for (const item of order.items) {
      const productRecord = item.product as {
        id: string
        category: string
        stock: number
      } & Record<string, unknown>

      if (isMadeToOrderProduct(productRecord)) {
        // Produto Sob Encomenda: não mexe no estoque físico; segue para fila de produção no Admin
        continue
      }

      if (item.variantId && item.variant) {
        if (item.variant.stock >= item.quantity) {
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
              `Estoque insuficiente para baixa da variante do item "${item.productTitle}".`
            )
          }
        }
      } else {
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
    const mpConfig = new MercadoPagoConfig({
      accessToken,
      options: { timeout: 15000 },
    })
    const paymentClient = new Payment(mpConfig)

    if (paymentId) {
      const mpPayment = await paymentClient.get({ id: String(paymentId) })
      const refOrderId = String(
        mpPayment.external_reference ||
          (mpPayment.metadata as Record<string, unknown> | undefined)?.order_id ||
          ''
      ).trim()

      if (refOrderId === orderId && mpPayment.status === 'approved' && mpPayment.id) {
        await confirmApprovedPaymentInDb({
          orderId,
          paymentId: String(mpPayment.id),
        })
        return { isPaid: true, status: 'approved' }
      }
      return {
        isPaid: mpPayment.status === 'approved',
        status: mpPayment.status || 'pending',
      }
    }

    const searchResult = await paymentClient.search({
      options: {
        external_reference: orderId,
      },
    })

    const results = searchResult.results || []
    const approvedPayment = results.find((p) => p.status === 'approved' && p.id)

    if (approvedPayment && approvedPayment.id) {
      await confirmApprovedPaymentInDb({
        orderId,
        paymentId: String(approvedPayment.id),
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
