'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { ShieldCheck, Circle, ChevronRight } from 'lucide-react'

export interface AdminHeaderProps {
  title?: string
  subtitle?: string
}

const routeTitles: Record<string, { title: string; subtitle: string; category: string }> = {
  '/admin': {
    category: 'Visão Geral',
    title: 'Dashboard Geral',
    subtitle: 'Métricas em tempo real da oficina, vendas e caixa. Atalhos e ações rápidas',
  },
  '/admin/orders': {
    category: 'Vendas & Expedição',
    title: 'Gerenciar Vendas',
    subtitle: 'Visão consolidada de todos os pedidos, pagamentos e status de logística',
  },
  '/admin/production': {
    category: 'Oficina 3D',
    title: 'Fila de Produção',
    subtitle: 'Linha de fabricação e controle de itens sob encomenda',
  },
  '/admin/assisted-sales': {
    category: 'Atendimento',
    title: 'Venda Assistida',
    subtitle: 'Geração de links de pagamento para atendimentos WhatsApp, Instagram e outros...',
  },
  '/admin/products': {
    category: 'Catálogo',
    title: 'Gerenciar Produtos',
    subtitle: 'Gestão de modelos de pronta entrega e sob encomenda',
  },
  '/admin/filaments': {
    category: 'Insumos',
    title: 'Gerenciar Filamentos',
    subtitle: 'Controle de pesagem e abastecimento de carretéis',
  },
  '/admin/finance': {
    category: 'Caixa & Finanças',
    title: 'Controle Financeiro',
    subtitle: 'Controle de caixa, inteligência de vendas, origens de receita e exportação contábil',
  },
}

export default function Admin_Header({ title, subtitle }: AdminHeaderProps) {
  const pathname = usePathname()

  // Evita cabeçalho duplicado caso a página renderize <Admin_Header title="..." /> dentro do AdminLayout
  if ((title || subtitle) && routeTitles[pathname]) {
    return null
  }

  const currentRoute = routeTitles[pathname] || {
    category: 'Console',
    title: title || 'Painel Administrativo',
    subtitle: subtitle || 'Área restrita de gestão interna',
  }

  const rawEnv = (
    process.env.NEXT_PUBLIC_APP_ENV ||
    process.env.NODE_ENV ||
    'development'
  ).toLowerCase()

  const envConfig =
    rawEnv === 'production'
      ? {
          circleColor: 'text-red-500',
          textColor: 'text-red-500',
          label: 'Produção',
        }
      : rawEnv === 'staging' || rawEnv === 'test'
        ? {
            circleColor: 'text-amber-400',
            textColor: 'text-amber-400',
            label: 'Teste',
          }
        : {
            circleColor: 'text-emerald-400',
            textColor: 'text-emerald-400',
            label: 'Desenvolvimento',
          }

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-slate-800/80">
      <div>
        {/* Breadcrumb refinado com estilo Glass */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono tracking-wider mb-1.5">
          <span className="text-slate-400 font-semibold">{currentRoute.category}</span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className="text-cyan-400 font-bold bg-cyan-950/40 px-1.5 py-0.2 rounded border border-cyan-800/30">
            {currentRoute.title}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight flex items-center gap-2.5">
          <span>{currentRoute.title}</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1 max-w-xl">
          {currentRoute.subtitle}
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Status de Conexão com Mercado Pago / Sistema */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#090e1d] border border-slate-800 text-[11px] font-mono shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-slate-400">API de Pagamento:</span>
          <span className="font-bold text-emerald-400 uppercase tracking-wider">
            Conectado
          </span>
        </div>

        {/* Badge de Ambiente */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#090e1d] border border-slate-800 text-[11px] font-mono shadow-sm">
          <Circle className={`w-2 h-2 fill-current ${envConfig.circleColor}`} />
          <span className="text-slate-400">Ambiente:</span>
          <span className={`font-bold uppercase tracking-wider ${envConfig.textColor}`}>
            {envConfig.label}
          </span>
        </div>

        {/* Badge de Proteção RBAC */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-800/50 text-[11px] text-cyan-300 font-medium shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">Proteção RBAC:</span>
          <span className="font-mono text-[10px] uppercase font-bold tracking-wider">Ativo</span>
        </div>
      </div>
    </header>
  )
}
