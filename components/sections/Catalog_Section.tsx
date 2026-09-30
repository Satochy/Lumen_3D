import Link from 'next/link'
import { Box, Send, ChevronRight } from 'lucide-react'

interface Product {
  id: string
  title: string
  description: string | null
  price: number
  category: string | null
}

interface CatalogSectionProps {
  products: Product[]
  mainWhatsapp?: string
}

export default function Catalog_Section({ products, mainWhatsapp = '5515988324925' }: CatalogSectionProps) {
  return (
    <section data-reveal id="catalogo" className="py-16 max-w-6xl mx-auto px-6 w-full space-y-8">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-cyan-950 pb-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 block">Vitrine</span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white">Produtos em Catálogo</h2>
        </div>
        <p className="text-xs text-slate-400 max-w-xs">
          Modelos prontos para impressão e entrega.
        </p>
      </div>

      {products.length === 0 ? (
        <div className="text-center p-12 bg-[#0a0e1a] border border-cyan-950 rounded-2xl text-slate-500">
          Nenhum produto cadastrado no catálogo ainda.
        </div>
      ) : (
        <div className="space-y-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product, index) => {
              const msg = encodeURIComponent(`Olá! Gostaria de encomendar o produto "${product.title}" (R$ ${product.price.toFixed(2)}) na Lúmen 3D.`)
              const orderLink = `https://wa.me/${mainWhatsapp}?text=${msg}`

              return (
                /* Quadro do Produto com Animação Bounce Leve */
                <div
                  key={product.id}
                  data-reveal
                  data-reveal-delay={(index % 3) * 120}
                  className="hover-btn-bounce bg-[#0a0e1a] border border-cyan-950 hover:border-cyan-500/50 hover:bg-[#0d1325] hover:shadow-lg hover:shadow-cyan-500/10 rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 group cursor-default"
                >
                  <div className="space-y-4">
                    {/* Placeholder da Imagem */}
                    <div className="w-full h-48 bg-[#050811] rounded-xl border border-cyan-950 flex flex-col items-center justify-center text-cyan-500/40 group-hover:text-cyan-400 transition-colors duration-300">
                      <Box className="w-10 h-10 stroke-[1.5]" />
                      <span className="text-[10px] font-mono mt-2 text-slate-600">LÚMEN_3D_MODEL</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-900/50">
                        {product.category || 'Geral'}
                      </span>
                      <h3 className="font-bold text-lg text-white mt-2 group-hover:text-cyan-300 transition-colors duration-300 break-words">
                        {product.title}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                        {product.description || 'Peça impressa em 3D com alta precisão e acabamento exclusivo.'}
                      </p>
                    </div>
                  </div>

                  {/* Rodapé do Card */}
                  <div className="pt-4 border-t border-cyan-950 mt-5 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Valor</span>
                      <span className="text-xl font-extrabold text-cyan-400">
                        R$ {product.price.toFixed(2)}
                      </span>
                    </div>

                    {/* Botão Encomendar com Bounce Leve */}
                    <a
                      href={orderLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-fx hover-btn-bounce shrink-0 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold rounded-lg transition-all duration-300 flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
                    >
                      Encomendar
                      <Send className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Botão "Ver Mais Produtos" com Bounce Leve */}
          <div className="flex justify-center pt-4">
            <Link
              href="/marketplace"
              className="btn-fx hover-btn-bounce text-center max-[380px]:px-5 px-8 py-3.5 bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/60 hover:border-cyan-400/80 text-cyan-300 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all duration-300 flex items-center gap-2 group shadow-lg shadow-cyan-950/50"
            >
              <span>Ver Mais Produtos no Marketplace</span>
              <ChevronRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-1 transition-transform duration-200" />
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}