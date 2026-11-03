'use server'

import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { ProductionStage } from '@prisma/client'

export interface ProductionQueueItem {
  id: string
  orderId: string
  productId: string | null
  productTitle: string
  quantity: number
  priceUnit: number
  isMadeToOrder: boolean
  productionDays: number | null
  productionStage: ProductionStage
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
const STAGE_PROGRESSION: Record<ProductionStage, ProductionStage | null> = {
  QUEUED: ProductionStage.PRINTING,
  PRINTING: ProductionStage.POST_PROCESSING,
  POST_PROCESSING: ProductionStage.COMPLETED,
  COMPLETED: null,
}

/**
 * Consulta todos os itens sob encomenda ativos e concluídos na Fila de Produção.
 * Ordenado por FIFO e status operacional.
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
        { isReady: 'asc' }, // Itens em aberto primeiro
        { order: { createdAt: 'asc' } }, // FIFO: Mais antigos primeiro
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
      productionStage: item.productionStage,
      isReady: item.isReady,
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
 * Atualiza a etapa granular de produção de um OrderItem:
 * - QUEUED -> PRINTING -> POST_PROCESSING -> COMPLETED
 * - Se atingir COMPLETED: atualiza isReady: true, readyAt e readyByUserId.
 * - VERIFICAÇÃO MÁGICA: Se todos os itens sob encomenda do pedido ficarem COMPLETED,
 *   avança o status logístico do Order para READY_FOR_SHIPPING.
 */
export async function updateItemProductionStageAction(
  orderItemId: string,
  newStage: ProductionStage
): Promise<{
  success: boolean
  newStage?: ProductionStage
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

    const isCompleting = newStage === ProductionStage.COMPLETED
    const now = new Date()

    // 1. Atualizar o item para a nova etapa granular
    await prisma.orderItem.update({
      where: { id: orderItemId },
      data: {
        productionStage: newStage,
        isReady: isCompleting,
        readyAt: isCompleting ? now : null,
        readyByUserId: isCompleting ? user.id : null,
      },
    })

    let orderMovedToReady = false

    // 2. Se a peça foi finalizada (COMPLETED), verificar se todas as peças do pedido estão concluídas
    if (isCompleting) {
      const allOrderItems = await prisma.orderItem.findMany({
        where: { orderId: targetItem.orderId },
      })

      const allMadeToOrderReady = allOrderItems
        .filter((i) => i.isMadeToOrder)
        .every((i) =>
          i.id === orderItemId
            ? true
            : i.productionStage === ProductionStage.COMPLETED || i.isReady
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
            isReady: false,
          },
          data: {
            isReady: true,
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

    // 3. Revalidar rotas
    revalidatePath('/admin/production')
    revalidatePath('/admin/orders')
    revalidatePath('/admin')

    return { success: true, newStage, orderMovedToReady }
  } catch (error) {
    console.error('Erro ao atualizar etapa de produção:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Falha ao atualizar etapa.',
    }
  }
}

/**
 * Avança o item para a próxima etapa na esteira da oficina 3D:
 * QUEUED -> PRINTING -> POST_PROCESSING -> COMPLETED
 */
export async function advanceItemStageAction(
  orderItemId: string
): Promise<{
  success: boolean
  newStage?: ProductionStage
  orderMovedToReady?: boolean
  error?: string
}> {
  const item = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    select: { productionStage: true },
  })

  if (!item) {
    return { success: false, error: 'Item não encontrado.' }
  }

  const nextStage = STAGE_PROGRESSION[item.productionStage]
  if (!nextStage) {
    return { success: false, error: 'O item já está na etapa final (Concluído).' }
  }

  return updateItemProductionStageAction(orderItemId, nextStage)
}

/**
 * Mantido para compatibilidade retroativa: marca como pronto (COMPLETED)
 */
export async function markItemReadyAction(
  orderItemId: string
): Promise<{ success: boolean; orderMovedToReady?: boolean; error?: string }> {
  return updateItemProductionStageAction(orderItemId, ProductionStage.COMPLETED)
}

/**
 * Mantido para compatibilidade retroativa: reabre para QUEUED
 */
export async function unmarkItemReadyAction(
  orderItemId: string
): Promise<{ success: boolean; error?: string }> {
  return updateItemProductionStageAction(orderItemId, ProductionStage.QUEUED)
}
