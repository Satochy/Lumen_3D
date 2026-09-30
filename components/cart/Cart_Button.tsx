'use client'

import { useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import { useCart } from '@/context/Cart_Context'
import Cart_Drawer from '@/components/cart/Cart_Drawer'

export default function Cart_Button() {
  const [isOpen, setIsOpen] = useState(false)
  const { totalItems } = useCart()

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="relative p-2.5 text-slate-300 hover:text-cyan-400 bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 rounded-xl transition flex items-center justify-center"
        title="Ver Carrinho"
      >
        <ShoppingBag className="w-5 h-5" />
        
        {totalItems > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-cyan-500 text-slate-950 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-lg shadow-cyan-500/30">
            {totalItems}
          </span>
        )}
      </button>

      <Cart_Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}