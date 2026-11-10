import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Header, Footer } from '@/components/layout'
import Profile_Navbar from '@/components/profile/Profile_Navbar'
import My_Orders_Client from '@/components/profile/My_Orders_Client'
import Cart_Button from '@/components/cart/Cart_Button'
import { getCurrentUser } from '@/lib/auth'
import { syncOrderWithMercadoPago } from '@/lib/mercadopago_sync'
import { getClientOrdersAction } from '@/app/actions/client_orders_actions'

export default async function UserOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; orderId?: string }>
}) {
  const [user, resolvedSearchParams] = await Promise.all([
    getCurrentUser(),
    searchParams ? searchParams : Promise.resolve(undefined),
  ])

  if (!user) {
    redirect('/login')
  }

  // Se o usuário acabou de ser redirecionado após pagamento de um pedido específico, sincroniza apenas esse pedido
  if (resolvedSearchParams?.orderId && resolvedSearchParams?.status === 'success') {
    await syncOrderWithMercadoPago(resolvedSearchParams.orderId)
  }

  const ordersResult = await getClientOrdersAction()
  const orders = ordersResult.data

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans">
      <Header user={user} logoHref="/" actions={<Cart_Button />}>
        <Profile_Navbar />
      </Header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Meus Pedidos</h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Acompanhe o status de pagamento, produção e entrega das suas encomendas.
            </p>
          </div>
          <Link
            href="/marketplace"
            aria-label="Explorar o catálogo de produtos no Marketplace"
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition w-fit"
          >
            Explorar Catálogo
          </Link>
        </div>

        <My_Orders_Client orders={orders} />
      </main>

      <Footer />
    </div>
  )
}
