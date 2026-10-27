import { Header, Footer } from '@/components/layout'
import { getCurrentUser } from '@/lib/auth'
import Cart_Page_Client from '@/components/cart/Cart_Page_Client'

export default async function CartPage() {
  const user = await getCurrentUser()

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans">
      <Header user={user} logoHref="/">
        <div className="hidden md:flex items-center gap-3 text-xs font-bold tracking-wider uppercase">
          <span className="text-cyan-400 border-b-2 border-cyan-400 pb-1">Carrinho</span>
          <span className="text-slate-600">---------</span>
          <span className="text-slate-500">Entrega</span>
          <span className="text-slate-600">---------</span>
          <span className="text-slate-500">Pagamento</span>
        </div>
      </Header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Meu Carrinho</h1>
        <Cart_Page_Client />
      </main>

      <Footer />
    </div>
  )
}