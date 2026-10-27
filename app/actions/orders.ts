'use server'

import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
// Certifique-se de que PaymentStatus e LogisticsStatus existem no seu schema.prisma
import { PaymentStatus, LogisticsStatus } from '@prisma/client'
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

export async function updateLogisticsStatus(formData: FormData): Promise<void> {
  const orderId = String(formData.get('orderId') ?? '')
  const logisticsStatus = String(formData.get('logisticsStatus') ?? '') as LogisticsStatus

  if (!orderId) return

  try {
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
}

export async function updatePaymentStatus(formData: FormData): Promise<void> {
  const orderId = String(formData.get('orderId') ?? '')
  const paymentStatus = String(formData.get('paymentStatus') ?? '') as PaymentStatus

  if (!orderId) return

  try {
    await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus },
    })
  } catch (error) {
    console.error('Erro ao atualizar status de pagamento:', orderId, error)
    return
  }

  revalidatePath('/admin/orders')
  revalidatePath('/admin')
}