import { Header, Footer } from '@/components/layout'
import { prisma } from '@/lib/prisma'
import Cart_Button from '@/components/cart/Cart_Button'
import Product_Card from '@/components/marketplace/Product_Card' 

async function getCurrentUser() {
  return {
    id: '1',
    name: 'Satochy',
    email: 'satochy@lumen3d.com',
    role: 'ADMIN',
    avatarUrl: null,
  }
}

export default async function MarketplacePage() {
  const user = await getCurrentUser()

  let products: any[] = []
  try {
    products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
    })
  } catch (error) {
    console.warn('Erro ao carregar produtos:', error)
  }

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans">
      <Header user={user} logoHref="/" actions={<Cart_Button />}>
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
        </nav>
      </Header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Marketplace</h1>
            <p className="text-sm text-slate-400 mt-1">
              Modelos e peças 3D prontos para encomenda com acabamento de alta qualidade.
            </p>
          </div>
          <span className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full w-fit">
            {products.length} {products.length === 1 ? 'produto disponível' : 'produtos disponíveis'}
          </span>
        </div>

        {/* Grid de Produtos usando o componente Product_Card oficial */}
        {products.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center my-12">
            <p className="text-slate-400 text-sm">Nenhum produto cadastrado no catálogo no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <Product_Card key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}