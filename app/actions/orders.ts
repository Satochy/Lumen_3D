'use server'

import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LogisticsStatus } from '@prisma/client'
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
  await requireAdmin()

  const parsed = updateLogisticsSchema.safeParse({
    orderId: formData.get('orderId'),
    logisticsStatus: formData.get('logisticsStatus'),
  })

  if (!parsed.success) return

  const { orderId, logisticsStatus } = parsed.data

  try {
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, paymentStatus: true, logisticsStatus: true },
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

    await prisma.order.update({
      where: { id: orderId },
      data: { logisticsStatus },
    })
  } catch (error) {
    console.error('Erro ao atualizar status logístico:', orderId, error)
    return
  }

  revalidatePath('/admin/orders')
  revalidatePath('/admin')
  revalidatePath('/profile/orders')
}
