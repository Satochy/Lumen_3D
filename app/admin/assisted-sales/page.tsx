import { Suspense } from 'react'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAvailableProductsForAssistedSaleAction } from '@/app/actions/assisted_sales_actions'
import Assisted_Sales_Client, {
  type SerializedAssistedOrder,
} from '@/components/admin/Assisted_Sales_Client'

export default async function AdminAssistedSalesPage({
  searchParams,
}: {
  searchParams?: Promise<{ action?: string }>
}) {
  await requireAdmin()

  const resolvedParams = searchParams ? await searchParams : undefined
  const defaultOpenCreateModal = resolvedParams?.action === 'new'

  const [productsResult, rawOrders] = await Promise.all([
    getAvailableProductsForAssistedSaleAction(),
    prisma.order.findMany({
      where: { isAssistedSale: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        paymentStatus: true,
        logisticsStatus: true,
        totalAmount: true,
        shippingCost: true,
        isLocalDelivery: true,
        isAssistedSale: true,
        assistedSaleExpectedEmail: true,
        shippingAddressSnapshot: true,
        adminNotes: true,
        createdAt: true,
        paidAt: true,
        cancelledAt: true,
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
          select: {
            id: true,
            productTitle: true,
            quantity: true,
            priceUnit: true,
            isMadeToOrder: true,
            productId: true,
          },
        },
      },
    }),
  ])

  const products = productsResult.success ? productsResult.data : []

  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '')

  const initialOrders: SerializedAssistedOrder[] = rawOrders.map((o) => {
    const snapshot =
      o.shippingAddressSnapshot &&
      typeof o.shippingAddressSnapshot === 'object' &&
      !Array.isArray(o.shippingAddressSnapshot)
        ? (o.shippingAddressSnapshot as Record<string, unknown>)
        : null

    let clientName: string | null =
      typeof snapshot?.recipientName === 'string' && snapshot.recipientName.trim()
        ? snapshot.recipientName.trim()
        : null

    if (!clientName && o.adminNotes) {
      const match = o.adminNotes.match(/\[Cliente:\s*([^\]]+)\]/)
      if (match?.[1]) {
        clientName = match[1].trim()
      }
    }

    if (!clientName && o.user?.name) {
      clientName = o.user.name
    }

    return {
      id: o.id,
      paymentStatus: o.paymentStatus as 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED',
      logisticsStatus: o.logisticsStatus,
      totalAmount: Number(o.totalAmount),
      shippingCost: Number(o.shippingCost),
      isLocalDelivery: o.isLocalDelivery,
      isAssistedSale: o.isAssistedSale,
      clientName,
      assistedSaleExpectedEmail: o.assistedSaleExpectedEmail,
      shippingAddressSnapshot: snapshot,
      adminNotes: o.adminNotes,
      createdAt: o.createdAt.toISOString(),
      paidAt: o.paidAt ? o.paidAt.toISOString() : null,
      cancelledAt: o.cancelledAt ? o.cancelledAt.toISOString() : null,
      checkoutUrl: `${baseUrl}/checkout/assisted/${o.id}`,
      user: o.user,
      items: o.items.map((i) => ({
        id: i.id,
        productTitle: i.productTitle,
        quantity: i.quantity,
        priceUnit: Number(i.priceUnit),
        isMadeToOrder: i.isMadeToOrder,
        productId: i.productId,
      })),
    }
  })

  return (
    <Suspense fallback={null}>
      <Assisted_Sales_Client
        products={products}
        initialOrders={initialOrders}
        defaultOpenCreateModal={defaultOpenCreateModal}
      />
    </Suspense>
  )
}
