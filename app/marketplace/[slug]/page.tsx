import { Header, Footer } from '@/components/layout'
import { prisma } from '@/lib/prisma'
import Cart_Button from '@/components/cart/Cart_Button'
import { notFound } from 'next/navigation'
import { AddToCartButton } from '@/components/cart/Add_To_Cart_Button'
import { serializeProduct, type PublicProduct } from '@/lib/product_helpers'
import { formatCurrency } from '@/lib/format_currency'
import { getCurrentUser } from '@/lib/auth'

interface ProductDetailPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params
  const user = await getCurrentUser()

  let product: PublicProduct | null = null
  try {
    // Busca estrita e direta pelo campo único @unique slug conforme o schema
    const row = await prisma.product.findUnique({
      where: { slug },
    })
    // Produto arquivado se comporta como inexistente para o público
    if (row && !row.archivedAt) {
      product = serializeProduct(row)
    }
  } catch (error) {
    console.error('Erro ao buscar produto:', error)
  }

  if (!product) {
    notFound()
  }

  const mainImage = product.images?.[0] || '/placeholder.png'

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans">
      <Header user={user} logoHref="/" actions={<Cart_Button />}>
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300"></nav>
      </Header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          
          {/* Galeria / Imagem do Produto */}
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-center min-h-[400px] lg:min-h-[500px] overflow-hidden relative">
            {product.images && product.images.length > 0 ? (
              <img
                src={mainImage}
                alt={product.title}
                className="w-full h-full object-cover rounded-xl"
              />
            ) : (
              <div className="text-center text-slate-600 flex flex-col items-center">
                <div className="w-16 h-16 border-2 border-cyan-500/40 rotate-45 mb-4 animate-pulse" />
                <span className="text-xs uppercase tracking-wider block font-semibold">LÚMEN_3D_MODEL</span>
              </div>
            )}
          </div>

          {/* Informações e Ações do Produto */}
          <div className="flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className="bg-cyan-500/10 text-cyan-400 text-xs uppercase font-bold tracking-wider px-3 py-1 rounded-full border border-cyan-500/20">
                  {product.category || 'Geral'}
                </span>
                <span className={`text-xs uppercase font-bold px-3 py-1 rounded-full border ${product.stock > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/25'}`}>
                  {product.stock > 0 ? `${product.stock} em estoque` : 'Esgotado'}
                </span>
              </div>

              <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                {product.title}
              </h1>

              <div className="mt-4">
                <span className="text-xs text-slate-500 uppercase font-medium block">Preço</span>
                <span className="text-3xl font-black text-cyan-400">
                  {formatCurrency(product.price)}
                </span>
              </div>

              <div className="mt-6 border-t border-slate-800/80 pt-6">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-2">
                  Descrição do Modelo
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {product.description || 'Peça impressa em 3D com alta precisão e acabamento exclusivo Lúmen 3D.'}
                </p>
              </div>

              {/* Especificações Técnicas */}
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="bg-slate-900/40 border border-slate-800/80 p-3 rounded-xl">
                  <span className="text-[10px] text-slate-500 uppercase block font-medium">Tecnologia</span>
                  <span className="text-xs font-bold text-slate-200">Impressão 3D FDM / Resina</span>
                </div>
                <div className="bg-slate-900/40 border border-slate-800/80 p-3 rounded-xl">
                  <span className="text-[10px] text-slate-500 uppercase block font-medium">Acabamento</span>
                  <span className="text-xs font-bold text-slate-200">Padrão Lúmen</span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800/80 flex items-center gap-4">
              <AddToCartButton product={product} />
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  )
}