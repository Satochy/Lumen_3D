import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { Printer, Sparkles, Layers, Clock, ArrowRight } from 'lucide-react'

export default async function AdminProductionPage() {
  await requireAdmin()

  return (
    <div className="space-y-6">
      {/* Painel Central Placeholder */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-[#0c1229] to-[#070b1a] p-8 sm:p-12 text-center shadow-2xl">
        {/* Glow de fundo */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-indigo-500/10 blur-3xl pointer-events-none rounded-full" />

        <div className="relative z-10 max-w-xl mx-auto space-y-6">
          {/* Ícone Central Iluminado */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center mx-auto shadow-lg shadow-indigo-950/60">
            <Printer className="w-8 h-8 animate-pulse text-indigo-400" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-indigo-950/80 text-indigo-300 border border-indigo-500/40">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Em Breve...</span>
            </span>

            <h2 className="text-2xl font-black text-slate-100 tracking-tight sm:text-3xl">
              Fila de Produção Granular
            </h2>

            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Esta tela centralizará o controle individual de cada peça sob encomenda, alocação de lotes nas impressoras 3D e checklist de pós-processamento e acabamento.
            </p>
          </div>

          {/* Grid de Funcionalidades em Desenvolvimento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-2">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
                <Printer className="w-3.5 h-3.5" />
                <span>Por Impressora</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Organização de filas por bico e máquina ativa.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
                <Layers className="w-3.5 h-3.5" />
                <span>Pós-processamento</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Checklist de cura, suportes e lixamento manual.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-2 text-teal-400 font-semibold text-xs">
                <Clock className="w-3.5 h-3.5" />
                <span>Previsão de Entrega</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Tempo estimado restante por pedido do cliente.
              </p>
            </div>
          </div>

          {/* Ação Alternativa Imediata */}
          <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-center gap-3">
            <span className="text-xs text-slate-500">
              Gerencie os pedidos globais enquanto a Fase 2 é finalizada:
            </span>
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-md shadow-indigo-950/50"
            >
              <span>Ir para Gerenciar Vendas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
