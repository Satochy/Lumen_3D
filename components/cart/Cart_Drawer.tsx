'use client'

import { useCart } from '@/context/Cart_Context'

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export default function Cart_Drawer({ isOpen, onClose }: CartDrawerProps) {
  const {
    cart,
    removeItem,
    updateQuantity,
    clearCart,
    totalAmount,
    totalItems,
  } = useCart()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      {/* Clique no fundo fecha a gaveta */}
      <div className="flex-1" onClick={onClose} />

      {/* Painel lateral do carrinho */}
      <div className="w-full max-w-md bg-[#050811] border-l border-slate-800/80 p-6 flex flex-col justify-between h-full text-slate-100 shadow-2xl">
        <div>
          {/* Topo do Drawer */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>🛒</span> Seu Carrinho ({totalItems})
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-sm font-bold transition p-1"
            >
              ✕
            </button>
          </div>

          {/* Lista de Itens no Carrinho */}
          <div className="mt-4 flex flex-col gap-3 max-h-[65vh] overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <p className="text-slate-400 text-xs py-16 text-center font-medium">
                Seu carrinho está vazio no momento.
              </p>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-white truncate">
                      {item.title}
                    </h4>
                    <p className="text-xs text-cyan-400 font-bold mt-0.5">
                      R$ {item.price.toFixed(2)}
                    </p>
                  </div>

                  {/* Controles de Quantidade e Exclusão */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-slate-800 bg-slate-950 rounded-lg overflow-hidden">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="px-2 py-1 text-slate-400 hover:text-white transition text-xs font-bold"
                      >
                        -
                      </button>
                      <span className="px-2 text-xs font-bold text-white">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="px-2 py-1 text-slate-400 hover:text-white transition text-xs font-bold"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-[11px] text-red-400 hover:text-red-300 font-semibold px-1 transition"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Rodapé do Carrinho com Totais e Ações */}
        <div className="pt-4 border-t border-slate-800/80 flex flex-col gap-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400 text-xs font-medium">Total:</span>
            <span className="text-lg font-black text-cyan-400">
              R$ {totalAmount.toFixed(2)}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={clearCart}
              disabled={cart.length === 0}
              className="px-3 py-2 bg-slate-900 text-slate-300 border border-slate-800 rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:opacity-40 transition"
            >
              Esvaziar
            </button>
            <button
              disabled={cart.length === 0}
              onClick={() => alert('Próxima etapa: Lógica de Checkout!')}
              className="flex-1 py-2 bg-cyan-500 text-slate-950 font-bold rounded-lg text-xs hover:bg-cyan-400 disabled:opacity-40 transition"
            >
              Finalizar Pedido
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}