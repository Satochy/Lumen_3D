'use client'

import { signIn } from '@/app/actions/auth_actions'
import Link from 'next/link'
import { useActionState } from 'react'

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signIn, { error: '' })

  return (
    <main className="min-h-screen bg-[#050811] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Entrar</h1>
          <p className="text-slate-400">Bem-vindo de volta à Lúmen 3D</p>
        </div>

        {/* Form */}
        <form action={formAction} className="space-y-6">
          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-200 mb-2">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="seu@email.com"
              required
              className="w-full px-4 py-3 rounded-lg bg-[#0a0e1a] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
            />
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-200 mb-2">
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Pelo menos 8 caracteres"
              required
              className="w-full px-4 py-3 rounded-lg bg-[#0a0e1a] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
            />
          </div>

          {/* Error Message */}
          {state?.error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {state.error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 px-4 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 text-white font-semibold rounded-lg transition duration-200 flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        {/* Footer Links */}
        <div className="mt-6 text-center">
          <p className="text-slate-400 text-sm">
            Não tem conta?{' '}
            <Link href="/register" className="text-cyan-400 hover:text-cyan-300 font-medium transition">
              Criar uma
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
