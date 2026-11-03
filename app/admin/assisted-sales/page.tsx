import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { MessageSquarePlus, Sparkles, Link2, ShieldCheck, UserCheck, ArrowRight } from 'lucide-react'

export default async function AdminAssistedSalesPage() {
  await requireAdmin()

  return (
    <div className="space-y-6">
      {/* Painel Central Placeholder */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-[#081826] to-[#070b1a] p-8 sm:p-12 text-center shadow-2xl">
        {/* Glow de fundo */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-cyan-500/10 blur-3xl pointer-events-none rounded-full" />

        <div className="relative z-10 max-w-xl mx-auto space-y-6">
          {/* Ícone Central Iluminado */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center mx-auto shadow-lg shadow-cyan-950/60">
            <MessageSquarePlus className="w-8 h-8 animate-pulse text-cyan-400" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Em Breve...</span>
            </span>

            <h2 className="text-2xl font-black text-slate-100 tracking-tight sm:text-3xl">
              Venda Assistida por Link
            </h2>

            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Monte pedidos sob medida para clientes que procuram a Lúmen 3D via WhatsApp ou Instagram e gere um link de checkout com reserva temporária de estoque e conciliação automática.
            </p>
          </div>

          {/* Grid de Funcionalidades em Desenvolvimento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-2">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
                <Link2 className="w-3.5 h-3.5" />
                <span>Link Direto</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Checkout transparente com PIX e Cartão no Mercado Pago.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-2 text-teal-400 font-semibold text-xs">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Reserva Atômica</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Garante o material ou a fila enquanto o link está válido.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Registro do Sócio</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Identificação de quem atendeu e métricas da venda.
              </p>
            </div>
          </div>

          {/* Ação Alternativa Imediata */}
          <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-center gap-3">
            <span className="text-xs text-slate-500">
              Precisa conferir os produtos disponíveis no catálogo?
            </span>
            <Link
              href="/admin/products"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition shadow-md shadow-cyan-950/50"
            >
              <span>Gerenciar Produtos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
