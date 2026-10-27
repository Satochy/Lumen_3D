'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2, ArrowRight } from 'lucide-react'
import { useCart } from '@/context/Cart_Context'
import { formatCurrency } from '@/lib/format_currency'
import Cart_Button from '@/components/cart/Cart_Button'

export default function Cart_Page_Client() {
  const router = useRouter()
  const { cart, removeItem, updateQuantity, totalAmount, totalItems, shipping, finalTotal } = useCart()

  if (cart.length === 0) {
    return (
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center space-y-4">
        <p className="text-slate-400 text-sm">Seu carrinho está vazio no momento.</p>
        <Link
          href="/marketplace"
          className="inline-block px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer"
        >
          Explorar Produtos
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-3">
          Itens ({totalItems})
        </h2>

        <div className="divide-y divide-slate-800/60">
          {cart.map((item) => (
            <div
              key={`${item.productId}-${item.variantId || 'base'}`}
              className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{item.title}</h3>
                  <p className="text-sm font-black text-cyan-400 mt-1">
                    {formatCurrency(item.price)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-4">
                <div className="flex items-center border border-slate-800 bg-slate-950 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      updateQuantity(item.productId, item.variantId, item.quantity - 1)
                    }
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-xs font-bold text-white">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateQuantity(item.productId, item.variantId, item.quantity + 1)
                    }
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(item.productId, item.variantId)}
                  className="p-2 text-rose-400 hover:text-rose-300 transition cursor-pointer"
                  aria-label="Remover item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 space-y-5">
        <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-3">
          Resumo do Pedido
        </h2>

        <div className="space-y-3 text-xs">
          <div className="flex justify-between text-slate-300">
            <span>Subtotal ({totalItems} {totalItems === 1 ? 'item' : 'itens'})</span>
            <span className="font-bold text-white">{formatCurrency(totalAmount)}</span>
          </div>
          
          <div className="flex justify-between text-slate-400 items-center">
            <span>Frete</span>
            {shipping ? (
               <div className="text-right">
                <span className="font-bold text-cyan-400 block">
                  {shipping.isFree ? 'Grátis' : formatCurrency(shipping.price)}
                </span>
                <span className="text-[9px] uppercase tracking-wider block mt-0.5">{shipping.serviceName}</span>
              </div>
            ) : (
                /* Caso o usuário esteja na página do carrinho e não tenha calculado o frete ainda, 
                   ele pode abrir a gaveta pelo Cart_Button que está oculto (simulado). 
                   O ideal é que o cálculo já tenha sido forçado pela gaveta, mas como fallback: */
               <span className="italic text-rose-400">Calcule o frete na aba lateral</span>
            )}
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
            <span className="text-sm font-bold text-white">Total Previsto</span>
            <span className="text-lg font-black text-cyan-400">
              {formatCurrency(finalTotal)}
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={!shipping}
          onClick={() => router.push('/marketplace/checkout')}
          className="w-full py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>{shipping ? 'Continuar para Checkout' : 'Calcule o frete primeiro'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <div className="text-[11px] text-slate-500 text-center space-y-1">
          <p>Compra 100% segura.</p>
        </div>
      </div>
    </div>
  )
}