'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/context/Cart_Context'
import { formatCurrency } from '@/lib/format_currency'
import { calculateShippingAction } from '@/app/actions/shipping_actions'
import { getUserDefaultCepAction } from '@/app/actions/profile_actions'

interface ShippingOption {
  serviceId: string
  serviceName: string
  companyName: string
  price: number
  formattedPrice: string
  deliveryTime: number
  icon: string
  isFree?: boolean
}

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export default function Cart_Drawer({ isOpen, onClose }: CartDrawerProps) {
  const router = useRouter()
  const {
    cart,
    shipping, // Lê o frete global
    setShipping, // Atualiza o frete global
    removeItem,
    updateQuantity,
    clearCart,
    totalAmount,
    totalItems,
    finalTotal
  } = useCart()

  const [isShippingTabOpen, setIsShippingTabOpen] = useState(false)
  
  // Inicia o CEP com o salvo no estado global, se houver
  const [cep, setCep] = useState(shipping?.cep || '') 
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([])
  
  // O ID selecionado agora reflete o estado global
  const [selectedShippingId, setSelectedShippingId] = useState<string | null>(shipping?.serviceId || null) 
  const [shippingLoading, setShippingLoading] = useState(false)
  const [shippingError, setShippingError] = useState<string | null>(null)

  // Dispara auto-cálculo SE o usuário logar e NÃO houver frete salvo no contexto
  useEffect(() => {
    if (!isOpen) {
      setIsShippingTabOpen(false)
      return
    }

    let isMounted = true

    async function initializeShipping() {
      if (cart.length === 0 || shipping) return // Se já tem frete, não auto-calcula

      let currentCep = cep
      
      if (!currentCep) {
        const res = await getUserDefaultCepAction()
        if (isMounted && res.success && res.data?.zipCode) {
          currentCep = res.data.zipCode.replace(/\D/g, '').slice(0, 8)
          if (currentCep.length === 8) {
            setCep(currentCep)
          }
        }
      }

      if (currentCep.length === 8 && shippingOptions.length === 0 && isMounted) {
        setShippingLoading(true)
        setShippingError(null)

        const shippingItems = cart.map((item) => ({
          weightGrams: item.weightGrams ?? 200,
          dimensions: item.dimensions ?? '15x10x5',
          quantity: item.quantity,
        }))

        try {
          const result = await calculateShippingAction(currentCep, shippingItems)
          if (isMounted) {
            if (result.error) {
              setShippingError(result.error)
              setShippingOptions([])
            } else {
              setShippingOptions(result.options)
              if (result.options.length > 0) {
                const freeOption = result.options.find((o: any) => o.isFree)
                const optionToSelect = freeOption || result.options[0]
                setSelectedShippingId(optionToSelect.serviceId)
                
                // Já salva automaticamente no Contexto Global
                setShipping({
                  serviceId: optionToSelect.serviceId,
                  serviceName: optionToSelect.serviceName,
                  price: optionToSelect.price,
                  isFree: optionToSelect.isFree,
                  cep: currentCep
                })
              }
            }
          }
        } catch {
          if (isMounted) setShippingError('Erro ao calcular frete automático')
        } finally {
          if (isMounted) setShippingLoading(false)
        }
      }
    }

    initializeShipping()

    return () => {
      isMounted = false
    }
  }, [isOpen, cart.length, shipping]) // Depende de shipping também

  if (!isOpen) return null

  const handleCepChange = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 8)
    setCep(numbers)
    if (numbers.length === 8) {
      setShippingError(null)
    }
  }
  const displayCep = cep.length > 5 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep
  const isValidCEP = cep.length === 8

  const handleCalculateShipping = async () => {
    if (!isValidCEP) {
      setShippingError('CEP deve ter 8 dígitos')
      return
    }

    setShippingLoading(true)
    setShippingError(null)

    const shippingItems = cart.map((item) => ({
      weightGrams: item.weightGrams ?? 200,
      dimensions: item.dimensions ?? '15x10x5',
      quantity: item.quantity,
    }))

    try {
      const result = await calculateShippingAction(cep, shippingItems)
      if (result.error) {
        setShippingError(result.error)
        setShippingOptions([])
        setShipping(null) // Limpa global em caso de erro
      } else {
        setShippingOptions(result.options)
        if (result.options.length > 0) {
           // Reseta a seleção visual, obrigando o cliente a confirmar
           setSelectedShippingId(null)
        }
      }
    } catch {
      setShippingError('Erro ao calcular frete')
    } finally {
      setShippingLoading(false)
    }
  }
  
  // Ao clicar em Confirmar Frete, salva no Contexto Global
  const handleConfirmShipping = () => {
     const selectedOption = shippingOptions.find(opt => opt.serviceId === selectedShippingId)
     if(selectedOption) {
        setShipping({
            serviceId: selectedOption.serviceId,
            serviceName: selectedOption.serviceName,
            price: selectedOption.price,
            isFree: selectedOption.isFree,
            cep: cep
        })
     }
     setIsShippingTabOpen(false)
  }

  const handleGoToCartPage = () => {
    onClose()
    router.push('/marketplace/cart')
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <div className="flex-1" onClick={onClose} />

      <div className="w-full max-w-md bg-[#050811] border-l border-slate-800/80 p-4 sm:p-6 flex flex-col h-[100dvh] text-slate-100 shadow-2xl">
        {isShippingTabOpen ? (
          <>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 shrink-0">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <button
                  onClick={() => setIsShippingTabOpen(false)}
                  className="mr-2 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
                  aria-label="Voltar para o carrinho"
                >
                  ←
                </button>
                🚚 Opções de Entrega
              </h2>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-white text-sm font-bold transition"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 flex-1 overflow-y-auto space-y-5 pr-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Informe seu CEP
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={displayCep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition"
                    disabled={shippingLoading}
                  />
                  <button
                    onClick={handleCalculateShipping}
                    disabled={!isValidCEP || shippingLoading}
                    className="px-5 py-3 bg-cyan-500 text-slate-950 font-bold rounded-lg text-sm hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition whitespace-nowrap"
                  >
                    {shippingLoading ? 'Calculando...' : 'Calcular'}
                  </button>
                </div>
                {shippingError && <p className="text-xs text-red-400 mt-1">{shippingError}</p>}
              </div>

              {shippingOptions.length > 0 && (
                <div className="space-y-3" role="radiogroup">
                  {shippingOptions.map((option) => (
                    <label
                      key={option.serviceId}
                      className={`flex items-center justify-between p-4 rounded-xl border-2 transition cursor-pointer ${
                        selectedShippingId === option.serviceId
                          ? 'border-cyan-400 bg-cyan-500/10'
                          : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="shipping"
                          value={option.serviceId}
                          checked={selectedShippingId === option.serviceId}
                          onChange={() => setSelectedShippingId(option.serviceId)}
                          className="w-5 h-5 text-cyan-500 border-slate-700 focus:ring-cyan-400 accent-cyan-500"
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-white">
                              {option.serviceName}
                            </span>
                            {option.isFree && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase">
                                Grátis
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {option.companyName} • Entrega em {option.deliveryTime} dia
                            {option.deliveryTime !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-black text-cyan-400 shrink-0">
                        {option.formattedPrice}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800/80 shrink-0">
              <button
                onClick={handleConfirmShipping}
                disabled={!selectedShippingId}
                className="w-full py-3.5 bg-cyan-500 text-slate-950 font-bold rounded-xl text-sm hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                Confirmar Frete e Voltar
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 shrink-0">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>🛒</span> Seu Carrinho ({totalItems})
              </h2>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-white text-sm font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-60">
                  <span className="text-4xl">🛍️</span>
                  <p className="text-slate-400 text-sm font-medium">
                    Seu carrinho está vazio.
                  </p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={`${item.productId}-${item.variantId || 'base'}`}
                    className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-white truncate">
                        {item.title}
                      </h4>
                      <p className="text-xs text-cyan-400 font-bold mt-0.5">
                        {formatCurrency(item.price)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center border border-slate-800 bg-slate-950 rounded-lg overflow-hidden">
                        <button
                          onClick={() =>
                            updateQuantity(item.productId, item.variantId, item.quantity - 1)
                          }
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition font-bold cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.productId, item.variantId, item.quantity + 1)
                          }
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition font-bold cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.productId, item.variantId)}
                        className="text-[11px] text-red-400 hover:text-red-300 font-semibold px-2 py-2 transition cursor-pointer"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-5 border-t border-slate-800/80 flex flex-col gap-4 shrink-0 mt-2">
              <div className="space-y-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800/50">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 text-xs font-medium">Subtotal</span>
                  <span className="text-sm font-semibold text-slate-200">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm py-1">
                  <span className="text-slate-400 text-xs font-medium">Frete</span>

                  {shipping ? (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-sm font-bold text-cyan-400 block leading-none">
                          {shipping.isFree ? 'Grátis' : formatCurrency(shipping.price)}
                        </span>
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest block mt-1">
                          {shipping.serviceName}
                        </span>
                      </div>
                      <button
                        onClick={() => setIsShippingTabOpen(true)}
                        className="text-[10px] font-bold text-slate-400 hover:text-cyan-400 bg-slate-950 border border-slate-800 px-2 py-1.5 rounded-lg transition cursor-pointer"
                      >
                        Alterar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsShippingTabOpen(true)}
                      className="px-3 py-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg text-xs font-bold hover:bg-cyan-500/20 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>🚚</span> Calcular Frete
                    </button>
                  )}
                </div>

                <div className="flex justify-between items-center text-lg border-t border-slate-800 pt-3 mt-1">
                  <span className="text-slate-300 font-medium text-sm">Total</span>
                  <span className="text-xl font-black text-cyan-400">
                    {formatCurrency(finalTotal)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={clearCart}
                  disabled={cart.length === 0}
                  className="px-4 py-3 bg-slate-900 text-slate-300 border border-slate-800 rounded-xl text-xs font-semibold hover:bg-slate-800 disabled:opacity-40 transition cursor-pointer"
                >
                  Esvaziar
                </button>
                <button
                  disabled={cart.length === 0}
                  onClick={handleGoToCartPage}
                  className="flex-1 py-3 bg-cyan-500 text-slate-950 font-bold rounded-xl text-sm hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  Fazer Pedido
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}