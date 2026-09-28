'use server'

import { prisma } from '@/lib/prisma'
import { OrderStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'

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
  const orderId = formData.get('orderId') as string
  const status = formData.get('status') as OrderStatus

  if (!orderId || !status) return

  await prisma.order.update({
    where: { id: orderId },
    data: { status },
  })

  revalidatePath('/admin/orders')
}