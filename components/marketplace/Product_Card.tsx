'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/context/Cart_Context'

interface ProductProps {
  id: string
  title: string
  slug: string
  price: number
  images: string[]
  category: string
  stock?: number
}

export default function Product_Card({ product }: { product: ProductProps }) {
  const { addItem } = useCart()

  const mainImage = product.images?.[0] || '/placeholder.png'

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col justify-between hover:border-slate-700 transition group">
      {/* Imagem do Produto */}
      <Link href={`/marketplace/${product.slug}`} className="block relative aspect-square w-full bg-slate-950 overflow-hidden">
        <Image
          src={mainImage}
          alt={product.title}
          fill
          className="object-cover group-hover:scale-105 transition duration-300"
        />
      </Link>

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
            R$ {product.price.toFixed(2)}
          </span>

          <button
            onClick={() =>
              addItem({
                id: product.id,
                title: product.title,
                slug: product.slug,
                price: product.price,
                image: mainImage,
                stock: product.stock,
              })
            }
            className="px-3 py-1.5 bg-cyan-500 text-slate-950 font-bold text-xs rounded-lg hover:bg-cyan-400 active:scale-95 transition"
          >
            + Carrinho
          </button>
        </div>
      </div>
    </div>
  )
}