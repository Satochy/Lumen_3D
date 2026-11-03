'use server'

import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { OrderItemProductionStatus } from '@prisma/client'

export interface ProductionQueueItem {
  id: string
  orderId: string
  productId: string | null
  productTitle: string
  quantity: number
  priceUnit: number
  isMadeToOrder: boolean
  productionDays: number | null
  productionStatus: OrderItemProductionStatus
  isReady: boolean
  readyAt: string | null
  readyByUserId: string | null
  variantAttributesSnapshot: Record<string, unknown> | null
  order: {
    id: string
    createdAt: string
    paymentStatus: string
    logisticsStatus: string
    totalAmount: number
    isLocalDelivery: boolean
    adminNotes: string | null
    shippingAddressSnapshot: Record<string, unknown> | null
    user: {
      id: string
      name: string | null
      username: string
      email: string
      phone: string | null
    } | null
  }
  product: {
    id: string
    title: string
    slug: string
    images: string[]
  } | null
}

export type PendingProductionItem = ProductionQueueItem

/**
 * Ordem natural de progressão das etapas na oficina 3D
 */
const STATUS_PROGRESSION: Record<OrderItemProductionStatus, OrderItemProductionStatus | null> = {
  QUEUED: OrderItemProductionStatus.PRINTING,
  PRINTING: OrderItemProductionStatus.POST_PROCESSING,
  POST_PROCESSING: OrderItemProductionStatus.READY,
  READY: null,
}

/**
 * Consulta todos os itens sob encomenda ativos e concluídos na Fila de Produção.
 * Ordenado por status operacional e FIFO (mais antigos primeiro).
 */
export async function getProductionQueueData(): Promise<{
  success: boolean
  data: ProductionQueueItem[]
  error?: string
}> {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, error: 'Acesso restrito a administradores.', data: [] }
    }

    const rawItems = await prisma.orderItem.findMany({
      where: {
        isMadeToOrder: true,
        order: {
          paymentStatus: 'PAID',
          logisticsStatus: {
            notIn: ['CANCELLED'],
          },
        },
      },
      include: {
        order: {
          select: {
            id: true,
            createdAt: true,
            paymentStatus: true,
            logisticsStatus: true,
            totalAmount: true,
            isLocalDelivery: true,
            adminNotes: true,
            shippingAddressSnapshot: true,
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
            images: true,
          },
        },
      },
      orderBy: [
        { productionStatus: 'asc' },
        { order: { createdAt: 'asc' } },
      ],
    })

    const serializedItems: ProductionQueueItem[] = rawItems.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      productTitle: item.productTitle,
      quantity: item.quantity,
      priceUnit: Number(item.priceUnit),
      isMadeToOrder: item.isMadeToOrder,
      productionDays: item.productionDays,
      productionStatus: item.productionStatus,
      isReady: item.productionStatus === OrderItemProductionStatus.READY,
      readyAt: item.readyAt ? item.readyAt.toISOString() : null,
      readyByUserId: item.readyByUserId,
      variantAttributesSnapshot:
        (item.variantAttributesSnapshot as Record<string, unknown> | null) ?? null,
      order: {
        id: item.order.id,
        createdAt: item.order.createdAt.toISOString(),
        paymentStatus: item.order.paymentStatus,
        logisticsStatus: item.order.logisticsStatus,
        totalAmount: Number(item.order.totalAmount),
        isLocalDelivery: item.order.isLocalDelivery,
        adminNotes: item.order.adminNotes,
        shippingAddressSnapshot:
          (item.order.shippingAddressSnapshot as Record<string, unknown> | null) ?? null,
        user: item.order.user,
      },
      product: item.product,
    }))

    return { success: true, data: serializedItems }
  } catch (error) {
    console.error('Erro ao consultar fila de produção:', error)
    return { success: false, error: 'Falha ao consultar fila de produção.', data: [] }
  }
}

/**
 * Mantido para compatibilidade retroativa com chamadas existentes
 */
export async function getPendingProductionItems(): Promise<{
  success: boolean
  data: ProductionQueueItem[]
  error?: string
}> {
  return getProductionQueueData()
}

/**
 * Atualiza o status granular de produção de um OrderItem:
 * - QUEUED -> PRINTING -> POST_PROCESSING -> READY
 * - Se atingir READY: atualiza readyAt e readyByUserId.
 * - VERIFICAÇÃO AUTOMÁTICA: Se todos os itens sob encomenda do pedido ficarem READY,
 *   avança o status logístico do Order para READY_FOR_SHIPPING.
 */
export async function updateItemProductionStatusAction(
  orderItemId: string,
  newStatus: OrderItemProductionStatus
): Promise<{
  success: boolean
  newStatus?: OrderItemProductionStatus
  newStage?: OrderItemProductionStatus
  orderMovedToReady?: boolean
  error?: string
}> {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, error: 'Acesso não autorizado.' }
    }

    const targetItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        order: {
          include: {
            items: true,
          },
        },
      },
    })

    if (!targetItem) {
      return { success: false, error: 'Item de pedido não encontrado.' }
    }

    const isCompleting = newStatus === OrderItemProductionStatus.READY
    const now = new Date()

    // 1. Atualizar o item para o novo status granular
    await prisma.orderItem.update({
      where: { id: orderItemId },
      data: {
        productionStatus: newStatus,
        readyAt: isCompleting ? now : null,
        readyByUserId: isCompleting ? user.id : null,
      },
    })

    let orderMovedToReady = false

    // 2. Se a peça foi finalizada (READY), verificar se todas as peças sob encomenda do pedido estão concluídas
    if (isCompleting) {
      const allOrderItems = await prisma.orderItem.findMany({
        where: { orderId: targetItem.orderId },
        select: {
          id: true,
          isMadeToOrder: true,
          productionStatus: true,
        },
      })

      const allMadeToOrderReady = allOrderItems
        .filter((i) => i.isMadeToOrder)
        .every((i) =>
          i.id === orderItemId
            ? true
            : i.productionStatus === OrderItemProductionStatus.READY
        )

      if (
        allMadeToOrderReady &&
        targetItem.order.paymentStatus === 'PAID' &&
        !['CANCELLED', 'SHIPPED', 'DELIVERED', 'READY_FOR_SHIPPING'].includes(
          targetItem.order.logisticsStatus
        )
      ) {
        // Marca itens de pronta entrega como prontos se não estiverem
        await prisma.orderItem.updateMany({
          where: {
            orderId: targetItem.orderId,
            isMadeToOrder: false,
            productionStatus: { not: OrderItemProductionStatus.READY },
          },
          data: {
            productionStatus: OrderItemProductionStatus.READY,
            readyAt: now,
            readyByUserId: user.id,
          },
        })

        // Promove o pedido globalmente para READY_FOR_SHIPPING
        await prisma.order.update({
          where: { id: targetItem.orderId },
          data: {
            logisticsStatus: 'READY_FOR_SHIPPING',
          },
        })

        orderMovedToReady = true
      }
    } else {
      // Se estava em READY_FOR_SHIPPING e voltou para etapa anterior, retorna o pedido para PRODUCING
      if (targetItem.order.logisticsStatus === 'READY_FOR_SHIPPING') {
        await prisma.order.update({
          where: { id: targetItem.orderId },
          data: {
            logisticsStatus: 'PRODUCING',
          },
        })
      }
    }

    // 3. Revalidar rotas administrativas e de perfil
    revalidatePath('/admin/production')
    revalidatePath('/admin/orders')
    revalidatePath('/admin')
    revalidatePath('/profile/orders')

    return {
      success: true,
      newStatus,
      newStage: newStatus,
      orderMovedToReady,
    }
  } catch (error) {
    console.error('Erro ao atualizar status de produção:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Falha ao atualizar status.',
    }
  }
}

// Alias para compatibilidade com chamadas existentes
export const updateItemProductionStageAction = updateItemProductionStatusAction

/**
 * Avança o item para o próximo status na esteira da oficina 3D:
 * QUEUED -> PRINTING -> POST_PROCESSING -> READY
 */
export async function advanceItemStatusAction(
  orderItemId: string
): Promise<{
  success: boolean
  newStatus?: OrderItemProductionStatus
  newStage?: OrderItemProductionStatus
  orderMovedToReady?: boolean
  error?: string
}> {
  const item = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    select: { productionStatus: true },
  })

  if (!item) {
    return { success: false, error: 'Item não encontrado.' }
  }

  const nextStatus = STATUS_PROGRESSION[item.productionStatus]
  if (!nextStatus) {
    return { success: false, error: 'O item já está no status final (Pronto/Concluído).' }
  }

  return updateItemProductionStatusAction(orderItemId, nextStatus)
}

// Alias para compatibilidade com chamadas existentes
export const advanceItemStageAction = advanceItemStatusAction

/**
 * Mantido para compatibilidade retroativa: marca como pronto (READY)
 */
export async function markItemReadyAction(
  orderItemId: string
): Promise<{ success: boolean; orderMovedToReady?: boolean; error?: string }> {
  return updateItemProductionStatusAction(orderItemId, OrderItemProductionStatus.READY)
}

/**
 * Mantido para compatibilidade retroativa: reabre para QUEUED
 */
export async function unmarkItemReadyAction(
  orderItemId: string
): Promise<{ success: boolean; error?: string }> {
  return updateItemProductionStatusAction(orderItemId, OrderItemProductionStatus.QUEUED)
}
