'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCart } from '@/context/Cart_Context'
import { formatCurrency } from '@/lib/format_currency'

interface ProductProps {
  id: string
  title: string
  slug: string
  price: number
  images: string[]
  category: string
  stock?: number
  weightGrams?: number | null
  dimensions?: string | null
}

export default function Product_Card({ product }: { product: ProductProps }) {
  const router = useRouter()
  const { addItem } = useCart()

  const mainImage = product.images?.[0] || '/placeholder.png'

  return (
    <div
      onClick={() => router.push(`/marketplace/${product.slug}`)}
      className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col justify-between hover:border-slate-700 transition group cursor-pointer"
    >
      {/* Imagem do Produto */}
      <div className="relative aspect-square w-full bg-slate-950 overflow-hidden">
        <Image
          src={mainImage}
          alt={product.title}
          fill
          className="object-cover group-hover:scale-105 transition duration-300"
        />
      </div>

      {/* Informações e Botão de Ação */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
            {product.category}
          </span>
          <h3 className="text-sm font-bold text-white mt-1 line-clamp-1">
            {product.title}
          </h3>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
          <span className="text-base font-black text-cyan-400">
            {formatCurrency(product.price)}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation()
              addItem({
                id: product.id,
                title: product.title,
                slug: product.slug,
                price: product.price,
                image: mainImage,
                stock: product.stock,
                weightGrams: product.weightGrams,
                dimensions: product.dimensions,
              })
            }}
            className="px-3 py-2 min-h-10 bg-cyan-500 text-slate-950 font-bold text-xs rounded-lg hover:bg-cyan-400 active:scale-95 transition"
          >
            + Carrinho
          </button>
        </div>
      </div>
    </div>
  )
}