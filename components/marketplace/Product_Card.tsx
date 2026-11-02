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
  reservedStock?: number
  availableStock?: number
  isMadeToOrder?: boolean
  productionDays?: number | null
  weightGrams?: number | null
  dimensions?: string | null
}

export default function Product_Card({ product }: { product: ProductProps }) {
  const router = useRouter()
  const { addItem } = useCart()

  const mainImage = product.images?.[0] || '/placeholder.png'
  const isMadeToOrder = Boolean(product.isMadeToOrder)
  const availableStock =
    product.availableStock !== undefined
      ? Math.max(0, product.availableStock)
      : Math.max(0, (product.stock ?? 0) - (product.reservedStock ?? 0))
  const isMtoWithoutLeadTime =
    isMadeToOrder && (!product.productionDays || product.productionDays <= 0)
  const isSoldOut = (!isMadeToOrder && availableStock <= 0) || isMtoWithoutLeadTime

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
        <span
          className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border backdrop-blur-sm ${
            isMadeToOrder
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              : availableStock > 0
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
          }`}
        >
          {isMadeToOrder
            ? 'Sob Encomenda'
            : availableStock > 0
              ? 'Pronta Entrega'
              : 'Esgotado'}
        </span>
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
          {isMadeToOrder && (
            <p className="text-[11px] text-amber-300/90 mt-1">
              {product.productionDays && product.productionDays > 0
                ? `Produção estimada: ${product.productionDays} dias úteis`
                : 'Prazo de produção a definir (sob consulta)'}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
          <span className="text-base font-black text-cyan-400">
            {formatCurrency(product.price)}
          </span>

          <button
            disabled={isSoldOut}
            onClick={(e) => {
              e.stopPropagation()
              if (isSoldOut) return
              addItem({
                productId: product.id,
                title: product.title,
                slug: product.slug,
                price: product.price,
                image: mainImage,
                stock: product.stock,
                reservedStock: product.reservedStock,
                isMadeToOrder,
                weightGrams: product.weightGrams,
                dimensions: product.dimensions,
              })
            }}
            className="px-3 py-2 min-h-10 bg-cyan-500 text-slate-950 font-bold text-xs rounded-lg hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed active:scale-95 transition"
          >
            {isMtoWithoutLeadTime
              ? 'Sob Consulta'
              : isSoldOut
                ? 'Esgotado'
                : '+ Carrinho'}
          </button>
        </div>
      </div>
    </div>
  )
}
