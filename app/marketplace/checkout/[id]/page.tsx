import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Header, Footer } from '@/components/layout'
import Cart_Button from '@/components/cart/Cart_Button'
import Checkout_Client, {
  type SerializedCheckoutOrder,
  type ShippingSnapshotData,
} from '@/components/checkout/Checkout_Client'
import Assisted_Shipping_Step from '@/components/checkout/Assisted_Shipping_Step'
import { createPreferenceAction } from '@/app/actions/mercadopago_actions'
import { getCurrentUser } from '@/lib/auth'
import { syncOrderWithMercadoPago } from '@/lib/mercadopago_sync'
import { prisma } from '@/lib/prisma'

export default async function CheckoutOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  const cookieStore = await cookies()
  const isUnlocked = cookieStore.get(`unlocked_order_${id}`)?.value === 'true'

  // Se não estiver logado e NÃO tiver cookie de desbloqueio, redireciona para login
  if (!user && !isUnlocked) {
    redirect(`/login?redirect=/marketplace/checkout/${id}`)
  }

  const normalizedUserEmail = user?.email?.trim().toLowerCase()

  const order = await prisma.order.findFirst({
    where: {
      id,
      OR: [
        // Pedidos regulares do próprio comprador (não-venda assistida)
        ...(user ? [{ userId: user.id, isAssistedSale: false }] : []),
        // Venda assistida: EXCLUSIVAMENTE vinculada ao e-mail esperado do orçamento (Regra V21)
        ...(user && normalizedUserEmail
          ? [
              {
                isAssistedSale: true,
                assistedSaleExpectedEmail: { equals: normalizedUserEmail, mode: 'insensitive' as const },
              },
            ]
          : []),
        // Pedido assistido destrancado por cookie HttpOnly
        ...(isUnlocked ? [{ isAssistedSale: true }] : []),
        // Administradores da loja
        ...(user?.role === 'ADMIN' ? [{ isAssistedSale: true }] : []),
      ],
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
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

  // Regra V21: Bloqueia estritamente qualquer tentativa de outra conta assumir o pedido
  if (order.isAssistedSale) {
    const expected = order.assistedSaleExpectedEmail?.trim().toLowerCase()

    if (user && normalizedUserEmail) {
      const isOwner = Boolean(expected && normalizedUserEmail === expected)
      if (!isOwner && user.role !== 'ADMIN' && !isUnlocked) {
        redirect('/marketplace')
      }

      // Apenas vincula se comprovadamente for o titular legítimo do e-mail esperado
      if (isOwner && order.userId !== user.id) {
        await prisma.order.update({
          where: { id: order.id },
          data: { userId: user.id },
        })
      }
    } else if (!isUnlocked) {
      redirect('/marketplace')
    }
  }

  // Verifica se o endereço de entrega já foi preenchido com dados reais e válidos
  const snapshotData =
    order.shippingAddressSnapshot &&
    typeof order.shippingAddressSnapshot === 'object' &&
    !Array.isArray(order.shippingAddressSnapshot)
      ? (order.shippingAddressSnapshot as Record<string, unknown>)
      : null

  const hasShippingAddress = Boolean(
    snapshotData &&
      typeof snapshotData.street === 'string' &&
      snapshotData.street.trim().length > 0 &&
      typeof snapshotData.zipCode === 'string' &&
      snapshotData.zipCode.trim().length > 0 &&
      typeof snapshotData.number === 'string' &&
      snapshotData.number.trim().length > 0
  )

  // Para pedidos de venda assistida sem endereço de entrega preenchido, FORÇA a etapa de entrega
  if (order.isAssistedSale && !hasShippingAddress) {
    const itemsSummary = order.items.map((i) => ({
      title: i.productTitle,
      quantity: i.quantity,
      priceUnit: Number(i.priceUnit),
    }))
    const subtotal = itemsSummary.reduce(
      (acc, curr) => acc + curr.priceUnit * curr.quantity,
      0
    )

    return (
      <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans">
        <Header user={user} logoHref="/" actions={<Cart_Button />}>
          <div className="hidden md:flex items-center gap-3 text-xs font-bold tracking-wider uppercase">
            <span className="text-emerald-400 pb-1">✓ Orçamento</span>
            <span className="text-slate-600">---------</span>
            <span className="text-cyan-400 border-b-2 border-cyan-400 pb-1">Entrega</span>
            <span className="text-slate-600">---------</span>
            <span className="text-slate-500 pb-1">Pagamento</span>
          </div>
        </Header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Finalizar Orçamento — Endereço de Entrega
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Informe o endereço de entrega para calcularmos o frete e prosseguirmos para o pagamento.
            </p>
          </div>

          <Assisted_Shipping_Step
            orderId={order.id}
            subtotal={subtotal}
            itemsSummary={itemsSummary}
            defaultEmail={order.assistedSaleExpectedEmail}
          />
        </main>

        <Footer />
      </div>
    )
  }

  let effectivePaymentStatus = order.paymentStatus
  if (effectivePaymentStatus === 'PENDING') {
    const syncRes = await syncOrderWithMercadoPago(order.id)
    if (syncRes.isPaid) {
      effectivePaymentStatus = 'PAID'
    }
  }

  let preferenceId: string | null = null
  if (effectivePaymentStatus !== 'PAID') {
    const preferenceResult = await createPreferenceAction(order.id)
    if (preferenceResult.success) {
      preferenceId =
        preferenceResult.data?.preferenceId ?? preferenceResult.preferenceId ?? null
    }
  }

  const serializedOrder: SerializedCheckoutOrder = {
    id: order.id,
    paymentStatus: effectivePaymentStatus,
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
      productId: item.productId ?? '',
      productTitle: item.productTitle,
      quantity: item.quantity,
      priceUnit: Number(item.priceUnit),
      image: item.product?.images?.[0] ?? null,
      slug: item.product?.slug ?? null,
    })),
  }

  const payerEmail = user?.email || order.assistedSaleExpectedEmail || ''
  const payerName =
    user?.name || order.assistedSaleExpectedEmail?.split('@')[0] || 'Cliente'

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
          preferenceId={preferenceId}
          payerEmail={payerEmail}
          payerName={payerName}
        />
      </main>

      <Footer />
    </div>
  )
}
