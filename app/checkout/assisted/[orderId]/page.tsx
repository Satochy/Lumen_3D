import { redirect } from 'next/navigation'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { XCircle } from 'lucide-react'
import { Header, Footer } from '@/components/layout'
import Cart_Button from '@/components/cart/Cart_Button'
import Assisted_Checkout_Unlock from '@/components/checkout/Assisted_Checkout_Unlock'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function AssistedCheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  const [user, cookieStore, order] = await Promise.all([
    getCurrentUser(),
    cookies(),
    prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        isAssistedSale: true,
        assistedSaleExpectedEmail: true,
        userId: true,
        logisticsStatus: true,
        cancelledAt: true,
      },
    }),
  ])

  if (!order || !order.isAssistedSale) {
    redirect('/marketplace')
  }

  // 1. Trava de Acesso (Link Revogado): verifica se o pedido foi cancelado ANTES do formulário de e-mail
  if (order.logisticsStatus === 'CANCELLED' || order.cancelledAt !== null) {
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

  const isUnlocked = cookieStore.get(`unlocked_order_${orderId}`)?.value === 'true'

  // Se já foi desbloqueado por cookie, avança diretamente ao checkout
  if (isUnlocked) {
    redirect(`/marketplace/checkout/${orderId}`)
  }

  const expectedEmail = order.assistedSaleExpectedEmail?.trim().toLowerCase()
  const userEmail = user?.email?.trim().toLowerCase()

  // Se o usuário já estiver logado E o email da sessão bater, redireciona de imediato
  if (user && expectedEmail && userEmail === expectedEmail) {
    if (order.userId !== user.id) {
      await prisma.order.update({
        where: { id: order.id },
        data: { userId: user.id },
      })
    }
    redirect(`/marketplace/checkout/${orderId}`)
  }

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans">
      <Header user={user} logoHref="/" actions={<Cart_Button />} />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <Assisted_Checkout_Unlock orderId={orderId} />
      </main>

      <Footer />
    </div>
  )
}
