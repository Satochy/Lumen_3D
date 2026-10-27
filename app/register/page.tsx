'use client'

import { signUp } from '@/app/actions/auth_actions'
import Link from 'next/link'
import { useActionState } from 'react'

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(signUp, { error: '' })

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex items-center justify-center px-4 py-12 font-sans">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold text-white">Criar Conta</h1>
          <p className="text-sm text-slate-400">Junte-se à comunidade Lúmen 3D</p>
        </div>

        <form action={formAction} className="space-y-4">
          {state?.error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 text-center">
              {state.error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="name" className="block text-xs font-semibold text-slate-300">
              Nome Completo
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              minLength={3}
              placeholder="Seu nome"
              className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="username" className="block text-xs font-semibold text-slate-300">
              Nome de Usuário (Exibição)
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              minLength={3}
              maxLength={30}
              placeholder="ex: satochy_3d"
              className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-xs font-semibold text-slate-300">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="seu@email.com"
              className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-xs font-semibold text-slate-300">
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="••••••••••••"
              className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
            />
            <span className="text-[11px] text-slate-500 block">
              Mínimo 8 caracteres para sua segurança.
            </span>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-lg transition cursor-pointer"
          >
            {isPending ? 'Criando conta e logando...' : 'Criar Conta'}
          </button>
        </form>

        <p className="text-[11px] text-slate-500 text-center">
          Ao criar uma conta, você concorda com nossos Termos de Uso e Política de Privacidade.
        </p>

        <p className="text-xs text-slate-400 text-center">
          Já tem conta?{' '}
          <Link href="/login" className="text-cyan-400 hover:underline font-semibold">
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  )
}