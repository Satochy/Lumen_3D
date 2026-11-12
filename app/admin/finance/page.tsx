import { Suspense } from 'react'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Admin_Header from '@/components/admin/Admin_Header'
import Finance_Analytics_Client, {
  type SerializedFinanceOrder,
} from '@/components/admin/Finance_Analytics_Client'

export default async function AdminFinancePage() {
  await requireAdmin()

  const rawOrders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              title: true,
              slug: true,
              category: true,
              isMadeToOrder: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          phone: true,
          addresses: {
            select: {
              city: true,
              state: true,
              zipCode: true,
              neighborhood: true,
              isDefault: true,
            },
          },
        },
      },
    },
  })

  const serializedOrders: SerializedFinanceOrder[] = rawOrders.map((order) => ({
    id: order.id,
    userId: order.userId,
    paymentStatus: order.paymentStatus,
    logisticsStatus: order.logisticsStatus,
    totalAmount: Number(order.totalAmount),
    shippingCost: Number(order.shippingCost),
    isLocalDelivery: order.isLocalDelivery,
    isAssistedSale: order.isAssistedSale,
    assistedSaleExpectedEmail: order.assistedSaleExpectedEmail,
    adminNotes: order.adminNotes,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt ? order.paidAt.toISOString() : null,
    cancelledAt: order.cancelledAt ? order.cancelledAt.toISOString() : null,
    deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : null,
    shippingAddressSnapshot:
      (order.shippingAddressSnapshot as SerializedFinanceOrder['shippingAddressSnapshot']) ?? null,
    user: order.user
      ? {
          id: order.user.id,
          name: order.user.name,
          username: order.user.username,
          email: order.user.email,
          phone: order.user.phone,
          addresses: order.user.addresses.map((addr) => ({
            city: addr.city,
            state: addr.state,
            zipCode: addr.zipCode,
            neighborhood: addr.neighborhood,
            isDefault: addr.isDefault,
          })),
        }
      : null,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productTitle: item.productTitle,
      quantity: item.quantity,
      priceUnit: Number(item.priceUnit),
      isMadeToOrder: item.isMadeToOrder,
      productionDays: item.productionDays,
      product: item.product
        ? {
            id: item.product.id,
            title: item.product.title,
            slug: item.product.slug,
            category: item.product.category,
            isMadeToOrder: item.product.isMadeToOrder,
          }
        : null,
    })),
  }))

  return (
    <>
      <Admin_Header
        title="Módulo Financeiro"
        subtitle="Controle de caixa, inteligência de vendas, origens de receita e exportação contábil"
      />
      <Suspense fallback={null}>
        <Finance_Analytics_Client orders={serializedOrders} />
      </Suspense>
    </>
  )
}
