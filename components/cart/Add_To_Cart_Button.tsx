'use client'

import { useCart } from '@/context/Cart_Context'

interface AddToCartProduct {
  id: string
  title: string
  slug: string
  price: number
  images?: string[]
  stock?: number
  reservedStock?: number
  availableStock?: number
  isMadeToOrder?: boolean
  productionDays?: number | null
  weightGrams?: number | null
  dimensions?: string | null
}

export function AddToCartButton({ product }: { product: AddToCartProduct }) {
  const { addItem } = useCart()
  const isMadeToOrder = Boolean(product.isMadeToOrder)
  const availableStock =
    product.availableStock !== undefined
      ? Math.max(0, product.availableStock)
      : Math.max(0, (product.stock ?? 0) - (product.reservedStock ?? 0))
  const isMtoWithoutLeadTime =
    isMadeToOrder &&
    product.productionDays !== undefined &&
    (!product.productionDays || product.productionDays <= 0)
  const isSoldOut = (!isMadeToOrder && availableStock <= 0) || isMtoWithoutLeadTime

  const handleAddToCart = () => {
    if (isSoldOut) return
    addItem({
      productId: product.id,
      title: product.title,
      price: product.price,
      image: product.images?.[0] || '',
      slug: product.slug,
      stock: product.stock,
      reservedStock: product.reservedStock,
      isMadeToOrder,
      weightGrams: product.weightGrams,
      dimensions: product.dimensions,
    })
  }

  return (
    <button
      type="button"
      onClick={handleAddToCart}
      disabled={isSoldOut}
      className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-slate-950 text-xs font-bold px-4 py-2.5 min-h-10 rounded-lg transition"
    >
      {isMtoWithoutLeadTime
        ? 'Sob Consulta'
        : isSoldOut
          ? 'Esgotado'
          : isMadeToOrder
            ? 'Encomendar'
            : 'Adicionar ao Carrinho'}
    </button>
  )
}
