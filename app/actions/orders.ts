'use server'

import { z } from 'zod'
import { randomUUID } from 'crypto'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LogisticsStatus, StockMovementType, OrderOccurrenceStatus, Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { isOrderFinalized } from '@/lib/order_presenter'

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message
  return fallback
}

const updateLogisticsSchema = z.object({
  orderId: z.string().uuid('ID do pedido inválido.'),
  logisticsStatus: z.nativeEnum(LogisticsStatus),
})

/**
 * Busca todos os pedidos para visualização no Painel Administrativo.
 * Inclui dados do cliente, itens com dados do produto e ocorrências ativas.
 */
export async function getOrders() {
  await requireAdmin()

  try {
    const orders = await prisma.order.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            phone: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                images: true,
                stock: true,
                reservedStock: true,
                isMadeToOrder: true,
                productionDays: true,
              },
            },
          },
        },
        occurrences: {
          orderBy: { createdAt: 'desc' },
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

/**
 * Atualiza o status logístico do pedido via FormData (suporte a forms HTML nativos).
 */
export async function updateLogisticsStatus(formData: FormData): Promise<void> {
  const admin = await requireAdmin()

  const parsed = updateLogisticsSchema.safeParse({
    orderId: formData.get('orderId'),
    logisticsStatus: formData.get('logisticsStatus'),
  })

  if (!parsed.success) return

  await setOrderLogisticsStatus(parsed.data.orderId, parsed.data.logisticsStatus, admin.id)
}

/**
 * Atualiza o status logístico do pedido programmaticamente.
 */
export async function updateOrderStatusAction(
  orderId: string,
  logisticsStatus: LogisticsStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin()
    await setOrderLogisticsStatus(orderId, logisticsStatus, admin.id)
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, 'Falha ao atualizar status.') }
  }
}

/**
 * Função interna segura para transição logística com controle de estoque e devolução atômica.
 */
async function setOrderLogisticsStatus(
  orderId: string,
  logisticsStatus: LogisticsStatus,
  adminUserId: string
): Promise<void> {
  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      paymentStatus: true,
      logisticsStatus: true,
      deliveredAt: true,
      adminNotes: true,
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

  // Trava de Imutabilidade: Pedidos Finalizados nunca podem ter status alterado
  if (isOrderFinalized(existingOrder)) {
    throw new Error('Pedidos finalizados são imutáveis e não podem ter seu status alterado.')
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
              actorUserId: adminUserId,
              type: StockMovementType.RESTOCK_RETURN,
              quantity: item.quantity,
              reason: 'Cancelamento administrativo de pedido pago (estorno de pronta entrega)',
            },
          })
        }
      }
    })
  } else {
    const updateData: Prisma.OrderUpdateInput = { logisticsStatus }
    if (logisticsStatus === 'DELIVERED') {
      updateData.deliveredAt = new Date()
    }
    await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    })
  }

  revalidatePath('/admin/orders')
  revalidatePath('/admin')
  revalidatePath('/profile/orders')
}

/**
 * Alterna a conclusão de fabricação de um item sob encomenda específico ("Marcar Pronto").
 * Se todos os itens sob encomenda do pedido ficarem prontos, avança o status do pedido para READY_FOR_SHIPPING.
 */
export async function toggleOrderItemReadyAction(
  orderItemId: string
): Promise<{ success: boolean; isReady?: boolean; orderMovedToReady?: boolean; error?: string }> {
  try {
    const admin = await requireAdmin()

    const item = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      select: {
        id: true,
        orderId: true,
        isMadeToOrder: true,
        productionStatus: true,
        order: {
          select: {
            id: true,
            paymentStatus: true,
            logisticsStatus: true,
            items: {
              select: {
                id: true,
                isMadeToOrder: true,
                productionStatus: true,
              },
            },
          },
        },
      },
    })

    if (!item) {
      return { success: false, error: 'Item não encontrado.' }
    }

    const isCurrentlyReady = item.productionStatus === 'READY'
    const newReadyState = !isCurrentlyReady
    const newStatus = newReadyState ? 'READY' : 'QUEUED'

    await prisma.orderItem.update({
      where: { id: orderItemId },
      data: {
        productionStatus: newStatus,
        readyAt: newReadyState ? new Date() : null,
        readyByUserId: newReadyState ? admin.id : null,
      },
    })

    let orderMovedToReady = false

    // Se marcou como pronto, verificar se TODOS os itens sob encomenda do pedido agora estão prontos
    if (newReadyState) {
      const allOtherMadeToOrderReady = item.order.items
        .filter((i) => i.id !== orderItemId && i.isMadeToOrder)
        .every((i) => i.productionStatus === 'READY')

      if (
        allOtherMadeToOrderReady &&
        item.order.paymentStatus === 'PAID' &&
        ['PREPARING', 'PRODUCING', 'PRINTING', 'POST_PROCESSING'].includes(item.order.logisticsStatus)
      ) {
        // Marca itens de pronta entrega como prontos se não estiverem
        await prisma.orderItem.updateMany({
          where: {
            orderId: item.orderId,
            isMadeToOrder: false,
            productionStatus: { not: 'READY' },
          },
          data: {
            productionStatus: 'READY',
            readyAt: new Date(),
            readyByUserId: admin.id,
          },
        })

        await prisma.order.update({
          where: { id: item.orderId },
          data: {
            logisticsStatus: 'READY_FOR_SHIPPING',
          },
        })
        orderMovedToReady = true
      }
    }

    revalidatePath('/admin/orders')
    revalidatePath('/admin/production')
    revalidatePath('/admin')
    revalidatePath('/profile/orders')

    return {
      success: true,
      isReady: newReadyState,
      orderMovedToReady,
    }
  } catch (err: unknown) {
    console.error('Erro ao alternar item pronto:', err)
    return { success: false, error: getErrorMessage(err, 'Falha ao atualizar item.') }
  }
}

/**
 * Salva o código de rastreio e opcionalmente marca o pedido como Enviado (SHIPPED).
 */
export async function updateOrderTrackingAction(
  orderId: string,
  trackingCode: string,
  markAsShipped: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()

    const cleanCode = trackingCode.trim().toUpperCase()

    const updateData: Prisma.OrderUpdateInput = {
      trackingCode: cleanCode || null,
    }

    if (markAsShipped) {
      updateData.logisticsStatus = 'SHIPPED'
      updateData.shippedAt = new Date()
    }

    await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    })

    revalidatePath('/admin/orders')
    revalidatePath('/admin/production')
    revalidatePath('/admin')
    revalidatePath('/profile/orders')

    return { success: true }
  } catch (err: unknown) {
    console.error('Erro ao atualizar rastreio:', err)
    return { success: false, error: getErrorMessage(err, 'Falha ao salvar código de rastreio.') }
  }
}

/**
 * Salva notas ou anotações internas administrativas no pedido.
 */
export async function updateOrderAdminNotesAction(
  orderId: string,
  adminNotes: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()

    await prisma.order.update({
      where: { id: orderId },
      data: {
        adminNotes: adminNotes.trim() || null,
      },
    })

    revalidatePath('/admin/orders')
    return { success: true }
  } catch (err: unknown) {
    console.error('Erro ao salvar notas administrativas:', err)
    return { success: false, error: getErrorMessage(err, 'Falha ao salvar observações.') }
  }
}

/**
 * Marca uma ocorrência aberta do pedido como resolvida.
 */
export async function resolveOrderOccurrenceAction(
  orderId: string,
  occurrenceId: string,
  resolutionNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin()

    await prisma.orderOccurrence.update({
      where: { id: occurrenceId },
      data: {
        status: OrderOccurrenceStatus.RESOLVED,
        resolvedByUserId: admin.id,
        resolutionNotes: resolutionNotes?.trim() || 'Resolvido administrativamente.',
        resolvedAt: new Date(),
      },
    })

    const remainingOpen = await prisma.orderOccurrence.count({
      where: {
        orderId,
        status: OrderOccurrenceStatus.OPEN,
      },
    })

    if (remainingOpen === 0) {
      await prisma.order.update({
        where: { id: orderId },
        data: { hasOpenOccurrence: false },
      })
    }

    revalidatePath('/admin/orders')
    revalidatePath('/admin')

    return { success: true }
  } catch (err: unknown) {
    console.error('Erro ao resolver ocorrência:', err)
    return { success: false, error: getErrorMessage(err, 'Falha ao resolver ocorrência.') }
  }
}

/**
 * Despacha operacionalmente um pedido Pronto para Envio (READY_FOR_SHIPPING -> SHIPPED).
 * Atualiza status, grava timestamp de envio e notas de auditoria.
 */
export async function dispatchOrderAction(
  orderId: string,
  trackingCode?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin()

    if (!orderId || typeof orderId !== 'string') {
      return { success: false, error: 'ID do pedido inválido.' }
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        paymentStatus: true,
        logisticsStatus: true,
        isLocalDelivery: true,
        trackingCode: true,
        adminNotes: true,
        shippingAddressSnapshot: true,
      },
    })

    if (!order) {
      return { success: false, error: 'Pedido não encontrado.' }
    }

    if (order.logisticsStatus !== 'READY_FOR_SHIPPING') {
      return {
        success: false,
        error: `Apenas pedidos "Pronto p/ Envio" podem ser despachados. Status atual: ${order.logisticsStatus}.`,
      }
    }

    const snapshot = order.shippingAddressSnapshot as Record<string, unknown> | null
    const isLocal = Boolean(
      order.isLocalDelivery ||
      snapshot?.isLocalDelivery ||
      (typeof snapshot?.serviceName === 'string' &&
        snapshot.serviceName.toLowerCase().includes('local'))
    )

    const now = new Date()
    const cleanTracking = trackingCode?.trim().toUpperCase() || order.trackingCode || null
    const adminName = admin.name || admin.username || admin.email
    const dispatchNote = isLocal
      ? `[Saída / Despacho por Frota Própria confirmado por ${adminName} em ${now.toLocaleString('pt-BR')}]`
      : `[Despachado / Enviado via transportadora por ${adminName} em ${now.toLocaleString('pt-BR')}${cleanTracking ? ` — Rastreio: ${cleanTracking}` : ''}]`

    const updatedNotes = order.adminNotes
      ? `${order.adminNotes}\n${dispatchNote}`
      : dispatchNote

    await prisma.order.update({
      where: { id: orderId },
      data: {
        logisticsStatus: 'SHIPPED',
        shippedAt: now,
        trackingCode: cleanTracking,
        adminNotes: updatedNotes,
      },
    })

    revalidatePath('/admin/orders')
    revalidatePath('/admin')
    revalidatePath('/profile/orders')

    return { success: true }
  } catch (err: unknown) {
    console.error('Erro ao despachar pedido:', err)
    return {
      success: false,
      error: getErrorMessage(err, 'Falha ao despachar pedido.'),
    }
  }
}

/**
 * Confirma a entrega física final de um pedido de Entrega Local ou Balcão ao destinatário.
 * Avança o status de SHIPPED -> DELIVERED, grava deliveredAt e inicia o prazo de 3 dias para finalização.
 */
export async function confirmLocalDeliveryAction(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin()

    if (!orderId || typeof orderId !== 'string') {
      return { success: false, error: 'ID do pedido inválido.' }
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        paymentStatus: true,
        logisticsStatus: true,
        deliveredAt: true,
        adminNotes: true,
      },
    })

    if (!order) {
      return { success: false, error: 'Pedido não encontrado.' }
    }

    if (order.logisticsStatus !== 'SHIPPED') {
      return {
        success: false,
        error: `Apenas pedidos com status "Enviado / A Caminho" podem ser confirmados como entregues (status atual: ${order.logisticsStatus}).`,
      }
    }

    const now = new Date()
    const adminName = admin.name || admin.username || admin.email
    const deliveryNote = `[Entrega Local / Balcão confirmada por ${adminName} em ${now.toLocaleString('pt-BR')}]`
    const updatedNotes = order.adminNotes
      ? `${order.adminNotes}\n${deliveryNote}`
      : deliveryNote

    await prisma.order.update({
      where: { id: orderId },
      data: {
        logisticsStatus: 'DELIVERED',
        deliveredAt: now,
        adminNotes: updatedNotes,
      },
    })

    revalidatePath('/admin/orders')
    revalidatePath('/admin')
    revalidatePath('/admin/finance')
    revalidatePath('/profile/orders')

    return { success: true }
  } catch (err: unknown) {
    console.error('Erro ao confirmar entrega ao cliente:', err)
    return {
      success: false,
      error: getErrorMessage(err, 'Falha ao confirmar entrega ao cliente.'),
    }
  }
}

/**
 * Finaliza manualmente o pedido pelo Administrador, sem aguardar o prazo de 3 dias pós-entrega.
 * - Garante logisticsStatus: 'DELIVERED'.
 * - Registra a tag [FINALIZADO: Concluído manualmente pela administração por {admin} em {data/hora}] em adminNotes.
 * - Retroage deliveredAt em 4 dias caso seja recente ou nulo, forçando encerramento imediato seguro.
 * - Dispara revalidação das páginas do painel e do cliente.
 */
export async function finalizeOrderAdminAction(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin()

    if (!orderId || typeof orderId !== 'string') {
      return { success: false, error: 'ID do pedido inválido.' }
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        paymentStatus: true,
        logisticsStatus: true,
        deliveredAt: true,
        adminNotes: true,
      },
    })

    if (!order) {
      return { success: false, error: 'Pedido não encontrado.' }
    }

    if (order.logisticsStatus === 'CANCELLED') {
      return { success: false, error: 'Pedidos cancelados não podem ser finalizados.' }
    }

    if (isOrderFinalized(order)) {
      return { success: false, error: 'Este pedido já está finalizado.' }
    }

    const now = new Date()
    const adminName = admin.name || admin.username || admin.email
    const finalNote = `[FINALIZADO: Concluído manualmente pela administração por ${adminName} em ${now.toLocaleString('pt-BR')}]`
    const updatedNotes = order.adminNotes
      ? `${order.adminNotes}\n${finalNote}`
      : finalNote

    // Retroage deliveredAt para 4 dias atrás se recente ou nulo para garantir conclusão imediata
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
    const effectiveDeliveredAt =
      order.deliveredAt && order.deliveredAt < fourDaysAgo
        ? order.deliveredAt
        : fourDaysAgo

    await prisma.order.update({
      where: { id: orderId },
      data: {
        logisticsStatus: 'DELIVERED',
        deliveredAt: effectiveDeliveredAt,
        adminNotes: updatedNotes,
      },
    })

    revalidatePath('/admin/orders')
    revalidatePath('/admin')
    revalidatePath('/admin/finance')
    revalidatePath('/profile/orders')

    return { success: true }
  } catch (err: unknown) {
    console.error('Erro ao finalizar pedido pelo admin:', err)
    return {
      success: false,
      error: getErrorMessage(err, 'Falha ao finalizar o pedido.'),
    }
  }
}
