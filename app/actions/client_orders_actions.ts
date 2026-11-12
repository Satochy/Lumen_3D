'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import type {
  PaymentStatus,
  LogisticsStatus,
  OrderItemProductionStatus,
} from '@prisma/client'
import { StockMovementType } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isOrderFinalized } from '@/lib/order_presenter'
import { releaseReservationAtomically } from '@/lib/stock/reservation_service'

export interface SerializedClientOrderItem {
  id: string
  orderId: string
  productId: string | null
  productTitle: string
  quantity: number
  priceUnit: number
  isMadeToOrder: boolean
  productionDays: number | null
  variantId: string | null
  variantAttributesSnapshot: Record<string, unknown> | null
  readyAt: string | null
  productionStatus: OrderItemProductionStatus
}

export interface SerializedClientOrder {
  id: string
  userId: string | null
  paymentStatus: PaymentStatus
  logisticsStatus: LogisticsStatus
  totalAmount: number
  shippingCost: number
  shippingAddressSnapshot: Record<string, unknown> | null
  trackingCode: string | null
  shippingLabelUrl: string | null
  externalShipmentId: string | null
  isLocalDelivery: boolean
  isAssistedSale: boolean
  paymentMethod: string | null
  expiresAt: string | null
  paidAt: string | null
  cancelledAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  adminNotes: string | null
  isFinalized: boolean
  isHybrid: boolean
  createdAt: string
  updatedAt: string
  items: SerializedClientOrderItem[]
}

export interface ClientOrdersActionResponse {
  success: boolean
  data: SerializedClientOrder[]
  error?: string | null
}

/**
 * Busca o histórico de pedidos do comprador autenticado.
 * Serializa todos os campos Prisma.Decimal para number e Date para ISO string
 * para consumo seguro em Client Components.
 */
export async function getClientOrdersAction(): Promise<ClientOrdersActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        data: [],
        error: 'Usuário não autenticado.',
      }
    }

    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const serializedOrders: SerializedClientOrder[] = orders.map((order) => {
      const isFin = isOrderFinalized(order)
      const hasMadeToOrder = order.items.some((i) => i.isMadeToOrder)
      const hasReadyToShip = order.items.some((i) => !i.isMadeToOrder)
      const isHybrid = hasMadeToOrder && hasReadyToShip

      return {
        id: order.id,
        userId: order.userId,
        paymentStatus: order.paymentStatus,
        logisticsStatus: order.logisticsStatus,
        totalAmount: Number(order.totalAmount),
        shippingCost: Number(order.shippingCost),
        shippingAddressSnapshot:
          order.shippingAddressSnapshot &&
          typeof order.shippingAddressSnapshot === 'object' &&
          !Array.isArray(order.shippingAddressSnapshot)
            ? (order.shippingAddressSnapshot as Record<string, unknown>)
            : null,
        trackingCode: order.trackingCode,
        shippingLabelUrl: order.shippingLabelUrl,
        externalShipmentId: order.externalShipmentId,
        isLocalDelivery: order.isLocalDelivery,
        isAssistedSale: order.isAssistedSale,
        paymentMethod: order.paymentMethod,
        expiresAt: order.expiresAt ? order.expiresAt.toISOString() : null,
        paidAt: order.paidAt ? order.paidAt.toISOString() : null,
        cancelledAt: order.cancelledAt ? order.cancelledAt.toISOString() : null,
        shippedAt: order.shippedAt ? order.shippedAt.toISOString() : null,
        deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : null,
        adminNotes: order.adminNotes,
        isFinalized: isFin,
        isHybrid,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        items: order.items.map((item) => ({
          id: item.id,
          orderId: item.orderId,
          productId: item.productId,
          productTitle: item.productTitle,
          quantity: item.quantity,
          priceUnit: Number(item.priceUnit),
          isMadeToOrder: item.isMadeToOrder,
          productionDays: item.productionDays,
          variantId: item.variantId,
          variantAttributesSnapshot:
            item.variantAttributesSnapshot &&
            typeof item.variantAttributesSnapshot === 'object' &&
            !Array.isArray(item.variantAttributesSnapshot)
              ? (item.variantAttributesSnapshot as Record<string, unknown>)
              : null,
          readyAt: item.readyAt ? item.readyAt.toISOString() : null,
          productionStatus: item.productionStatus,
        })),
      }
    })

    return {
      success: true,
      data: serializedOrders,
      error: null,
    }
  } catch (error) {
    console.error('Erro ao buscar pedidos do cliente:', error)
    return {
      success: false,
      data: [],
      error: 'Não foi possível carregar o histórico de pedidos.',
    }
  }
}

/**
 * Confirmação de recebimento pelo cliente para entregas locais (SHIPPED -> DELIVERED).
 */
export async function confirmOrderDeliveryByClientAction(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Faça login para confirmar o recebimento.' }
    }

    if (!orderId || typeof orderId !== 'string') {
      return { success: false, error: 'ID do pedido inválido.' }
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        logisticsStatus: true,
        isLocalDelivery: true,
        adminNotes: true,
        shippingAddressSnapshot: true,
      },
    })

    if (!order || order.userId !== user.id) {
      return { success: false, error: 'Pedido não encontrado ou não pertence à sua conta.' }
    }

    if (order.logisticsStatus !== 'SHIPPED') {
      return {
        success: false,
        error: 'Apenas pedidos enviados em trânsito podem ter o recebimento confirmado.',
      }
    }

    const snapshot = order.shippingAddressSnapshot as Record<string, unknown> | null
    const isLocal = Boolean(
      order.isLocalDelivery ||
      snapshot?.isLocalDelivery ||
      (typeof snapshot?.serviceName === 'string' &&
        snapshot.serviceName.toLowerCase().includes('local'))
    )

    if (!isLocal) {
      return {
        success: false,
        error: 'A confirmação manual é exclusiva para pedidos com Entrega Local.',
      }
    }

    const now = new Date()
    const confirmationNote = `[Recebimento confirmado pelo Cliente (${user.name || user.email}) em ${now.toLocaleString('pt-BR')}]`
    const updatedNotes = order.adminNotes
      ? `${order.adminNotes}\n${confirmationNote}`
      : confirmationNote

    await prisma.order.update({
      where: { id: orderId },
      data: {
        logisticsStatus: 'DELIVERED',
        deliveredAt: now,
        adminNotes: updatedNotes,
      },
    })

    revalidatePath('/profile/orders')
    revalidatePath('/admin/orders')
    revalidatePath('/admin')

    return { success: true }
  } catch (error) {
    console.error('Erro ao confirmar recebimento:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Falha ao confirmar recebimento.',
    }
  }
}

/**
 * Conclui imediatamente um pedido entregue pelo cliente (janela de 3 dias antecipada).
 */
export async function finalizeOrderByClientAction(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Faça login para finalizar o pedido.' }
    }

    if (!orderId || typeof orderId !== 'string') {
      return { success: false, error: 'ID do pedido inválido.' }
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        logisticsStatus: true,
        deliveredAt: true,
        adminNotes: true,
      },
    })

    if (!order || order.userId !== user.id) {
      return { success: false, error: 'Pedido não encontrado ou não pertence à sua conta.' }
    }

    if (order.logisticsStatus !== 'DELIVERED') {
      return {
        success: false,
        error: 'Apenas pedidos com entrega concluída podem ser finalizados.',
      }
    }

    if (isOrderFinalized(order)) {
      return {
        success: false,
        error: 'Este pedido já está finalizado.',
      }
    }

    const now = new Date()
    const finalNote = `[FINALIZADO: Concluído manualmente pelo cliente em ${now.toLocaleString('pt-BR')}]`
    const updatedNotes = order.adminNotes
      ? `${order.adminNotes}\n${finalNote}`
      : finalNote

    await prisma.order.update({
      where: { id: orderId },
      data: {
        adminNotes: updatedNotes,
      },
    })

    revalidatePath('/profile/orders')
    revalidatePath('/admin/orders')
    revalidatePath('/admin')

    return { success: true }
  } catch (error) {
    console.error('Erro ao finalizar pedido pelo cliente:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Falha ao finalizar o pedido.',
    }
  }
}

/**
 * Cancelamento de pedido pelo cliente antes do despacho/envio.
 */
export async function cancelOrderByClientAction(
  orderId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Faça login para cancelar o pedido.' }
    }

    if (!orderId || typeof orderId !== 'string') {
      return { success: false, error: 'ID do pedido inválido.' }
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

    if (!existingOrder || existingOrder.userId !== user.id) {
      return { success: false, error: 'Pedido não encontrado ou não pertence à sua conta.' }
    }

    if (existingOrder.logisticsStatus === 'CANCELLED') {
      return { success: false, error: 'Este pedido já está cancelado.' }
    }

    // Não permite cancelamento direto pelo cliente após despacho (SHIPPED/DELIVERED) ou se finalizado
    if (
      ['SHIPPED', 'DELIVERED'].includes(existingOrder.logisticsStatus) ||
      isOrderFinalized(existingOrder)
    ) {
      return {
        success: false,
        error: 'Pedidos já enviados em trânsito ou finalizados não podem ser cancelados por este canal.',
      }
    }

    const now = new Date()
    const cancellationNote = `[Cancelado pelo Cliente (${user.name || user.email}) em ${now.toLocaleString('pt-BR')}${reason ? ` — Motivo: ${reason}` : ''}]`
    const updatedAdminNotes = existingOrder.adminNotes
      ? `${existingOrder.adminNotes}\n${cancellationNote}`
      : cancellationNote

    await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: {
          id: orderId,
          logisticsStatus: { notIn: ['CANCELLED', 'SHIPPED', 'DELIVERED'] },
        },
        data: {
          logisticsStatus: 'CANCELLED',
          cancelledAt: now,
          adminNotes: updatedAdminNotes,
        },
      })

      if (updated.count === 0) {
        throw new Error('Não foi possível cancelar o pedido. O status pode ter sido alterado.')
      }

      // Restitui estoque de Pronta Entrega se o pedido já estava PAID
      if (existingOrder.paymentStatus === 'PAID') {
        for (const item of existingOrder.items) {
          const isItemMadeToOrder = Boolean(item.isMadeToOrder || item.product?.isMadeToOrder)
          if (isItemMadeToOrder) continue

          if (item.variantId) {
            await tx.variant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } },
            })
          } else if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            })
          }

          if (item.productId) {
            await tx.stockMovement.create({
              data: {
                idempotencyKey: `restock-client-cancel-${orderId}-${item.id}-${randomUUID()}`,
                productId: item.productId,
                variantId: item.variantId ?? null,
                orderId,
                orderItemId: item.id,
                actorUserId: user.id,
                type: StockMovementType.RESTOCK_RETURN,
                quantity: item.quantity,
                reason: `Cancelamento solicitado pelo cliente (${reason || 'Desistência'})`,
              },
            })
          }
        }
      } else {
        // Se ainda estava pendente de pagamento, libera a reserva de estoque temporária
        await releaseReservationAtomically(tx, {
          orderId,
          reason: `Cancelamento pelo cliente: ${reason || 'Desistência'}`,
          actorUserId: user.id,
        })
      }
    })

    revalidatePath('/profile/orders')
    revalidatePath('/admin/orders')
    revalidatePath('/admin')
    revalidatePath('/marketplace')

    return { success: true }
  } catch (error) {
    console.error('Erro ao cancelar pedido pelo cliente:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Falha ao processar cancelamento.',
    }
  }
}
