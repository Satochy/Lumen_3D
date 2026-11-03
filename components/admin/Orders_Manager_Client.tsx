'use client'

import React, { useState, useTransition } from 'react'
import {
  Package,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Search,
  MapPin,
  FileText,
  ChevronDown,
  ChevronUp,
  Send,
  ShoppingBag,
  CreditCard,
  Clock,
} from 'lucide-react'
import { formatCurrency } from '@/lib/format_currency'
import type { PaymentStatus, LogisticsStatus } from '@prisma/client'
import {
  updateOrderStatusAction,
  updateOrderTrackingAction,
  updateOrderAdminNotesAction,
  resolveOrderOccurrenceAction,
} from '@/app/actions/orders'

export interface SerializedAdminOrderItem {
  id: string
  orderId: string
  productId: string | null
  variantId: string | null
  productTitle: string
  quantity: number
  priceUnit: number
  isMadeToOrder: boolean
  productionDays: number | null
  isReady: boolean
  productionStatus?: string
  readyAt: string | null
  readyByUserId: string | null
  product: {
    id: string
    title: string
    slug: string
    images: string[]
    stock: number
    reservedStock: number
    isMadeToOrder: boolean
    productionDays: number | null
  } | null
}

export interface SerializedAdminOrderOccurrence {
  id: string
  orderId: string
  type: string
  status: string
  description: string
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export interface SerializedShippingAddressSnapshot {
  street?: string
  number?: string
  complement?: string | null
  neighborhood?: string
  city?: string
  state?: string
  zipCode?: string
  serviceName?: string
  isLocalDelivery?: boolean
  [key: string]: unknown
}

export interface SerializedAdminOrder {
  id: string
  userId: string
  paymentStatus: PaymentStatus
  logisticsStatus: LogisticsStatus
  totalAmount: number
  shippingCost: number
  trackingCode: string | null
  isLocalDelivery: boolean
  isAssistedSale: boolean
  adminNotes: string | null
  externalPaymentId: string | null
  paymentMethod: string | null
  hasOpenOccurrence: boolean
  expiresAt: string | null
  paidAt: string | null
  cancelledAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  createdAt: string
  user: {
    id: string
    name: string | null
    username: string
    email: string
    phone: string | null
  } | null
  items: SerializedAdminOrderItem[]
  occurrences: SerializedAdminOrderOccurrence[]
  shippingAddressSnapshot?: SerializedShippingAddressSnapshot | null
}

interface OrdersManagerClientProps {
  initialOrders: SerializedAdminOrder[]
  defaultTab?: string
}

const paymentBadges: Record<
  PaymentStatus,
  { label: string; style: string; dot: string }
> = {
  PENDING: {
    label: 'Aguardando',
    style: 'bg-[#2f2005] text-amber-300 border-amber-900/70',
    dot: 'bg-amber-400',
  },
  PAID: {
    label: 'Pago',
    style: 'bg-[#062c1d] text-emerald-300 border-emerald-900/70',
    dot: 'bg-emerald-400',
  },
  FAILED: {
    label: 'Recusado',
    style: 'bg-[#2c0e12] text-rose-300 border-rose-900/70',
    dot: 'bg-rose-400',
  },
  REFUNDED: {
    label: 'Reembolsado',
    style: 'bg-[#131722] text-slate-400 border-slate-800',
    dot: 'bg-slate-400',
  },
}

const logisticsBadges: Record<
  LogisticsStatus,
  { label: string; style: string }
> = {
  PREPARING: {
    label: 'Na Fila',
    style: 'bg-[#121624] text-slate-300 border-slate-800',
  },
  PRODUCING: {
    label: 'Em Produção',
    style: 'bg-[#191533] text-indigo-300 border-indigo-900/60',
  },
  PRINTING: {
    label: 'Em Impressão',
    style: 'bg-[#0c1f38] text-sky-300 border-sky-900/60',
  },
  POST_PROCESSING: {
    label: 'Acabamento',
    style: 'bg-[#221035] text-purple-300 border-purple-900/60',
  },
  READY_FOR_SHIPPING: {
    label: 'Pronto p/ Envio',
    style: 'bg-[#072524] text-teal-300 border-teal-900/60',
  },
  SHIPPED: {
    label: 'Enviado',
    style: 'bg-[#0c2238] text-blue-300 border-blue-900/60',
  },
  DELIVERED: {
    label: 'Entregue',
    style: 'bg-[#062c1d] text-emerald-300 border-emerald-900/70',
  },
  CANCELLED: {
    label: 'Cancelado',
    style: 'bg-[#2c0e12] text-rose-300 border-rose-900/70',
  },
}

const allLogisticsStatuses: LogisticsStatus[] = [
  'PREPARING',
  'PRODUCING',
  'PRINTING',
  'POST_PROCESSING',
  'READY_FOR_SHIPPING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]

export default function Orders_Manager_Client({
  initialOrders,
  defaultTab = 'todos',
}: OrdersManagerClientProps) {
  const [orders, setOrders] = useState<SerializedAdminOrder[]>(initialOrders)
  const [activeTab, setActiveTab] = useState<string>(defaultTab)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [isPending, startTransition] = useTransition()
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({})
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({})
  const [notesInputs, setNotesInputs] = useState<Record<string, string>>({})

  // Contadores para as tabs de Vendas
  const paidOrders = orders.filter((o) => o.paymentStatus === 'PAID')
  const pendingOrders = orders.filter((o) => o.paymentStatus === 'PENDING')
  const readyOrders = orders.filter((o) => o.logisticsStatus === 'READY_FOR_SHIPPING')
  const shippedOrders = orders.filter((o) => o.logisticsStatus === 'SHIPPED')
  const deliveredOrders = orders.filter((o) => o.logisticsStatus === 'DELIVERED')
  const occurrenceOrders = orders.filter(
    (o) => o.hasOpenOccurrence || o.logisticsStatus === 'CANCELLED'
  )

  // Filtragem ativa por tab e termo de busca
  const filteredOrders = orders.filter((order) => {
    if (activeTab === 'pagos') {
      if (order.paymentStatus !== 'PAID') return false
    } else if (activeTab === 'pendentes') {
      if (order.paymentStatus !== 'PENDING') return false
    } else if (activeTab === 'envio') {
      if (order.logisticsStatus !== 'READY_FOR_SHIPPING') return false
    } else if (activeTab === 'transito') {
      if (order.logisticsStatus !== 'SHIPPED') return false
    } else if (activeTab === 'entregues') {
      if (order.logisticsStatus !== 'DELIVERED') return false
    } else if (activeTab === 'ocorrencias') {
      if (!order.hasOpenOccurrence && order.logisticsStatus !== 'CANCELLED') return false
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      const matchId = order.id.toLowerCase().includes(q)
      const matchClient =
        order.user?.name?.toLowerCase().includes(q) ||
        order.user?.username?.toLowerCase().includes(q) ||
        order.user?.email?.toLowerCase().includes(q)
      const matchProduct = order.items.some((i) =>
        i.productTitle.toLowerCase().includes(q)
      )
      return matchId || matchClient || matchProduct
    }

    return true
  })

  const toggleExpand = (orderId: string) => {
    setExpandedOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }))
  }

  // Ação de transição logística global
  const handleStatusChange = (orderId: string, newStatus: LogisticsStatus) => {
    startTransition(async () => {
      const res = await updateOrderStatusAction(orderId, newStatus)
      if (res.success) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId ? { ...o, logisticsStatus: newStatus } : o
          )
        )
      } else {
        alert(res.error || 'Erro ao alterar status do pedido.')
      }
    })
  }

  // Ação de salvar rastreio / despachar
  const handleSaveTracking = (orderId: string, markShipped: boolean = false) => {
    const code = trackingInputs[orderId] || ''
    startTransition(async () => {
      const res = await updateOrderTrackingAction(orderId, code, markShipped)
      if (res.success) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  trackingCode: code || o.trackingCode,
                  logisticsStatus: markShipped ? 'SHIPPED' : o.logisticsStatus,
                }
              : o
          )
        )
      } else {
        alert(res.error || 'Erro ao salvar rastreio.')
      }
    })
  }

  // Ação de salvar notas internas
  const handleSaveNotes = (orderId: string) => {
    const notes = notesInputs[orderId] ?? ''
    startTransition(async () => {
      const res = await updateOrderAdminNotesAction(orderId, notes)
      if (res.success) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, adminNotes: notes || null } : o))
        )
      }
    })
  }

  // Ação de resolver ocorrência
  const handleResolveOccurrence = (orderId: string, occurrenceId: string) => {
    startTransition(async () => {
      const res = await resolveOrderOccurrenceAction(
        orderId,
        occurrenceId,
        'Resolvido pelo operador.'
      )
      if (res.success) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  hasOpenOccurrence: false,
                  occurrences: o.occurrences.filter((occ) => occ.id !== occurrenceId),
                }
              : o
          )
        )
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Barra de Tabs Operacionais de Vendas & Busca */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setActiveTab('todos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'todos'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Todos</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-800 text-slate-300 font-bold">
              {orders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('pagos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'pagos'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pagos</span>
            {paidOrders.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 font-bold">
                {paidOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('pendentes')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'pendentes'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Aguardando</span>
            {pendingOrders.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 font-bold">
                {pendingOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('envio')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'envio'
                ? 'bg-teal-500/15 text-teal-300 border border-teal-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
            <span>Prontos p/ Envio</span>
            {readyOrders.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-teal-500/20 text-teal-300 font-bold">
                {readyOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('transito')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'transito'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Em Transporte</span>
            {shippedOrders.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-cyan-500/20 text-cyan-300 font-bold">
                {shippedOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('entregues')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'entregues'
                ? 'bg-slate-800 text-slate-200 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-slate-400" />
            <span>Entregues</span>
            {deliveredOrders.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-800 text-slate-300 font-bold">
                {deliveredOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('ocorrencias')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'ocorrencias'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Ocorrências</span>
            {occurrenceOrders.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-rose-500/30 text-rose-200 font-bold">
                {occurrenceOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* Campo de Busca Rápida */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por ID, cliente ou peça..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Tabela de Vendas Moderna (Order List) */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#080d1e]/90 shadow-2xl overflow-hidden backdrop-blur-sm">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-400">
              Nenhum pedido encontrado nesta visualização.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Alterne a aba ou limpe o termo de busca.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/60 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">N° Pedido</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Preço</th>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Pagamento</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-xs">
                {filteredOrders.map((order) => {
                  const payBadge = paymentBadges[order.paymentStatus]
                  const logBadge = logisticsBadges[order.logisticsStatus]
                  const isExpanded = expandedOrders[order.id] ?? false
                  const hasMadeToOrder = order.items.some((i) => i.isMadeToOrder)
                  const totalItems = order.items.reduce((acc, i) => acc + i.quantity, 0)

                  return (
                    <React.Fragment key={order.id}>
                      <tr
                        className={`transition-colors duration-150 ${
                          order.hasOpenOccurrence
                            ? 'bg-rose-950/20 hover:bg-rose-950/30'
                            : 'hover:bg-slate-900/50'
                        }`}
                      >
                        {/* 1. N° Pedido */}
                        <td className="py-3.5 px-4 font-mono">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-100">
                              #{order.id.slice(-6).toUpperCase()}
                            </span>
                            {order.hasOpenOccurrence && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/80 text-[10px] font-bold"
                                title="Ocorrência pendente de revisão"
                              >
                                <AlertTriangle className="w-2.5 h-2.5 text-rose-400 animate-pulse" />
                                <span>Atenção</span>
                              </span>
                            )}
                            {order.isLocalDelivery && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[10px] text-cyan-400 font-mono"
                                title="Entrega Local Grátis"
                              >
                                <MapPin className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2. Cliente */}
                        <td className="py-3.5 px-4">
                          <div className="min-w-0 max-w-[160px] sm:max-w-[200px]">
                            <p className="font-semibold text-slate-200 truncate">
                              {order.user?.name || order.user?.username || 'Cliente Balcão'}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono truncate">
                              {order.user?.email || 'Sem e-mail'}
                            </p>
                          </div>
                        </td>

                        {/* 3. Tipo */}
                        <td className="py-3.5 px-4">
                          {hasMadeToOrder ? (
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#241a0e] text-amber-300 border border-amber-900/60 inline-flex items-center">
                              Sob Encomenda
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#0e221b] text-emerald-300 border border-emerald-900/60 inline-flex items-center">
                              Pronta Entrega
                            </span>
                          )}
                        </td>

                        {/* 4. Preço */}
                        <td className="py-3.5 px-4 font-mono">
                          <p className="font-bold text-slate-100">
                            {formatCurrency(order.totalAmount)}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {totalItems} {totalItems === 1 ? 'item' : 'itens'}
                          </p>
                        </td>

                        {/* 5. Data */}
                        <td className="py-3.5 px-4 font-mono text-slate-300">
                          <p>{new Date(order.createdAt).toLocaleDateString('pt-BR')}</p>
                          <p className="text-[10px] text-slate-500">
                            {new Date(order.createdAt).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </td>

                        {/* 6. Pagamento (Cores sólidas e sutis) */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border inline-flex items-center gap-1.5 ${payBadge.style}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${payBadge.dot}`} />
                            <span>{payBadge.label}</span>
                          </span>
                        </td>

                        {/* 7. Status Logístico (Cores sólidas e sutis) */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border inline-flex items-center ${logBadge.style}`}
                          >
                            {logBadge.label}
                          </span>
                        </td>

                        {/* 8. Ação: Dropdown de status logístico global & Expansor */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Dropdown de status logístico global */}
                            <select
                              value={order.logisticsStatus}
                              onChange={(e) =>
                                handleStatusChange(
                                  order.id,
                                  e.target.value as LogisticsStatus
                                )
                              }
                              disabled={isPending}
                              aria-label={`Alterar status logístico do pedido #${order.id.slice(-6).toUpperCase()}`}
                              className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 text-[11px] font-medium text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer transition"
                              title="Alterar status logístico global"
                            >
                              {allLogisticsStatuses.map((st) => (
                                <option
                                  key={st}
                                  value={st}
                                  className="bg-slate-950 text-slate-200"
                                >
                                  {logisticsBadges[st].label}
                                </option>
                              ))}
                            </select>

                            {/* Botão de expansão dos detalhes */}
                            <button
                              onClick={() => toggleExpand(order.id)}
                              className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition"
                              title={isExpanded ? 'Recolher detalhes' : 'Ver detalhes do pedido'}
                              aria-label={isExpanded ? 'Recolher detalhes' : 'Ver detalhes do pedido'}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Gaveta de Detalhes Expansível */}
                      {isExpanded && (
                        <tr className="bg-slate-950/70 border-b border-slate-800/80">
                          <td colSpan={8} className="p-4 sm:p-5">
                            <div className="space-y-4">
                              {/* Alerta de Ocorrência se houver */}
                              {order.hasOpenOccurrence && (
                                <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-2.5">
                                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                    <div>
                                      <span className="text-xs font-bold text-rose-200">
                                        Ocorrência Aberta: Revisão de Divergência
                                      </span>
                                      {order.occurrences?.[0] && (
                                        <p className="text-[11px] text-rose-300/90 mt-0.5">
                                          {order.occurrences[0].description} (
                                          {order.occurrences[0].type})
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  {order.occurrences?.[0] && (
                                    <button
                                      onClick={() =>
                                        handleResolveOccurrence(
                                          order.id,
                                          order.occurrences[0].id
                                        )
                                      }
                                      disabled={isPending}
                                      className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-semibold text-[11px] transition shrink-0"
                                    >
                                      Marcar Resolvida
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Lista de Itens do Pedido */}
                              <div className="space-y-2">
                                <span className="text-xs font-bold text-slate-300">
                                  Peças do Pedido ({totalItems} un):
                                </span>
                                <div className="divide-y divide-slate-800/60 bg-slate-900/40 rounded-xl border border-slate-800/60 p-3">
                                  {order.items.map((item) => (
                                    <div
                                      key={item.id}
                                      className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-4 text-xs"
                                    >
                                      <div className="flex items-center gap-3">
                                        {item.product?.images?.[0] ? (
                                          /* eslint-disable-next-line @next/next/no-img-element */
                                          <img
                                            src={item.product.images[0]}
                                            alt={item.productTitle}
                                            className="w-8 h-8 rounded-lg object-cover border border-slate-800"
                                          />
                                        ) : (
                                          <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                                            <Package className="w-3.5 h-3.5" />
                                          </div>
                                        )}
                                        <div>
                                          <span className="font-semibold text-slate-200">
                                            {item.productTitle}
                                          </span>
                                          <span className="text-slate-400 ml-2 font-mono">
                                            x{item.quantity}
                                          </span>
                                          <span className="text-[10px] text-slate-500 block">
                                            Unitário: {formatCurrency(item.priceUnit)}
                                          </span>
                                        </div>
                                      </div>

                                      <div>
                                        {item.isMadeToOrder ? (
                                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#241a0e] text-amber-300 border border-amber-900/60">
                                            Sob Encomenda
                                            {item.productionDays
                                              ? ` (${item.productionDays}d)`
                                              : ''}
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0e221b] text-emerald-300 border border-emerald-900/60">
                                            Pronta Entrega
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Painel Duplo: Entrega/Rastreio & Notas Internas */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Dados de Entrega & Rastreio */}
                                <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-2.5 text-xs">
                                  <div className="flex items-center justify-between text-slate-300 font-bold">
                                    <span className="flex items-center gap-1.5">
                                      <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                                      <span>Endereço de Entrega</span>
                                    </span>
                                    <span className="text-[11px] text-cyan-400 font-mono font-bold">
                                      Frete: {formatCurrency(order.shippingCost)}
                                    </span>
                                  </div>

                                  {order.shippingAddressSnapshot ? (
                                    <div className="text-slate-400 space-y-0.5 text-[11px] leading-relaxed">
                                      <p className="text-slate-200 font-medium">
                                        {order.shippingAddressSnapshot.street},{' '}
                                        {order.shippingAddressSnapshot.number}
                                        {order.shippingAddressSnapshot.complement
                                          ? ` (${order.shippingAddressSnapshot.complement})`
                                          : ''}
                                      </p>
                                      <p>
                                        {order.shippingAddressSnapshot.neighborhood} —{' '}
                                        {order.shippingAddressSnapshot.city}/
                                        {order.shippingAddressSnapshot.state}
                                      </p>
                                      <p className="font-mono text-cyan-300">
                                        CEP: {order.shippingAddressSnapshot.zipCode}
                                      </p>
                                      <p className="text-slate-500 pt-0.5">
                                        Modalidade:{' '}
                                        {order.shippingAddressSnapshot.serviceName ||
                                          (order.isLocalDelivery
                                            ? 'Entrega Local'
                                            : 'Padrão')}
                                      </p>
                                    </div>
                                  ) : (
                                    <p className="text-slate-500 text-xs">
                                      Endereço não informado ou snapshot indisponível.
                                    </p>
                                  )}

                                  {/* Código de Rastreio */}
                                  <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                                    <input
                                      type="text"
                                      defaultValue={order.trackingCode || ''}
                                      onChange={(e) =>
                                        setTrackingInputs((prev) => ({
                                          ...prev,
                                          [order.id]: e.target.value,
                                        }))
                                      }
                                      placeholder="Código de Rastreio (Melhor Envio)"
                                      className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                                    />
                                    <button
                                      onClick={() => handleSaveTracking(order.id, false)}
                                      disabled={isPending}
                                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg transition"
                                    >
                                      Salvar
                                    </button>
                                    {order.logisticsStatus === 'READY_FOR_SHIPPING' && (
                                      <button
                                        onClick={() =>
                                          handleSaveTracking(order.id, true)
                                        }
                                        disabled={isPending}
                                        className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white rounded-lg transition flex items-center gap-1 shadow-md shadow-cyan-950/40"
                                      >
                                        <Send className="w-3 h-3" />
                                        <span>Despachar</span>
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Notas Internas dos Sócios */}
                                <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-2 text-xs flex flex-col justify-between">
                                  <div className="space-y-1">
                                    <span className="flex items-center gap-1.5 text-slate-300 font-bold">
                                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                                      <span>Notas Internas da Venda</span>
                                    </span>
                                    <textarea
                                      defaultValue={order.adminNotes || ''}
                                      onChange={(e) =>
                                        setNotesInputs((prev) => ({
                                          ...prev,
                                          [order.id]: e.target.value,
                                        }))
                                      }
                                      placeholder="Anotações internas sobre esta venda..."
                                      rows={3}
                                      className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                                    />
                                  </div>
                                  <div className="flex justify-end pt-1">
                                    <button
                                      onClick={() => handleSaveNotes(order.id)}
                                      disabled={isPending}
                                      className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold rounded-lg transition"
                                    >
                                      Salvar Notas
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
