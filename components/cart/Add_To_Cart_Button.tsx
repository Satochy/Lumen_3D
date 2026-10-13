'use client'

import { useCart } from '@/context/Cart_Context'

export function AddToCartButton({ product }: { product: any }) {
  const { addItem } = useCart()

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault() 
    e.stopPropagation()

    addItem({
      id: product.id,
      title: product.title,
      price: product.price,
      image: product.images?.[0] || '',
      slug: product.slug,
    })
  }

  return (
    <button
      onClick={handleAddToCart}
      disabled={product.stock <= 0}
      className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-slate-950 text-xs font-bold px-4 py-2 rounded-lg transition z-10 relative"
    >
      {product.stock > 0 ? 'Encomendar' : 'Indisponível'}
    </button>
  )
}