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
  ShoppingBag,
  ShieldAlert,
} from 'lucide-react'
import Dashboard_Action_Shortcuts from '@/components/admin/Dashboard_Action_Shortcuts'
import Admin_Orders_Table from '@/components/admin/Admin_Orders_Table'
import type { PresentableOrderInput } from '@/lib/order_presenter'

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
      take: 5,
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
            priceUnit: true,
            isMadeToOrder: true,
            productionStatus: true,
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

  const serializedRecentOrders: PresentableOrderInput[] = recentOrders.map((order) => ({
    id: order.id,
    paymentStatus: order.paymentStatus,
    logisticsStatus: order.logisticsStatus,
    totalAmount: Number(order.totalAmount),
    shippingCost: Number(order.shippingCost),
    isLocalDelivery: order.isLocalDelivery,
    isAssistedSale: order.isAssistedSale,
    assistedSaleExpectedEmail: order.assistedSaleExpectedEmail,
    adminNotes: order.adminNotes,
    hasOpenOccurrence: order.hasOpenOccurrence,
    createdAt: order.createdAt.toISOString(),
    cancelledAt: order.cancelledAt ? order.cancelledAt.toISOString() : null,
    shippingAddressSnapshot:
      order.shippingAddressSnapshot &&
      typeof order.shippingAddressSnapshot === 'object' &&
      !Array.isArray(order.shippingAddressSnapshot)
        ? (order.shippingAddressSnapshot as Record<string, unknown>)
        : null,
    user: order.user,
    items: order.items.map((item) => ({
      id: item.id,
      productTitle: item.productTitle,
      quantity: item.quantity,
      priceUnit: Number(item.priceUnit),
      isMadeToOrder: item.isMadeToOrder,
      productionStatus: item.productionStatus,
    })),
  }))

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
        <div className="h-full flex flex-col justify-between bg-[#080d1e]/80 border border-slate-800/80 hover:border-emerald-500/40 p-5 rounded-2xl relative overflow-hidden group transition-all duration-300 shadow-lg shadow-black/40 backdrop-blur-md">
          <div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Receita gerada</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-sm">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-3 font-mono tracking-tight drop-shadow-[0_0_12px_rgba(52,211,153,0.2)]">
              {formatCurrency(totalRevenue)}
            </p>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60 text-[11px]">
            <span className="text-slate-500">Controle financeiro</span>
            <Link
              href="/admin/finance"
              className="text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
            >
              <span>Gerenciar</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Fila de Produção */}
        <div className="h-full flex flex-col justify-between bg-[#080d1e]/80 border border-slate-800/80 hover:border-indigo-500/40 p-5 rounded-2xl relative overflow-hidden group transition-all duration-300 shadow-lg shadow-black/40 backdrop-blur-md">
          <div>
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
          </div>
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
        <div className="h-full flex flex-col justify-between bg-[#080d1e]/80 border border-slate-800/80 hover:border-teal-500/40 p-5 rounded-2xl relative overflow-hidden group transition-all duration-300 shadow-lg shadow-black/40 backdrop-blur-md">
          <div>
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
          </div>
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
        <div className="h-full flex flex-col justify-between bg-[#080d1e]/80 border border-slate-800/80 hover:border-cyan-500/40 p-5 rounded-2xl relative overflow-hidden group transition-all duration-300 shadow-lg shadow-black/40 backdrop-blur-md">
          <div>
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
          </div>
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
              <h2 className="text-sm font-bold text-slate-100">Catálogo ({totalProducts} produtos)</h2>
            </div>
            <Link
              href="/admin/products"
              className="text-xs text-cyan-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Administrar</span>
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

          {/* Atalho par cadastrar novo produto */}
          <Link
            href="/admin/products?action=new"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 transition-colors shadow-sm">
            <div className="flex items-center gap-2.5">
              <PlusCircle className="w-4 h-4 text-cyan-400"/>
              <span>Cadastrar Produto</span>
            </div>
          </Link>

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
              <h2 className="text-sm font-bold text-slate-100">Carretéis de Filamento</h2>
            </div>
            <Link
              href="/admin/filaments"
              className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Administrar</span>
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

          <Link
            href="/admin/filaments?action=new"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 transition-colors shadow-sm">
            <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Cadastrar Filamento</span>
          </Link>

          <p className="text-xs text-slate-400 leading-relaxed">
            Mantenha o inventário de carretéis de PLA e PETG atualizado para prever pausas na produção 3D.
          </p>
        </div>

        {/* Atalhos Operacionais (Client Component com Exportação Direta) */}
        <Dashboard_Action_Shortcuts />
      </div>

      {/* Feed de Pedidos Recentes com Estilo Dark Premium */}
      <div className="bg-[#080d1e]/80 border border-slate-800/80 rounded-2xl p-6 space-y-4 shadow-lg shadow-black/40 backdrop-blur-md">
        <div className="flex items-center justify-between pb-1">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-cyan-400" />
              <span>Vendas Recentes</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Últimos 5 pedidos registrados no sistema</p>
          </div>
          <Link
            href="/admin/orders"
            className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
          >
            <span>Ver todas as vendas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <Admin_Orders_Table
          orders={serializedRecentOrders}
          mode="dashboard"
          columns={[
            'id',
            'client',
            'origin',
            'modality',
            'paymentStatus',
            'logisticsStatus',
            'total',
            'actions',
          ]}
          emptyTitle="Nenhuma venda registrada até o momento."
          emptySubtitle=""
        />
      </div>
    </div>
  )
}
