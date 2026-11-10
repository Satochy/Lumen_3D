'use server'

import type {
  PaymentStatus,
  LogisticsStatus,
  OrderItemProductionStatus,
} from '@prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    const serializedOrders: SerializedClientOrder[] = orders.map((order) => ({
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
    }))

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
