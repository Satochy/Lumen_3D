import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { formatCurrency } from '@/lib/format_currency'
import {
  Boxes,
  CircleDot,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  Printer,
  Truck,
  PlusCircle,
  Sparkles,
  ShoppingBag,
  ShieldAlert,
} from 'lucide-react'
import type { PaymentStatus, LogisticsStatus } from '@prisma/client'

const paymentBadges: Record<PaymentStatus, { label: string; dot: string; style: string }> = {
  PENDING: { label: 'Aguardando Pagamento', dot: 'bg-amber-400', style: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
  PAID: { label: 'Pago', dot: 'bg-emerald-400', style: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
  FAILED: { label: 'Falhou / Recusado', dot: 'bg-rose-400', style: 'bg-rose-500/10 text-rose-300 border-rose-500/20' },
  REFUNDED: { label: 'Reembolsado', dot: 'bg-slate-400', style: 'bg-slate-500/10 text-slate-300 border-slate-500/20' },
}

const logisticsBadges: Record<LogisticsStatus, { label: string; style: string }> = {
  PREPARING: { label: 'Na Fila', style: 'bg-slate-500/10 text-slate-300 border-slate-500/20' },
  PRODUCING: { label: 'Em Produção', style: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' },
  PRINTING: { label: 'Em Impressão', style: 'bg-blue-500/10 text-blue-300 border-blue-500/20' },
  POST_PROCESSING: { label: 'Acabamento', style: 'bg-purple-500/10 text-purple-300 border-purple-500/20' },
  READY_FOR_SHIPPING: { label: 'Pronto p/ Envio', style: 'bg-teal-500/10 text-teal-300 border-teal-500/20' },
  SHIPPED: { label: 'Enviado', style: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20' },
  DELIVERED: { label: 'Entregue', style: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
  CANCELLED: { label: 'Cancelado', style: 'bg-rose-500/10 text-rose-300 border-rose-500/20' },
}

export default async function AdminDashboardPage() {
  await requireAdmin()

  // Coleta agregada de estatísticas reais da oficina Lúmen 3D
  const [
    totalProducts,
    madeToOrderProducts,
    readyDeliveryProducts,
    totalFilaments,
    lowFilamentsCount,
    pendingPaymentsCount,
    productionQueueCount,
    readyForShippingCount,
    shippedCount,
    openOccurrencesCount,
    paidOrdersAmount,
    recentOrders,
    lowStockProducts,
  ] = await Promise.all([
    prisma.product.count({ where: { archivedAt: null } }),
    prisma.product.count({ where: { isMadeToOrder: true, archivedAt: null } }),
    prisma.product.count({ where: { isMadeToOrder: false, archivedAt: null } }),
    prisma.filamentStock.count(),
    prisma.filamentStock.count({
      where: {
        remainingGrams: {
          lte: 200,
        },
      },
    }),
    prisma.order.count({ where: { paymentStatus: 'PENDING' } }),
    prisma.order.count({
      where: {
        paymentStatus: 'PAID',
        logisticsStatus: { in: ['PREPARING', 'PRODUCING', 'PRINTING', 'POST_PROCESSING'] },
      },
    }),
    prisma.order.count({ where: { logisticsStatus: 'READY_FOR_SHIPPING' } }),
    prisma.order.count({ where: { logisticsStatus: 'SHIPPED' } }),
    prisma.order.count({ where: { hasOpenOccurrence: true } }),
    prisma.order.aggregate({
      where: { paymentStatus: 'PAID' },
      _sum: { totalAmount: true },
    }),
    prisma.order.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            username: true,
            email: true,
          },
        },
        items: {
          select: {
            id: true,
            productTitle: true,
            quantity: true,
            isMadeToOrder: true,
            isReady: true,
          },
        },
      },
    }),
    prisma.product.findMany({
      where: {
        isMadeToOrder: false,
        archivedAt: null,
        stock: { lte: 2 },
      },
      take: 4,
      select: {
        id: true,
        title: true,
        stock: true,
        reservedStock: true,
      },
    }),
  ])

  const totalRevenue = paidOrdersAmount._sum.totalAmount
    ? Number(paidOrdersAmount._sum.totalAmount)
    : 0

  return (
    <div className="space-y-8">
      {/* Alerta de Ocorrência Aberta em Destaque Premium */}
      {openOccurrencesCount > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-500/15 via-rose-500/10 to-transparent border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl shadow-rose-950/20 backdrop-blur-md">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300 shrink-0 shadow-inner">
              <ShieldAlert className="w-5 h-5 animate-pulse text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-500 text-white tracking-wider">
                  Prioridade Alta
                </span>
                <p className="text-sm font-bold text-rose-200">
                  {openOccurrencesCount} {openOccurrencesCount === 1 ? 'ocorrência financeira em aberto' : 'ocorrências financeiras em aberto'}
                </p>
              </div>
              <p className="text-xs text-rose-300/80 mt-1">
                Divergências de valor/moeda, pagamentos após cancelamento ou inconsistências detectadas pelo webhook.
              </p>
            </div>
          </div>
          <Link
            href="/admin/orders?tab=ocorrencias"
            className="w-full sm:w-auto text-center px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs transition shrink-0 shadow-lg shadow-rose-950/50 hover:scale-[1.02] active:scale-[0.98]"
          >
            Auditar Ocorrências &rarr;
          </Link>
        </div>
      )}

      {/* Grid Principal de KPIs (Cards com Glassmorphism e Glows Sutis) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Receita Total Confirmada */}
        <div className="bg-[#080d1e]/80 border border-slate-800/80 hover:border-emerald-500/40 p-5 rounded-2xl relative overflow-hidden group transition-all duration-300 shadow-lg shadow-black/40 backdrop-blur-md">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Receita Paga</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-sm">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-3 font-mono tracking-tight drop-shadow-[0_0_12px_rgba(52,211,153,0.2)]">
            {formatCurrency(totalRevenue)}
          </p>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60 text-[11px] text-slate-500 font-mono">
            <span>Confirmado em banco</span>
            <span className="text-amber-400/90 font-semibold">{pendingPaymentsCount} pendentes</span>
          </div>
        </div>

        {/* Fila de Produção */}
        <div className="bg-[#080d1e]/80 border border-slate-800/80 hover:border-indigo-500/40 p-5 rounded-2xl relative overflow-hidden group transition-all duration-300 shadow-lg shadow-black/40 backdrop-blur-md">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Fila de Produção</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-sm">
              <Printer className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-indigo-300 mt-3 font-mono tracking-tight">
            {productionQueueCount}
          </p>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60 text-[11px]">
            <span className="text-slate-500">Impressões ativas</span>
            <Link
              href="/admin/production"
              className="text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
            >
              <span>Acessar</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Prontos para Envio */}
        <div className="bg-[#080d1e]/80 border border-slate-800/80 hover:border-teal-500/40 p-5 rounded-2xl relative overflow-hidden group transition-all duration-300 shadow-lg shadow-black/40 backdrop-blur-md">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-teal-500/10 transition-colors" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Prontos p/ Envio</span>
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shadow-sm">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-teal-300 mt-3 font-mono tracking-tight">
            {readyForShippingCount}
          </p>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60 text-[11px]">
            <span className="text-slate-500">Aguardando etiqueta/saída</span>
            <Link
              href="/admin/orders?tab=envio"
              className="text-teal-400 hover:text-teal-300 font-semibold inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
            >
              <span>Despachar</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Em Transporte */}
        <div className="bg-[#080d1e]/80 border border-slate-800/80 hover:border-cyan-500/40 p-5 rounded-2xl relative overflow-hidden group transition-all duration-300 shadow-lg shadow-black/40 backdrop-blur-md">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-cyan-500/10 transition-colors" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Em Transporte</span>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-sm">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-cyan-300 mt-3 font-mono tracking-tight">
            {shippedCount}
          </p>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60 text-[11px]">
            <span className="text-slate-500">Pacotes a caminho</span>
            <Link
              href="/admin/orders?tab=transito"
              className="text-cyan-400 hover:text-cyan-300 font-semibold inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
            >
              <span>Rastrear</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Segunda Linha: Insumos, Alertas de Estoque e Ações Rápidas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card Catálogo & Disponibilidade */}
        <div className="bg-[#080d1e]/80 border border-slate-800/80 rounded-2xl p-6 space-y-5 shadow-lg shadow-black/40 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3.5">
            <div className="flex items-center gap-2.5">
              <Boxes className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-slate-100">Catálogo ({totalProducts} produtos)</h3>
            </div>
            <Link
              href="/admin/products"
              className="text-xs text-cyan-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Gerenciar</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/70">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Pronta Entrega</p>
              <p className="text-2xl font-black text-slate-100 mt-1 font-mono">{readyDeliveryProducts}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/70">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400 font-mono">Sob Encomenda</p>
              <p className="text-2xl font-black text-amber-400 mt-1 font-mono">{madeToOrderProducts}</p>
            </div>
          </div>

          {/* Alertas de Baixo Estoque */}
          <div>
            <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider font-mono">
              Alertas de Estoque Físico:
            </p>
            {lowStockProducts.length === 0 ? (
              <p className="text-xs text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-center font-medium">
                Todos os itens de pronta entrega possuem saldo saudável.
              </p>
            ) : (
              <ul className="space-y-2">
                {lowStockProducts.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80 text-xs"
                  >
                    <span className="text-slate-200 font-medium truncate max-w-[180px]">{p.title}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-500/15 text-rose-300 border border-rose-500/30">
                      {p.stock} un (res: {p.reservedStock})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Card Filamentos & Insumos */}
        <div className="bg-[#080d1e]/80 border border-slate-800/80 rounded-2xl p-6 space-y-5 shadow-lg shadow-black/40 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3.5">
            <div className="flex items-center gap-2.5">
              <CircleDot className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-slate-100">Carretéis de Filamento</h3>
            </div>
            <Link
              href="/admin/filaments"
              className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Gerenciar</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800/70">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Total de Bobinas</p>
              <p className="text-2xl font-black text-slate-100 mt-1 font-mono">{totalFilaments}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Em Alerta Baixo</p>
              <p
                className={`text-2xl font-black mt-1 font-mono ${
                  lowFilamentsCount > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {lowFilamentsCount}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Mantenha o inventário de carretéis de PLA e PETG atualizado para prever pausas na produção 3D.
          </p>

          <Link
            href="/admin/filaments"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 transition-colors shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Adicionar nova bobina</span>
          </Link>
        </div>

        {/* Ações Rápidas & Diretrizes */}
        <div className="bg-[#080d1e]/80 border border-slate-800/80 rounded-2xl p-6 space-y-4 flex flex-col justify-between shadow-lg shadow-black/40 backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3.5 mb-4">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-slate-100">Atalhos Operacionais</h3>
            </div>

            <div className="space-y-2.5">
              <Link
                href="/admin/orders"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 hover:bg-slate-800/60 border border-slate-800/70 text-xs font-medium text-slate-200 transition-all group hover:border-cyan-500/30"
              >
                <div className="flex items-center gap-2.5">
                  <ShoppingBag className="w-4 h-4 text-cyan-400" />
                  <span>Gerenciar Vendas</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
              </Link>

              <Link
                href="/admin/production"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 hover:bg-slate-800/60 border border-slate-800/70 text-xs font-medium text-slate-200 transition-all group hover:border-indigo-500/30"
              >
                <div className="flex items-center gap-2.5">
                  <Printer className="w-4 h-4 text-indigo-400" />
                  <span>Fila de Produção</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold font-mono">
                  {productionQueueCount}
                </span>
              </Link>

              <Link
                href="/admin/products"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 hover:bg-slate-800/60 border border-slate-800/70 text-xs font-medium text-slate-200 transition-all group hover:border-cyan-500/30"
              >
                <div className="flex items-center gap-2.5">
                  <PlusCircle className="w-4 h-4 text-cyan-400" />
                  <span>Cadastrar Novo Produto</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
              </Link>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-800/30 text-[11px] text-cyan-300/90 leading-relaxed">
            <span className="font-bold text-cyan-200 font-mono">Regras D06/D07:</span> Itens prontos pagos vão diretamente para &ldquo;Pronto para Envio&rdquo;. Itens sob encomenda entram na &ldquo;Fila de Produção&rdquo; até conclusão manual.
          </div>
        </div>
      </div>

      {/* Feed de Pedidos Recentes com Estilo Dark Premium */}
      <div className="bg-[#080d1e]/80 border border-slate-800/80 rounded-2xl p-6 space-y-4 shadow-lg shadow-black/40 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-cyan-400" />
              <span>Vendas Recentes</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Últimos pedidos registrados no sistema</p>
          </div>
          <Link
            href="/admin/orders"
            className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
          >
            <span>Ver todas as vendas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Nenhuma venda registrada até o momento.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase font-bold text-slate-500 tracking-wider border-b border-slate-800/60 font-mono">
                <tr>
                  <th className="pb-3">ID Pedido</th>
                  <th className="pb-3">Cliente</th>
                  <th className="pb-3">Tipo de Oferta</th>
                  <th className="pb-3">Pagamento</th>
                  <th className="pb-3">Logística</th>
                  <th className="pb-3 text-right">Total</th>
                  <th className="pb-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-slate-300">
                {recentOrders.map((order) => {
                  const payBadge = paymentBadges[order.paymentStatus]
                  const logBadge = logisticsBadges[order.logisticsStatus]
                  const hasMadeToOrder = order.items.some((i) => i.isMadeToOrder)

                  return (
                    <tr key={order.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 font-mono text-cyan-400 font-semibold">
                        #{order.id.slice(-6).toUpperCase()}
                      </td>
                      <td className="py-3.5">
                        <span className="font-semibold text-slate-200 block">
                          {order.user?.name || order.user?.username || 'Cliente'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {order.user?.email}
                        </span>
                      </td>
                      <td className="py-3.5">
                        {hasMadeToOrder ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Sob Encomenda
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Pronta Entrega
                          </span>
                        )}
                      </td>
                      <td className="py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${payBadge.style}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${payBadge.dot}`} />
                          <span>{payBadge.label}</span>
                        </span>
                      </td>
                      <td className="py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${logBadge.style}`}>
                          {logBadge.label}
                        </span>
                      </td>
                      <td className="py-3.5 text-right font-bold text-slate-100 font-mono">
                        {formatCurrency(Number(order.totalAmount))}
                      </td>
                      <td className="py-3.5 text-right">
                        <Link
                          href={`/admin/orders`}
                          className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
