import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function AssistedCheckoutRedirectPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  const user = await getCurrentUser()

  if (!user) {
    redirect(`/login?redirect=/checkout/assisted/${orderId}`)
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      isAssistedSale: true,
      assistedSaleExpectedEmail: true,
    },
  })

  if (!order || !order.isAssistedSale) {
    redirect('/marketplace')
  }

  // Se o pedido ainda não possuía userId, vincula ao comprador autenticado
  if (!order.userId) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        userId: user.id,
      },
    })
  }

  redirect(`/marketplace/checkout/${order.id}`)
}
