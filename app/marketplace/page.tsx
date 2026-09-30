import { Header, Footer } from '@/components/layout'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import Cart_Button from '@/components/cart/Cart_Button'

// Mock temporário enquanto não implementamos a auth real
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
      {/* Header com User + Links Próprios do Marketplace */}
      <Header user={user} logoHref="/" actions={<Cart_Button />}>
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
        </nav>
      </Header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 space-y-8">
        {/* Cabeçalho do Marketplace */}
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

        {/* Grid de Produtos */}
        {products.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center my-12">
            <p className="text-slate-400 text-sm">Nenhum produto cadastrado no catálogo no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between hover:border-cyan-500/40 transition duration-200 group"
              >
                <div>
                  {/* Container da Imagem */}
                  <div className="w-full h-48 bg-slate-950 rounded-xl flex items-center justify-center border border-slate-800/80 overflow-hidden relative mb-4">
                    {product.images && product.images.length > 0 ? (
                      <img
                        src={product.images[0]}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="text-center text-slate-600 flex flex-col items-center">
                        <div className="w-10 h-10 border-2 border-cyan-500/40 rotate-45 mb-2 group-hover:rotate-90 transition duration-500" />
                        <span className="text-[10px] uppercase tracking-wider block font-semibold">LÚMEN_3D_MODEL</span>
                      </div>
                    )}
                  </div>

                  {/* Categoria e Status de Estoque */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="bg-cyan-500/10 text-cyan-400 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-cyan-500/20">
                      {product.category || 'Geral'}
                    </span>
                    {product.stock <= 0 && (
                      <span className="bg-rose-500/10 text-rose-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-rose-500/20">
                        Esgotado
                      </span>
                    )}
                  </div>

                  {/* Título e Descrição */}
                  <h3 className="text-base font-bold text-slate-100 group-hover:text-cyan-400 transition line-clamp-1">
                    {product.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                    {product.description || 'Peça impressa em 3D com alta precisão e acabamento exclusivo.'}
                  </p>
                </div>

                {/* Preço e Ação */}
                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Valor</span>
                    <span className="text-base font-extrabold text-cyan-400">
                      R$ {product.price.toFixed(2)}
                    </span>
                  </div>
                  <button
                    disabled={product.stock <= 0}
                    className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-slate-950 text-xs font-bold px-4 py-2 rounded-lg transition"
                  >
                    {product.stock > 0 ? 'Encomendar' : 'Indisponível'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}