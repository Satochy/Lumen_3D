'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ShoppingBag,
  Printer,
  MessageSquarePlus,
  Boxes,
  CircleDot,
  BarChart3,
  ExternalLink,
  UserCheck,
  AlertTriangle,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'

export interface AdminSidebarProps {
  adminUser: {
    id: string
    name: string | null
    username: string
    email: string
    avatarUrl: string | null
  }
  counts?: {
    production: number
    readyShipping: number
    occurrences: number
  }
}

export default function Admin_Sidebar({ adminUser, counts }: AdminSidebarProps) {
  const pathname = usePathname()
  // Retrátil por padrão em telas grandes para maximizar a área de trabalho
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true)

  const navItems = [
    {
      href: '/admin',
      label: 'Dashboard',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      href: '/admin/orders',
      label: 'Gerenciar Vendas',
      icon: ShoppingBag,
      badge: counts?.readyShipping
        ? { text: `${counts.readyShipping} pronto`, style: 'bg-teal-500/15 text-teal-300 border-teal-500/30' }
        : undefined,
      hasDotBadge: Boolean(counts?.readyShipping && counts.readyShipping > 0),
    },
    {
      href: '/admin/production',
      label: 'Fila de Produção',
      icon: Printer,
      badge: counts?.production
        ? { text: `${counts.production} fila`, style: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' }
        : undefined,
      hasDotBadge: Boolean(counts?.production && counts.production > 0),
    },
    {
      href: '/admin/assisted-sales',
      label: 'Venda Assistida',
      icon: MessageSquarePlus,
    },
    {
      href: '/admin/products',
      label: 'Gerenciar Produtos',
      icon: Boxes,
    },
    {
      href: '/admin/filaments',
      label: 'Filamentos',
      icon: CircleDot,
    },
    {
      href: '/admin/finance',
      label: 'Controle Financeiro',
      icon: BarChart3,
    },
  ]

  const userDisplayName = adminUser.name || adminUser.username || 'Administrador'

  return (
    <aside
      aria-label="Navegação administrativa"
      className={`${
        isCollapsed ? 'w-20' : 'w-64'
      } border-r border-slate-800/80 bg-[#060a17]/95 backdrop-blur-xl flex flex-col justify-between shrink-0 min-h-screen sticky top-0 shadow-2xl shadow-black/60 transition-all duration-300 ease-in-out`}
    >
      {/* Topo / Marca e Botão de Recolher */}
      <div className={isCollapsed ? 'p-3 text-center' : 'p-5'}>
        <div className={`flex items-center ${isCollapsed ? 'flex-col gap-3 justify-center' : 'justify-between'} mb-6`}>
          <Link
            href="/admin"
            className="flex items-center gap-3 group"
            title="Lúmen 3D Console"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/25 to-blue-600/35 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-black shadow-lg shadow-cyan-950/50 group-hover:border-cyan-400 group-hover:scale-105 transition-all duration-300 shrink-0">
              <Sparkles className="w-5 h-5 text-cyan-300" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-slate-100 tracking-wider text-base">LÚMEN</span>
                  <span className="text-cyan-400 font-extrabold text-base drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">
                    3D
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-cyan-500/90 font-mono tracking-widest uppercase font-semibold">
                    Admin
                  </span>
                  <span className="text-[9px] font-mono px-1 rounded bg-slate-800/80 text-slate-400 border border-slate-700/60">
                    v1.0
                  </span>
                </div>
              </div>
            )}
          </Link>

          {/* Botão de Toggle Retrátil */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 border border-transparent hover:border-slate-700 transition-colors"
            title={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral (modo compacto)'}
            aria-label={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-cyan-400" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Alerta de Ocorrência Aberta */}
        {counts && counts.occurrences > 0 && (
          isCollapsed ? (
            <Link
              href="/admin/orders?tab=ocorrencias"
              className="mb-4 flex items-center justify-center w-10 h-10 mx-auto rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:border-rose-400 transition relative"
              title={`${counts.occurrences} Ocorrência(s) pendente(s) requerem atenção`}
              aria-label={`${counts.occurrences} ${counts.occurrences === 1 ? 'ocorrência pendente' : 'ocorrências pendentes'}`}
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-[#060a17]" />
            </Link>
          ) : (
            <Link
              href="/admin/orders?tab=ocorrencias"
              className="mb-6 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500/15 to-rose-500/5 border border-rose-500/30 text-rose-200 hover:border-rose-500/50 transition-all duration-200 group shadow-md shadow-rose-950/20"
            >
              <div className="w-6 h-6 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div className="text-xs leading-tight min-w-0">
                <p className="font-bold text-rose-200 truncate">
                  {counts.occurrences} {counts.occurrences === 1 ? 'Ocorrência' : 'Ocorrências'}
                </p>
                <p className="text-[10px] text-rose-300/80 truncate">Ação imediata requerida</p>
              </div>
            </Link>
          )
        )}

        {/* Menu de Navegação */}
        <nav className="space-y-1.5">
          {!isCollapsed && (
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider px-3 mb-2 font-mono">
              Menu Operacional
            </p>
          )}

          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href)

            const Icon = item.icon

            if (isCollapsed) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex items-center justify-center w-11 h-11 mx-auto rounded-xl transition-all duration-200 group ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 shadow-lg shadow-cyan-950/50'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80 border border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 transition-colors duration-200 ${
                      isActive ? 'text-cyan-300' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  {item.hasDotBadge && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-teal-400 ring-2 ring-[#060a17]" />
                  )}
                </Link>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/15 via-cyan-500/8 to-transparent text-cyan-200 border border-cyan-500/30 shadow-md shadow-cyan-950/25 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r before:bg-cyan-400 before:shadow-[0_0_10px_#22d3ee]'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors duration-200 ${
                      isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-200'
                    }`}
                  />
                  <span className={isActive ? 'font-bold' : ''}>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${item.badge.style}`}
                  >
                    {item.badge.text}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Rodapé / Usuário & Loja com Espaçamento Amplo */}
      <div className={`border-t border-slate-800/80 bg-slate-950/80 ${isCollapsed ? 'p-3 flex flex-col items-center gap-3' : 'p-4 space-y-3'}`}>
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            {/* Avatar em formato compacto */}
            <div
              className="relative shrink-0 cursor-pointer"
              title={`${userDisplayName} (ADMIN) - ${adminUser.email}`}
              onClick={() => setIsCollapsed(false)}
            >
              {adminUser.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={adminUser.avatarUrl}
                  alt={userDisplayName}
                  className="w-10 h-10 rounded-xl object-cover border border-cyan-500/40 shadow-sm"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-950 to-slate-900 border border-cyan-500/40 text-cyan-300 flex items-center justify-center font-bold text-sm uppercase shadow-sm">
                  {userDisplayName[0]}
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#060a17]" />
            </div>

            {/* Links rápidos em modo compacto */}
            <Link
              href="/"
              className="p-2 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-900 transition"
              title="Ver Loja Pública"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
            <Link
              href="/profile"
              className="p-2 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-900 transition"
              title="Meu Perfil"
            >
              <UserCheck className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <>
            {/* Card do Usuário Espaçado e Formatado */}
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  {adminUser.avatarUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={adminUser.avatarUrl}
                      alt={userDisplayName}
                      className="w-10 h-10 rounded-xl object-cover border border-cyan-500/40 shadow-sm"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-950 to-slate-900 border border-cyan-500/40 text-cyan-300 flex items-center justify-center font-bold text-sm uppercase shadow-sm">
                      {userDisplayName[0]}
                    </div>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#060a17]" />
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <p className="text-xs font-bold text-slate-100 truncate">
                      {userDisplayName}
                    </p>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-bold uppercase tracking-wider shrink-0">
                      ADMIN
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono truncate" title={adminUser.email}>
                    {adminUser.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Links de Saída */}
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 text-[11px] font-semibold text-slate-300 border border-slate-800 hover:border-slate-700 transition-all duration-200 group"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                <span>Ver Loja</span>
              </Link>
              <Link
                href="/profile"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 text-[11px] font-semibold text-slate-300 border border-slate-800 hover:border-slate-700 transition-all duration-200 group"
              >
                <UserCheck className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                <span>Meu Perfil</span>
              </Link>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
