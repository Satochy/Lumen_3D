'use client'

import { useState, useActionState } from 'react'
import Link from 'next/link'
import { updatePassword } from '@/app/actions/auth_actions'
import { Lock, Eye, EyeOff, KeyRound, ArrowLeft } from 'lucide-react'

export default function ResetPasswordPage() {
  const [state, formAction, isPending] = useActionState(updatePassword, { error: '' })
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-[#0a0e1a]/90 border border-cyan-950/70 rounded-3xl p-8 space-y-6 shadow-2xl">
        <div className="space-y-2 text-center">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-cyan-400">
            <KeyRound className="w-3.5 h-3.5" /> Nova Senha
          </span>
          <h1 className="text-2xl font-extrabold text-white">Redefinir Senha</h1>
          <p className="text-xs text-slate-400">
            Digite e confirme sua nova senha de acesso à Lúmen 3D.
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          {state?.error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 text-center">
              {state.error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-300">Nova Senha</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                name="password"
                type={showPass ? 'text' : 'password'}
                required
                minLength={8}
                placeholder="Mínimo 8 caracteres"
                className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-400 transition"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-400 transition cursor-pointer"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-300">
              Confirmar Nova Senha
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                name="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                required
                minLength={8}
                placeholder="Repita a nova senha"
                className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-400 transition"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-400 transition cursor-pointer"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="btn-fx hover-btn-bounce w-full py-3.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
          >
            {isPending ? 'Salvando...' : 'Salvar Nova Senha'}
          </button>
        </form>

        <div className="text-center pt-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar para o Login
          </Link>
        </div>
      </div>
    </div>
  )
}