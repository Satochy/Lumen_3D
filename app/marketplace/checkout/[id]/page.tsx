import { redirect } from 'next/navigation'
import { Header, Footer } from '@/components/layout'
import Cart_Button from '@/components/cart/Cart_Button'
import Checkout_Client, {
  type SerializedCheckoutOrder,
  type ShippingSnapshotData,
} from '@/components/checkout/Checkout_Client'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function CheckoutOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const order = await prisma.order.findFirst({
    where: {
      id,
      userId: user.id,
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              images: true,
              slug: true,
            },
          },
        },
      },
    },
  })

  if (!order) {
    redirect('/marketplace')
  }

  const serializedOrder: SerializedCheckoutOrder = {
    id: order.id,
    paymentStatus: order.paymentStatus,
    logisticsStatus: order.logisticsStatus,
    totalAmount: Number(order.totalAmount),
    shippingCost: Number(order.shippingCost),
    isLocalDelivery: order.isLocalDelivery,
    createdAt: order.createdAt.toISOString(),
    shippingAddressSnapshot:
      order.shippingAddressSnapshot &&
      typeof order.shippingAddressSnapshot === 'object' &&
      !Array.isArray(order.shippingAddressSnapshot)
        ? (order.shippingAddressSnapshot as unknown as ShippingSnapshotData)
        : null,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productTitle: item.productTitle,
      quantity: item.quantity,
      priceUnit: Number(item.priceUnit),
      image: item.product?.images?.[0] ?? null,
      slug: item.product?.slug ?? null,
    })),
  }

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans">
      <Header user={user} logoHref="/" actions={<Cart_Button />}>
        <div className="hidden md:flex items-center gap-3 text-xs font-bold tracking-wider uppercase">
          <span className="text-emerald-400 pb-1">✓ Carrinho</span>
          <span className="text-slate-600">---------</span>
          <span className="text-emerald-400 pb-1">✓ Entrega</span>
          <span className="text-slate-600">---------</span>
          <span className="text-cyan-400 border-b-2 border-cyan-400 pb-1">Pagamento</span>
        </div>
      </Header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Finalizar Pagamento
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Confira o resumo do seu pedido e conclua o pagamento com segurança.
          </p>
        </div>

        <Checkout_Client
          order={serializedOrder}
          payerEmail={user.email}
          payerName={user.name}
        />
      </main>

      <Footer />
    </div>
  )
}
