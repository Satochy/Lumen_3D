import { requireAdmin } from '@/lib/auth'
import { getOrders } from '@/app/actions/orders'
import Orders_Manager_Client, {
  type SerializedAdminOrder,
  type SerializedShippingAddressSnapshot,
} from '@/components/admin/Orders_Manager_Client'

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>
}) {
  await requireAdmin()

  const resolvedParams = searchParams ? await searchParams : undefined
  const defaultTab = resolvedParams?.tab || 'todos'

  const result = await getOrders()
  const rawOrders = result.success && result.data ? result.data : []

  // Serialização rigorosa para a fronteira Server/Client (sem Prisma.Decimal)
  const serializedOrders: SerializedAdminOrder[] = rawOrders.map((o) => ({
    id: o.id,
    userId: o.userId,
    paymentStatus: o.paymentStatus,
    logisticsStatus: o.logisticsStatus,
    totalAmount: Number(o.totalAmount),
    shippingCost: Number(o.shippingCost),
    trackingCode: o.trackingCode,
    isLocalDelivery: o.isLocalDelivery,
    isAssistedSale: o.isAssistedSale,
    adminNotes: o.adminNotes,
    externalPaymentId: o.externalPaymentId,
    paymentMethod: o.paymentMethod,
    hasOpenOccurrence: o.hasOpenOccurrence,
    expiresAt: o.expiresAt ? o.expiresAt.toISOString() : null,
    paidAt: o.paidAt ? o.paidAt.toISOString() : null,
    cancelledAt: o.cancelledAt ? o.cancelledAt.toISOString() : null,
    shippedAt: o.shippedAt ? o.shippedAt.toISOString() : null,
    deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : null,
    createdAt: o.createdAt.toISOString(),
    user: o.user,
    shippingAddressSnapshot:
      (o.shippingAddressSnapshot as unknown as SerializedShippingAddressSnapshot | null) ?? null,
    items: o.items.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      variantId: item.variantId,
      productTitle: item.productTitle,
      quantity: item.quantity,
      priceUnit: Number(item.priceUnit),
      isMadeToOrder: item.isMadeToOrder,
      productionDays: item.productionDays,
      isReady: item.isReady,
      readyAt: item.readyAt ? item.readyAt.toISOString() : null,
      readyByUserId: item.readyByUserId,
      product: item.product,
    })),
    occurrences: o.occurrences.map((occ) => ({
      id: occ.id,
      orderId: occ.orderId,
      type: occ.type,
      status: occ.status,
      description: occ.description,
      metadata: (occ.metadata as Record<string, unknown> | null) ?? null,
      createdAt: occ.createdAt.toISOString(),
    })),
  }))

  return <Orders_Manager_Client initialOrders={serializedOrders} defaultTab={defaultTab} />
}
