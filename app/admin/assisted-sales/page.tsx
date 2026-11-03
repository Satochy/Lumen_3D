import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAvailableProductsForAssistedSaleAction } from '@/app/actions/assisted_sales_actions'
import Assisted_Sales_Client, {
  type SerializedAssistedOrder,
} from '@/components/admin/Assisted_Sales_Client'

export default async function AdminAssistedSalesPage() {
  await requireAdmin()

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
        assistedSaleExpectedEmail: true,
        adminNotes: true,
        createdAt: true,
        paidAt: true,
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

  const initialOrders: SerializedAssistedOrder[] = rawOrders.map((o) => ({
    id: o.id,
    paymentStatus: o.paymentStatus as 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED',
    logisticsStatus: o.logisticsStatus,
    totalAmount: Number(o.totalAmount),
    assistedSaleExpectedEmail: o.assistedSaleExpectedEmail,
    adminNotes: o.adminNotes,
    createdAt: o.createdAt.toISOString(),
    paidAt: o.paidAt ? o.paidAt.toISOString() : null,
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
  }))

  return <Assisted_Sales_Client products={products} initialOrders={initialOrders} />
}
