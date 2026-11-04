'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2, ArrowRight, Loader2, AlertCircle } from 'lucide-react'
import { useCart } from '@/context/Cart_Context'
import { formatCurrency } from '@/lib/format_currency'
import { createOrderAction } from '@/app/actions/order_actions'

export default function Cart_Page_Client() {
  const router = useRouter()
  const {
    cart,
    removeItem,
    updateQuantity,
    clearCart,
    totalAmount,
    totalItems,
    shipping,
    finalTotal,
  } = useCart()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleProceedToCheckout = async () => {
    if (!shipping || cart.length === 0 || isSubmitting) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await createOrderAction({
        items: cart.map((item) => ({
          productId: item.productId,
          variantId: item.variantId ?? null,
          productTitle: item.title,
          quantity: item.quantity,
          priceUnit: item.price,
        })),
        selectedShippingOption: {
          serviceId: shipping.serviceId,
          serviceName: shipping.serviceName,
          price: shipping.price,
          isFree: shipping.isFree,
          cep: shipping.cep,
        },
      })

      const createdOrderId = result.data?.orderId ?? result.orderId
      if (!result.success || !createdOrderId) {
        setErrorMessage(result.error || 'Não foi possível criar o seu pedido.')
        setIsSubmitting(false)
        return
      }

      clearCart()
      router.push('/marketplace/checkout/' + createdOrderId)
    } catch {
      setErrorMessage('Erro inesperado ao iniciar o checkout. Tente novamente.')
      setIsSubmitting(false)
    }
  }

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
                <div className="relative w-16 h-16 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="64px"
                      className="object-cover"
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
                    disabled={isSubmitting}
                    onClick={() =>
                      updateQuantity(item.productId, item.variantId, item.quantity - 1)
                    }
                    aria-label="Diminuir quantidade"
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition font-bold cursor-pointer disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-xs font-bold text-white">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() =>
                      updateQuantity(item.productId, item.variantId, item.quantity + 1)
                    }
                    aria-label="Aumentar quantidade"
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition font-bold cursor-pointer disabled:opacity-40"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => removeItem(item.productId, item.variantId)}
                  className="p-2 text-rose-400 hover:text-rose-300 transition cursor-pointer disabled:opacity-40"
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
            <span>
              Subtotal ({totalItems} {totalItems === 1 ? 'item' : 'itens'})
            </span>
            <span className="font-bold text-white">{formatCurrency(totalAmount)}</span>
          </div>

          <div className="flex justify-between text-slate-400 items-center">
            <span>Frete</span>
            {shipping ? (
              <div className="text-right">
                <span className="font-bold text-cyan-400 block">
                  {shipping.isFree ? 'Grátis' : formatCurrency(shipping.price)}
                </span>
                <span className="text-[9px] uppercase tracking-wider block mt-0.5">
                  {shipping.serviceName}
                </span>
              </div>
            ) : (
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

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p>{errorMessage}</p>
              {errorMessage.toLowerCase().includes('logado') && (
                <Link
                  href="/login"
                  className="inline-block font-bold text-cyan-400 hover:text-cyan-300 underline"
                >
                  Ir para o Login &rarr;
                </Link>
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={!shipping || isSubmitting}
          onClick={handleProceedToCheckout}
          className="w-full py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Gerando pedido...</span>
            </>
          ) : (
            <>
              <span>{shipping ? 'Continuar para Checkout' : 'Calcule o frete primeiro'}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <div className="text-[11px] text-slate-500 text-center space-y-1">
          <p>Compra 100% segura.</p>
        </div>
      </div>
    </div>
  )
}
