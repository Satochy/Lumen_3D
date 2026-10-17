'use server'

import { prisma } from '@/lib/prisma'
import { OrderStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const ORDER_STATUSES: string[] = Object.values(OrderStatus)

function isOrderStatus(value: string): value is OrderStatus {
  return ORDER_STATUSES.includes(value)
}

export async function getOrders() {
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

export async function updateOrderStatus(formData: FormData): Promise<void> {
  const orderId = String(formData.get('orderId') ?? '')
  const status = String(formData.get('status') ?? '')

  // O valor vem do navegador: só aceita o que existe no enum do schema.
  if (!orderId || !isOrderStatus(status)) return

  try {
    await prisma.order.update({
      where: { id: orderId },
      data: { status },
    })
  } catch (error) {
    // Pedido inexistente ou falha do banco: registra e não derruba a página.
    console.error('Erro ao atualizar status do pedido:', orderId, error)
    return
  }

  revalidatePath('/admin/orders')
  revalidatePath('/admin') // o painel conta pedidos pendentes
}