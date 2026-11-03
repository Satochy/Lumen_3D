'use server'

import { z } from 'zod'
import { randomUUID } from 'crypto'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LogisticsStatus, StockMovementType } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const updateLogisticsSchema = z.object({
  orderId: z.string().uuid('ID do pedido inválido.'),
  logisticsStatus: z.nativeEnum(LogisticsStatus),
})

export async function getOrders() {
  await requireAdmin()

  try {
    const orders = await prisma.order.findMany({
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: orders }
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error)
    return { success: false, error: 'Falha ao carregar lista de pedidos.' }
  }
}

export async function updateLogisticsStatus(formData: FormData): Promise<void> {
  const admin = await requireAdmin()

  const parsed = updateLogisticsSchema.safeParse({
    orderId: formData.get('orderId'),
    logisticsStatus: formData.get('logisticsStatus'),
  })

  if (!parsed.success) return

  const { orderId, logisticsStatus } = parsed.data

  try {
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        paymentStatus: true,
        logisticsStatus: true,
        items: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            quantity: true,
            isMadeToOrder: true,
            product: {
              select: {
                isMadeToOrder: true,
              },
            },
          },
        },
      },
    })

    if (!existingOrder) {
      return
    }

    const allowedWhenUnpaid: LogisticsStatus[] = ['PREPARING', 'CANCELLED']
    if (
      existingOrder.paymentStatus !== 'PAID' &&
      !allowedWhenUnpaid.includes(logisticsStatus)
    ) {
      console.error(
        `Transição logística bloqueada para o pedido ${orderId}: paymentStatus="${existingOrder.paymentStatus}", destino="${logisticsStatus}".`
      )
      return
    }

    // Se o pedido já estava PAID (e não estava CANCELLED) e está sendo alterado para CANCELLED,
    // devolve atomicamente o estoque apenas dos itens de Pronta Entrega (!isMadeToOrder) e registra RESTOCK_RETURN.
    if (
      existingOrder.paymentStatus === 'PAID' &&
      existingOrder.logisticsStatus !== 'CANCELLED' &&
      logisticsStatus === 'CANCELLED'
    ) {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.order.updateMany({
          where: {
            id: orderId,
            paymentStatus: 'PAID',
            logisticsStatus: { not: 'CANCELLED' },
          },
          data: {
            logisticsStatus: 'CANCELLED',
            cancelledAt: new Date(),
          },
        })

        if (updated.count === 0) {
          return
        }

        for (const item of existingOrder.items) {
          const isMadeToOrder = Boolean(
            item.isMadeToOrder || item.product?.isMadeToOrder
          )
          if (isMadeToOrder) {
            continue
          }

          if (item.variantId) {
            await tx.variant.updateMany({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } },
            })
          } else if (item.productId) {
            await tx.product.updateMany({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            })
          }

          if (item.productId) {
            await tx.stockMovement.create({
              data: {
                idempotencyKey: `restock-cancel-${orderId}-${item.id}-${randomUUID()}`,
                productId: item.productId,
                variantId: item.variantId ?? null,
                orderId,
                orderItemId: item.id,
                actorUserId: admin.id,
                type: StockMovementType.RESTOCK_RETURN,
                quantity: item.quantity,
                reason: 'Cancelamento administrativo de pedido pago (estorno de pronta entrega)',
              },
            })
          }
        }
      })
    } else {
      await prisma.order.update({
        where: { id: orderId },
        data: { logisticsStatus },
      })
    }
  } catch (error) {
    console.error('Erro ao atualizar status logístico:', orderId, error)
    return
  }

  revalidatePath('/admin/orders')
  revalidatePath('/admin')
  revalidatePath('/profile/orders')
}
