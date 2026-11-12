import { redirect } from 'next/navigation'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { XCircle } from 'lucide-react'
import { Header, Footer } from '@/components/layout'
import Cart_Button from '@/components/cart/Cart_Button'
import { isOrderExpired } from '@/lib/order_presenter'
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
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ status?: string; payment_id?: string }>
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve(undefined),
  ])
  const user = await getCurrentUser()
  const normalizedUserEmail = user?.email?.trim().toLowerCase()

  const order = await prisma.order.findFirst({
    where: {
      id,
      OR: [
        // Venda assistida pode ser acessada livremente pelo link sem bloqueio de conta
        { isAssistedSale: true },
        // Pedidos regulares do próprio comprador
        ...(user ? [{ userId: user.id }] : []),
      ],
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
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
    if (!user) {
      redirect(`/login?redirect=/marketplace/checkout/${id}`)
    }
    redirect('/marketplace')
  }

  // 1. Trava de Acesso (Link Revogado/Expirado): se o pedido foi cancelado ou expirou por timeout comercial, interrompe o checkout
  if (order.logisticsStatus === 'CANCELLED' || order.cancelledAt !== null || isOrderExpired(order)) {
    return (
      <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans">
        <Header user={user} logoHref="/" actions={<Cart_Button />} />

        <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-16 flex items-center justify-center">
          <div className="w-full bg-[#0a0e1a] border border-slate-800/90 rounded-2xl p-8 sm:p-12 text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <XCircle className="w-8 h-8" aria-hidden="true" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                Link Expirado ou Cancelado
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
                Este pedido foi cancelado pelo administrador. Entre em contato pelo WhatsApp para gerar um novo orçamento ou acesse o nosso catálogo.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/marketplace"
                className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition btn-fx"
              >
                Voltar ao Marketplace
              </Link>
              {user && (
                <Link
                  href="/profile/orders"
                  className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold transition"
                >
                  Meus Pedidos
                </Link>
              )}
            </div>
          </div>
        </main>

        <Footer />
      </div>
    )
  }

  // Se for venda assistida e o comprador logado tiver o mesmo e-mail esperado, vincula silenciosamente sem bloquear outras contas
  if (order.isAssistedSale && user && normalizedUserEmail) {
    const expected = order.assistedSaleExpectedEmail?.trim().toLowerCase()
    if (expected && normalizedUserEmail === expected && order.userId !== user.id) {
      await prisma.order.update({
        where: { id: order.id },
        data: { userId: user.id },
      })
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
  const hasReturnedFromGateway = Boolean(
    resolvedSearchParams?.status === 'success' || resolvedSearchParams?.payment_id
  )

  // Sincroniza com a API do Mercado Pago apenas se o comprador retornou de redirect com status/payment_id.
  // Evita chamadas remotas de busca síncronas bloqueando o SSR nos acessos regulares.
  if (effectivePaymentStatus === 'PENDING' && hasReturnedFromGateway) {
    const syncRes = await syncOrderWithMercadoPago(order.id, resolvedSearchParams?.payment_id)
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

  const snapshotRecipientName =
    snapshotData && typeof snapshotData.recipientName === 'string' && snapshotData.recipientName.trim()
      ? snapshotData.recipientName.trim()
      : null

  const snapshotExpectedEmail =
    snapshotData && typeof snapshotData.expectedEmail === 'string' && snapshotData.expectedEmail.trim()
      ? snapshotData.expectedEmail.trim()
      : null

  const notesClientNameMatch = order.adminNotes?.match(/\[Cliente:\s*([^\]]+)\]/)
  const notesClientName = notesClientNameMatch?.[1]?.trim() || null

  const payerEmail =
    (order.isAssistedSale
      ? order.assistedSaleExpectedEmail || snapshotExpectedEmail || order.user?.email || user?.email
      : user?.email || order.user?.email) || ''

  const payerName =
    (order.isAssistedSale
      ? snapshotRecipientName || notesClientName || order.user?.name || order.assistedSaleExpectedEmail?.split('@')[0]
      : user?.name || order.user?.name) || 'Cliente'

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
