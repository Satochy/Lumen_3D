import { MercadoPagoConfig, Payment } from 'mercadopago'
import { prisma } from '@/lib/prisma'
import { releaseReservationAtomically } from '@/lib/stock/reservation_service'
import { confirmApprovedPaymentInDb } from '@/lib/mercadopago_sync'
import { PaymentAttemptStatus, StockReservationStatus } from '@prisma/client'

export interface ExpirationJobResult {
  checked: number
  reconciled: number
  expired: number
  errors: string[]
}

/**
 * Rotina periódica / sob demanda para expiração de tentativas de pagamento e reservas vencidas.
 *
 * Regras:
 * - Localiza pedidos PENDING cujo `expiresAt` já venceu.
 * - Para cada tentativa / pedido vencido, consulta a API do Mercado Pago se houver `externalPaymentId`.
 * - Se aprovado lá fora, executa a conciliação atômica (`confirmApprovedPaymentInDb`).
 * - Se NÃO aprovado, marca `PaymentAttempt` como EXPIRED, libera a reserva chamando
 *   `releaseReservationAtomically` e atualiza a ordem para CANCELLED (`cancelledAt: now`).
 */
export async function runExpirationAndReconciliationJob(): Promise<ExpirationJobResult> {
  const result: ExpirationJobResult = {
    checked: 0,
    reconciled: 0,
    expired: 0,
    errors: [],
  }

  const now = new Date()

  try {
    // 1. Buscar pedidos pendentes cujo prazo de reserva/pagamento expirou
    const expiredOrders = await prisma.order.findMany({
      where: {
        paymentStatus: 'PENDING',
        logisticsStatus: { not: 'CANCELLED' },
        expiresAt: { lte: now },
      },
      include: {
        paymentAttempts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    result.checked = expiredOrders.length

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    const mpConfig = accessToken
      ? new MercadoPagoConfig({
          accessToken,
          options: { timeout: 15000 },
        })
      : null
    const paymentClient = mpConfig ? new Payment(mpConfig) : null

    for (const order of expiredOrders) {
      const latestAttempt = order.paymentAttempts[0]
      const paymentId =
        latestAttempt?.externalPaymentId || order.externalPaymentId

      let isApprovedRemotely = false
      let remotePaymentData: any = null

      if (paymentClient && paymentId) {
        try {
          remotePaymentData = await paymentClient.get({ id: String(paymentId) })
          if (remotePaymentData?.status === 'approved') {
            isApprovedRemotely = true
          }
        } catch (mpErr: any) {
          // Se o pagamento não existir no MP ou falhar na consulta, consideramos não aprovado
          console.warn(
            `[EXPIRATION] Falha ao consultar MP para o pagamento ${paymentId} do pedido ${order.id}:`,
            mpErr?.message || mpErr
          )
        }
      }

      if (isApprovedRemotely && remotePaymentData) {
        try {
          await confirmApprovedPaymentInDb({
            orderId: order.id,
            paymentId: String(remotePaymentData.id),
            externalReference: String(remotePaymentData.external_reference || order.id),
            transactionAmount: remotePaymentData.transaction_amount,
            currencyId: remotePaymentData.currency_id,
          })
          result.reconciled++
          continue
        } catch (reconcileErr: any) {
          result.errors.push(
            `Erro ao conciliar pedido aprovado ${order.id}: ${reconcileErr?.message || reconcileErr}`
          )
        }
      }

      // Se não aprovado remotamente, expira a tentativa, libera a reserva e cancela a ordem
      try {
        await prisma.$transaction(async (tx) => {
          if (latestAttempt && latestAttempt.status !== PaymentAttemptStatus.EXPIRED) {
            await tx.paymentAttempt.update({
              where: { id: latestAttempt.id },
              data: {
                status: PaymentAttemptStatus.EXPIRED,
                failureReason: 'Tempo limite de pagamento excedido',
              },
            })
          }

          await releaseReservationAtomically(tx, {
            orderId: order.id,
            reason: 'Tempo limite de pagamento excedido (job de expiração)',
            status: StockReservationStatus.EXPIRED,
          })

          await tx.order.update({
            where: { id: order.id },
            data: {
              logisticsStatus: 'CANCELLED',
              cancelledAt: new Date(),
            },
          })
        })

        result.expired++
      } catch (expireErr: any) {
        console.error(`Erro ao expirar pedido ${order.id}:`, expireErr)
        result.errors.push(
          `Falha ao expirar pedido ${order.id}: ${expireErr?.message || expireErr}`
        )
      }
    }
  } catch (err: any) {
    console.error('Erro geral no job de expiração e conciliação:', err)
    result.errors.push(`Erro fatal no runner: ${err?.message || err}`)
  }

  return result
}
