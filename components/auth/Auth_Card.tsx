'use client'

import { useState, useActionState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { signIn, signUp } from '@/app/actions/auth_actions'
import { Mail, Lock, User, AtSign, Sparkles, ArrowLeft } from 'lucide-react'

interface AuthCardProps {
  initialMode?: 'login' | 'register'
}

const PANEL_BACKGROUND_IMAGE = '/bg_login.jpg'

export default function Auth_Card({ initialMode = 'login' }: AuthCardProps) {
  const [isSignUp, setIsSignUp] = useState(initialMode === 'register')

  const [loginState, loginAction, isLoginPending] = useActionState(signIn, { error: '' })
  const [registerState, registerAction, isRegisterPending] = useActionState(signUp, { error: '' })

  const handleToggleMode = (targetSignUp: boolean) => {
    setIsSignUp(targetSignUp)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', targetSignUp ? '/register' : '/login')
    }
  }

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 sm:p-6 font-sans selection:bg-cyan-500 selection:text-slate-950 overflow-hidden">
      {/* Background da tela inteira */}
      <div className="absolute inset-0 -z-20 bg-[#050811]">
        <Image
          src={PANEL_BACKGROUND_IMAGE}
          alt="Lúmen 3D Background"
          fill
          className="object-cover object-center opacity-40 scale-105 pointer-events-none"
          priority
        />
        {/* Overlay escuro e gradiente para garantir leitura */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#050811]/90 via-[#0a0e1a]/80 to-[#050811]/95" />
      </div>
      
      {/* Luzes de ambiência no fundo da página */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-cyan-500/10 blur-[130px] pointer-events-none rounded-full" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-cyan-600/10 blur-[130px] pointer-events-none rounded-full" />

      {/* Topo: Botão Voltar para a Loja */}
      <div className="w-full max-w-[920px] mb-4 flex items-center justify-between z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-cyan-400 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para a Lúmen 3D
        </Link>
      </div>

      {/* Container Principal Estilo Vídeo (Sliding Double-Panel) */}
      <div className="relative w-full max-w-[920px] min-h-[580px] bg-[#0a0e1a]/95 border border-cyan-950/70 rounded-[32px] shadow-[0_25px_70px_-15px_rgba(0,216,255,0.14)] overflow-hidden backdrop-blur-xl">
        {/* Cantoneiras técnicas sutis da identidade Lúmen 3D */}
        <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-cyan-500/40 pointer-events-none z-30" />
        <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-cyan-500/40 pointer-events-none z-30" />

        {/* =====================================================================
            FORMULÁRIO 1: CRIAR CONTA (Desliza para a metade direita quando ativo)
           ===================================================================== */}
        <div
          className={`w-full md:w-1/2 md:absolute md:top-0 md:left-0 md:h-full flex flex-col justify-center px-7 sm:px-11 py-10 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isSignUp
              ? 'block md:translate-x-full opacity-100 z-20'
              : 'hidden md:flex md:translate-x-0 opacity-0 pointer-events-none z-10'
          }`}
        >
          <div className="space-y-2 text-center md:text-left">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-cyan-400">
              <Sparkles className="w-3 h-3" /> Novo Cadastro
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Criar Conta
            </h1>
            <p className="text-xs text-slate-400">
              Preencha seus dados básicos para encomendar e acompanhar peças 3D.
            </p>
          </div>

          <form action={registerAction} className="mt-5 space-y-3.5">
            {registerState?.error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 text-center">
                {registerState.error}
              </div>
            )}

            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                name="name"
                type="text"
                required
                minLength={3}
                placeholder="Nome Completo"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/90 border border-slate-800/90 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
              />
            </div>

            <div className="relative">
              <AtSign className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                name="username"
                type="text"
                required
                minLength={3}
                maxLength={30}
                placeholder="Nome de Usuário"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/90 border border-slate-800/90 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
              />
            </div>

            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                name="email"
                type="email"
                required
                placeholder="Seu melhor e-mail"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/90 border border-slate-800/90 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
              />
            </div>

            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="Senha (mínimo 8 caracteres)"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/90 border border-slate-800/90 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
              />
            </div>

            <button
              type="submit"
              disabled={isRegisterPending}
              className="btn-fx hover-btn-bounce w-full py-3.5 mt-1 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              {isRegisterPending ? 'Criando conta...' : 'Cadastrar Agora'}
            </button>
          </form>

          <p className="text-[11px] text-slate-500 text-center mt-4 leading-relaxed">
            Os demais dados de entrega poderão ser completados no seu Perfil.
          </p>

          {/* Alternador visível apenas no Mobile */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 text-center md:hidden">
            <p className="text-xs text-slate-400">
              Já possui uma conta?{' '}
              <button
                type="button"
                onClick={() => handleToggleMode(false)}
                className="text-cyan-400 font-bold hover:underline cursor-pointer"
              >
                Fazer Login
              </button>
            </p>
          </div>
        </div>

        {/* =====================================================================
            FORMULÁRIO 2: ENTRAR (Fica na metade esquerda quando ativo)
           ===================================================================== */}
        <div
          className={`w-full md:w-1/2 md:absolute md:top-0 md:left-0 md:h-full flex flex-col justify-center px-7 sm:px-11 py-10 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isSignUp
              ? 'hidden md:flex md:translate-x-full opacity-0 pointer-events-none z-10'
              : 'block md:translate-x-0 opacity-100 z-20'
          }`}
        >
          <div className="space-y-2 text-center md:text-left">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-cyan-400">
              <Sparkles className="w-3 h-3" /> Bem-vindo de volta!
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Entrar
            </h1>
            <p className="text-xs text-slate-400">
              Use seu e-mail e senha cadastrados para acessar sua conta.
            </p>
          </div>

          <form action={loginAction} className="mt-6 space-y-4">
            {loginState?.error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 text-center">
                {loginState.error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-300">E-mail</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="insira seu email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/90 border border-slate-800/90 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-300">Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="insira sua senha"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/90 border border-slate-800/90 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoginPending}
              className="btn-fx hover-btn-bounce w-full py-3.5 mt-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              {isLoginPending ? 'Autenticando...' : 'Entrar'}
            </button>
          </form>

          {/* Alternador visível apenas no Mobile */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 text-center md:hidden">
            <p className="text-xs text-slate-400">
              Ainda não tem conta?{' '}
              <button
                type="button"
                onClick={() => handleToggleMode(true)}
                className="text-cyan-400 font-bold hover:underline cursor-pointer"
              >
                Criar Conta
              </button>
            </p>
          </div>
        </div>

        {/* =====================================================================
            PAINEL DESLIZANTE COM IMAGEM DE FUNDO (Toggle Container do Vídeo)
           ===================================================================== */}
        <div
          className={`hidden md:block absolute top-0 left-1/2 w-1/2 h-full overflow-hidden z-30 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isSignUp
              ? '-translate-x-full rounded-r-[110px] rounded-l-none border-r border-cyan-500/30'
              : 'translate-x-0 rounded-l-[110px] rounded-r-none border-l border-cyan-500/30'
          }`}
        >
          {/* Faixa interna dupla que se move em sentido inverso para o efeito de paralaxe do vídeo */}
          <div
            className={`relative -left-full h-full w-[200%] flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isSignUp ? 'translate-x-1/2' : 'translate-x-0'
            }`}
          >
            {/* Imagem de Fundo + Atmosfera Dark/Ciano */}
            <div className="absolute inset-0 bg-[#070b16]">
              <Image
                src={PANEL_BACKGROUND_IMAGE}
                alt="Lúmen 3D Background"
                fill
                className="object-cover object-center opacity-25 scale-110 blur-[1px] pointer-events-none"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/85 via-[#070b16]/80 to-[#050811]/95" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.18),transparent_70%)]" />
            </div>

            {/* LADO ESQUERDO DA FAIXA: Aparece quando o usuário está em "Criar Conta" */}
            <div
              className={`relative w-1/2 h-full flex flex-col items-center justify-center text-center px-10 space-y-5 z-10 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isSignUp ? 'translate-x-0' : '-translate-x-[20%]'
              }`}
            >
              <div className="mascot-float relative w-28 h-28 flex items-center justify-center">
                <Image
                  src="/mascote.png"
                  alt="Mascote Lúmen 3D"
                  width={112}
                  height={112}
                  className="object-contain drop-shadow-[0_10px_25px_rgba(34,211,238,0.35)]"
                />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold text-white tracking-tight">
                  Bem-vindo de volta!
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed max-w-xs">
                  Para continuar conectado conosco e acompanhar seus pedidos, acesse sua conta com seus dados pessoais.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleToggleMode(false)}
                className="btn-soft hover-btn-bounce px-8 py-3 rounded-xl border border-cyan-400/60 bg-cyan-950/40 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 font-bold text-xs uppercase tracking-wider transition cursor-pointer"
              >
                Entrar
              </button>
            </div>

            {/* LADO DIREITO DA FAIXA: Aparece quando o usuário está em "Entrar" */}
            <div
              className={`relative w-1/2 h-full flex flex-col items-center justify-center text-center px-10 space-y-5 z-10 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isSignUp ? 'translate-x-[20%]' : 'translate-x-0'
              }`}
            >
              <div className="mascot-float relative w-28 h-28 flex items-center justify-center">
                <Image
                  src="/mascote.png"
                  alt="Mascote Lúmen 3D"
                  width={112}
                  height={112}
                  className="object-contain drop-shadow-[0_10px_25px_rgba(34,211,238,0.35)]"
                />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold text-white tracking-tight">
                  Olá, ainda não possui conta?
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed max-w-xs">
                  Cadastre seus dados básicos e comece a transformar suas ideias do digital ao real com a Lúmen 3D.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleToggleMode(true)}
                className="btn-soft hover-btn-bounce px-8 py-3 rounded-xl border border-cyan-400/60 bg-cyan-950/40 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 font-bold text-xs uppercase tracking-wider transition cursor-pointer"
              >
                Criar Conta
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}