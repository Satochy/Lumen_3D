'use client'

import { useCart } from '@/context/Cart_Context'

interface AddToCartProduct {
  id: string
  title: string
  slug: string
  price: number
  images?: string[]
  stock?: number
}

export function AddToCartButton({ product }: { product: AddToCartProduct }) {
  const { addItem } = useCart()
  const isSoldOut = (product.stock ?? 0) <= 0

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      title: product.title,
      price: product.price,
      image: product.images?.[0] || '',
      slug: product.slug,
      stock: product.stock,
    })
  }

  return (
    <button
      type="button"
      onClick={handleAddToCart}
      disabled={isSoldOut}
      className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-slate-950 text-xs font-bold px-4 py-2.5 min-h-10 rounded-lg transition"
    >
      {isSoldOut ? 'Indisponível' : 'Encomendar'}
    </button>
  )
}
