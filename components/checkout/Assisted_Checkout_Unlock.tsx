'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Mail, ArrowRight, Loader2, AlertCircle, Sparkles } from 'lucide-react'
import { unlockAssistedSaleAction } from '@/app/actions/assisted_sales_actions'

interface AssistedCheckoutUnlockProps {
  orderId: string
  initialEmail?: string
}

export default function Assisted_Checkout_Unlock({
  orderId,
  initialEmail = '',
}: AssistedCheckoutUnlockProps) {
  const router = useRouter()
  const [email, setEmail] = useState(initialEmail)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email.trim() || isPending) return

    setErrorMessage(null)

    startTransition(async () => {
      try {
        const result = await unlockAssistedSaleAction(orderId, email.trim())

        if (result.success) {
          router.push(`/marketplace/checkout/${orderId}`)
        } else {
          setErrorMessage(result.error || 'Não foi possível validar o e-mail informado.')
        }
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Ocorreu um erro ao verificar o acesso. Tente novamente.'
        )
      }
    })
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="relative bg-[#0a0e1a]/90 border border-cyan-900/40 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,216,255,0.08)] backdrop-blur-xl">
        {/* Cantoneiras decorativas técnicas Lúmen 3D */}
        <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-cyan-500/40 pointer-events-none" />
        <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-cyan-500/40 pointer-events-none" />

        {/* Ícone de Cadeado / Proteção */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner shadow-cyan-500/20">
            <Lock className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2.5 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3" /> Venda Assistida
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Confirme seu e-mail para acessar o orçamento
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
              Informe o mesmo e-mail combinado com nossa equipe para desbloquear os detalhes do seu pedido.
            </p>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="assisted-email" className="block text-[11px] font-semibold text-slate-300">
              Endereço de E-mail
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="assisted-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                disabled={isPending}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending || !email.trim()}
            className="btn-fx hover-btn-bounce w-full py-3.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verificando...</span>
              </>
            ) : (
              <>
                <span>Acessar Orçamento</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-[11px] text-slate-500 text-center mt-5">
          Ambiente seguro Lúmen 3D • Protegido por criptografia
        </p>
      </div>
    </div>
  )
}
