'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { StockMovementType } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { releaseReservationAtomically } from '@/lib/stock/reservation_service'
import { isOrderFinalized } from '@/lib/order_presenter'

export interface CancelOrderAdminResponse {
  success: boolean
  error?: string
  cancelledAt?: string
  adminNotes?: string
}

/**
 * Cancela operacionalmente um pedido pelo Painel Administrativo (Entrega E12).
 *
 * Regras do Documento-Mestre:
 * - Protegido com requireAdmin().
 * - Idempotente: se a Order já estiver CANCELLED, retorna erro sem repetir operações.
 * - Transação atômica (prisma.$transaction):
 *   a) Define logisticsStatus = 'CANCELLED', cancelledAt = new Date() e registra o motivo e o Admin em adminNotes.
 *      Não altera paymentStatus automaticamente.
 *   b) Para itens de Pronta Entrega (isMadeToOrder === false) quando o pedido original estava PAID,
 *      incrementa o stock em Product ou Variant na quantidade do item e registra StockMovement.
 *      Itens Sob Encomenda (isMadeToOrder === true) não alteram estoque.
 *   c) Caso o pedido estivesse PENDING com reserva ativa, libera a reserva temporária.
 */
export async function cancelOrderAdminAction(
  orderId: string,
  reason: string
): Promise<CancelOrderAdminResponse> {
  try {
    const admin = await requireAdmin()

    if (!orderId || typeof orderId !== 'string') {
      return { success: false, error: 'ID do pedido inválido.' }
    }

    const cleanReason = reason?.trim()
    if (!cleanReason) {
      return {
        success: false,
        error: 'Informe o motivo do cancelamento.',
      }
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                isMadeToOrder: true,
              },
            },
          },
        },
      },
    })

    if (!existingOrder) {
      return { success: false, error: 'Pedido não encontrado.' }
    }

    if (existingOrder.logisticsStatus === 'CANCELLED') {
      return {
        success: false,
        error: 'Este pedido já se encontra cancelado.',
      }
    }

    if (isOrderFinalized(existingOrder)) {
      return {
        success: false,
        error: 'Pedidos finalizados são imutáveis e não podem ser cancelados.',
      }
    }

    const now = new Date()
    const adminDisplayName = admin.name || admin.username || admin.email
    const cancellationNote = `[Cancelamento Administrativo por ${adminDisplayName} em ${now.toLocaleString('pt-BR')} — Motivo: ${cleanReason}]`
    const updatedAdminNotes = existingOrder.adminNotes
      ? `${existingOrder.adminNotes}\n${cancellationNote}`
      : cancellationNote

    await prisma.$transaction(async (tx) => {
      // a) Atualiza a Order preservando paymentStatus e histórico em adminNotes
      const updated = await tx.order.updateMany({
        where: {
          id: orderId,
          logisticsStatus: { not: 'CANCELLED' },
        },
        data: {
          logisticsStatus: 'CANCELLED',
          cancelledAt: now,
          adminNotes: updatedAdminNotes,
        },
      })

      if (updated.count === 0) {
        throw new Error('Este pedido já foi cancelado anteriormente.')
      }

      // b) Reposição de estoque para itens de PRONTA ENTREGA quando paymentStatus original for 'PAID'
      if (existingOrder.paymentStatus === 'PAID') {
        for (const item of existingOrder.items) {
          if (item.isMadeToOrder !== false) {
            continue
          }

          if (item.variantId) {
            await tx.variant.update({
              where: { id: item.variantId },
              data: {
                stock: { increment: item.quantity },
              },
            })
          } else if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data: {
                stock: { increment: item.quantity },
              },
            })
          }

          if (item.productId) {
            await tx.stockMovement.create({
              data: {
                idempotencyKey: `restock-admin-cancel-${orderId}-${item.id}-${randomUUID()}`,
                productId: item.productId,
                variantId: item.variantId ?? null,
                orderId,
                orderItemId: item.id,
                actorUserId: admin.id,
                type: StockMovementType.RESTOCK_RETURN,
                quantity: item.quantity,
                reason: `Cancelamento administrativo (${cleanReason})`,
              },
            })
          }
        }
      } else {
        // Libera eventuais reservas temporárias ativas se o pedido ainda estava pendente
        await releaseReservationAtomically(tx, {
          orderId,
          reason: `Cancelamento administrativo: ${cleanReason}`,
          actorUserId: admin.id,
        })
      }
    })

    revalidatePath('/admin/orders')
    revalidatePath('/admin/assisted-sales')
    revalidatePath('/admin/production')
    revalidatePath('/admin')
    revalidatePath('/profile/orders')
    revalidatePath('/marketplace')

    return {
      success: true,
      cancelledAt: now.toISOString(),
      adminNotes: updatedAdminNotes,
    }
  } catch (err: unknown) {
    console.error('Erro ao cancelar pedido administrativamente:', err)
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : 'Falha ao cancelar o pedido. Tente novamente.',
    }
  }
}
