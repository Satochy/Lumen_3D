'use client'

import React, { useState, useTransition } from 'react'
import {
  MapPin,
  Truck,
  Loader2,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Package,
} from 'lucide-react'
import { formatCurrency } from '@/lib/format_currency'
import {
  calculateAssistedSaleShippingAction,
  saveAssistedOrderShippingAction,
} from '@/app/actions/assisted_sales_actions'
import type { ShippingOption } from '@/app/actions/shipping_actions'
import { isValidCPF, formatCPF } from '@/lib/shipping/shipping_utils'

interface AssistedShippingStepProps {
  orderId: string
  subtotal: number
  itemsSummary: Array<{
    title: string
    quantity: number
    priceUnit: number
  }>
  defaultEmail?: string | null
}

export default function Assisted_Shipping_Step({
  orderId,
  subtotal,
  itemsSummary,
  defaultEmail,
}: AssistedShippingStepProps) {
  const [isPending, startTransition] = useTransition()

  // Estados do formulário de endereço
  const [zipCode, setZipCode] = useState('')
  const [cpf, setCpf] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [complement, setComplement] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')

  const handleCpfChange = (value: string) => {
    setCpf(formatCPF(value))
  }

  // Estados de frete
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([])
  const [selectedOption, setSelectedOption] = useState<ShippingOption | null>(null)
  const [isLoadingShipping, setIsLoadingShipping] = useState(false)
  const [shippingError, setShippingError] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleCepChange = async (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 8)
    const formatted = raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw
    setZipCode(formatted)

    if (raw.length === 8) {
      setIsLoadingShipping(true)
      setShippingError(null)

      try {
        // Busca automática no ViaCEP
        const viaCepRes = await fetch(`https://viacep.com.br/ws/${raw}/json/`)
        if (viaCepRes.ok) {
          const viaCepData = await viaCepRes.json()
          if (!viaCepData.erro) {
            setStreet(viaCepData.logradouro || '')
            setNeighborhood(viaCepData.bairro || '')
            setCity(viaCepData.localidade || '')
            setState(viaCepData.uf || '')
          }
        }

        // Cotação de frete no servidor
        const quoteRes = await calculateAssistedSaleShippingAction(orderId, raw)
        if (quoteRes.success && quoteRes.options.length > 0) {
          setShippingOptions(quoteRes.options)
          // Seleciona por padrão a primeira opção (ou a grátis/mais barata)
          const defaultOpt =
            quoteRes.options.find((o) => o.isFree) || quoteRes.options[0]
          setSelectedOption(defaultOpt)
        } else {
          setShippingOptions([])
          setSelectedOption(null)
          setShippingError(quoteRes.error || 'Nenhuma opção de frete disponível para este CEP.')
        }
      } catch {
        setShippingError('Não foi possível cotar o frete para o CEP informado.')
      } finally {
        setIsLoadingShipping(false)
      }
    } else {
      setShippingOptions([])
      setSelectedOption(null)
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isPending) return

    setErrorMessage(null)

    if (!selectedOption) {
      setErrorMessage('Por favor, informe um CEP válido e selecione uma opção de frete.')
      return
    }

    if (!cpf.trim() || !isValidCPF(cpf)) {
      setErrorMessage('Por favor, informe um CPF válido para a emissão do frete.')
      return
    }

    if (!street.trim() || !number.trim() || !neighborhood.trim() || !city.trim() || !state.trim()) {
      setErrorMessage('Preencha todos os campos obrigatórios do endereço de entrega.')
      return
    }

    startTransition(async () => {
      try {
        const payload = {
          orderId,
          shippingAddress: {
            street: street.trim(),
            number: number.trim(),
            complement: complement.trim() || null,
            neighborhood: neighborhood.trim(),
            city: city.trim(),
            state: state.trim().toUpperCase(),
            zipCode,
            cpf: cpf.trim(),
          },
          selectedShippingOption: {
            serviceId: selectedOption.serviceId,
            serviceName: selectedOption.serviceName,
            price: selectedOption.price,
            isFree: selectedOption.isFree,
            cep: zipCode.replace(/\D/g, ''),
          },
        }

        const res = await saveAssistedOrderShippingAction(payload)
        if (res.success) {
          setIsSuccess(true)
          window.location.reload()
        } else {
          setErrorMessage(res.error || 'Não foi possível salvar o endereço de entrega.')
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Erro ao processar dados de entrega. Tente novamente.'
        )
      }
    })
  }

  const shippingCost = selectedOption?.price ?? 0
  const finalTotal = subtotal + shippingCost

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      {/* Formulário de Entrega */}
      <div className="lg:col-span-2 bg-[#0a0e1a]/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3 border-b border-slate-800/80 pb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Endereço de Entrega</h2>
            <p className="text-xs text-slate-400">
              Informe onde devemos entregar o seu pedido da Lúmen 3D.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Identificação de Entrega: CEP e CPF */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* CEP com consulta */}
            <div className="space-y-1.5">
              <label htmlFor="cep" className="block text-xs font-semibold text-slate-300">
                CEP de Entrega <span className="text-cyan-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="cep"
                  type="text"
                  required
                  maxLength={9}
                  value={zipCode}
                  onChange={(e) => handleCepChange(e.target.value)}
                  placeholder="00000-000"
                  disabled={isPending}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition font-mono"
                />
                {isLoadingShipping && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* CPF do Destinatário */}
            <div className="space-y-1.5">
              <label htmlFor="cpf" className="block text-xs font-semibold text-slate-300">
                CPF do Destinatário <span className="text-cyan-400">*</span>
              </label>
              <input
                id="cpf"
                type="text"
                required
                maxLength={14}
                value={cpf}
                onChange={(e) => handleCpfChange(e.target.value)}
                placeholder="000.000.000-00"
                disabled={isPending}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition font-mono"
              />
              <p className="text-[10px] text-slate-500">
                Obrigatório para emissão de frete e declaração de conteúdo.
              </p>
            </div>
          </div>

          {/* Opções de Frete */}
          {isLoadingShipping && (
            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-400 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              <span>Calculando opções de frete para seu CEP...</span>
            </div>
          )}

          {shippingError && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{shippingError}</span>
            </div>
          )}

          {shippingOptions.length > 0 && !isLoadingShipping && (
            <div className="space-y-2.5 pt-2">
              <span className="block text-xs font-semibold text-slate-300">
                Selecione a Modalidade de Envio:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {shippingOptions.map((opt) => {
                  const isSelected = selectedOption?.serviceId === opt.serviceId
                  return (
                    <button
                      key={opt.serviceId}
                      type="button"
                      onClick={() => setSelectedOption(opt)}
                      className={`text-left p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-950/30 ring-1 ring-cyan-400/50'
                          : 'border-slate-800/90 bg-slate-950/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Truck className={`w-3.5 h-3.5 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                          <span className="text-xs font-bold text-white">
                            {opt.serviceName}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {opt.deliveryTime ? `Prazo: até ${opt.deliveryTime} dias úteis` : 'Entrega rápida'}
                        </p>
                      </div>

                      <div className="text-right">
                        {opt.isFree || opt.price === 0 ? (
                          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                            Grátis
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-white">
                            {formatCurrency(opt.price)}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Dados do Logradouro */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="street" className="block text-xs font-semibold text-slate-300">
                Logradouro / Rua <span className="text-cyan-400">*</span>
              </label>
              <input
                id="street"
                type="text"
                required
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Ex: Av. Principal"
                disabled={isPending}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="number" className="block text-xs font-semibold text-slate-300">
                Número <span className="text-cyan-400">*</span>
              </label>
              <input
                id="number"
                type="text"
                required
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="Ex: 123"
                disabled={isPending}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="complement" className="block text-xs font-semibold text-slate-300">
                Complemento
              </label>
              <input
                id="complement"
                type="text"
                value={complement}
                onChange={(e) => setComplement(e.target.value)}
                placeholder="Apto, Bloco, etc."
                disabled={isPending}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="neighborhood" className="block text-xs font-semibold text-slate-300">
                Bairro <span className="text-cyan-400">*</span>
              </label>
              <input
                id="neighborhood"
                type="text"
                required
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Bairro"
                disabled={isPending}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1.5">
                <label htmlFor="city" className="block text-xs font-semibold text-slate-300">
                  Cidade <span className="text-cyan-400">*</span>
                </label>
                <input
                  id="city"
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Cidade"
                  disabled={isPending}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="state" className="block text-xs font-semibold text-slate-300">
                  UF <span className="text-cyan-400">*</span>
                </label>
                <input
                  id="state"
                  type="text"
                  required
                  maxLength={2}
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  placeholder="SP"
                  disabled={isPending}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 uppercase text-center focus:outline-none focus:border-cyan-400 transition"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 flex justify-end">
            <button
              type="submit"
              disabled={isPending || isSuccess || !selectedOption || isLoadingShipping}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              {isSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-slate-950" />
                  Endereço Confirmado! Abrindo Pagamento...
                </>
              ) : isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando Endereço...
                </>
              ) : (
                <>
                  Continuar para Pagamento
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Resumo do Pedido */}
      <div className="bg-[#0a0e1a]/90 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Package className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Resumo do Orçamento
          </h3>
        </div>

        {defaultEmail && (
          <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/30 text-[11px] text-cyan-300 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
            <span className="truncate">Cliente: {defaultEmail}</span>
          </div>
        )}

        <div className="divide-y divide-slate-800/60 text-xs">
          {itemsSummary.map((item, idx) => (
            <div key={idx} className="py-2.5 flex justify-between items-center gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-slate-200 truncate">{item.title}</p>
                <p className="text-[11px] text-slate-400">Qtd: {item.quantity}</p>
              </div>
              <span className="font-mono text-slate-300 shrink-0">
                {formatCurrency(item.priceUnit * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Subtotal</span>
            <span className="font-mono text-slate-200">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Frete ({selectedOption?.serviceName || 'A calcular'})</span>
            <span className="font-mono text-slate-200">
              {selectedOption
                ? selectedOption.isFree || selectedOption.price === 0
                  ? 'Grátis'
                  : formatCurrency(selectedOption.price)
                : '—'}
            </span>
          </div>
          <div className="pt-2 border-t border-slate-800 flex justify-between text-sm font-bold text-white">
            <span>Total</span>
            <span className="font-mono text-cyan-400">{formatCurrency(finalTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
