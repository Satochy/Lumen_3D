'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { PaymentStatus } from '@prisma/client'
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Package,
  Truck,
  ShoppingBag,
  Clock,
  CheckCircle2,
  MapPin,
  XCircle,
} from 'lucide-react'
import { isOrderExpired } from '@/lib/order_presenter'
import {
  type SerializedClientOrder,
  confirmOrderDeliveryByClientAction,
  finalizeOrderByClientAction,
  cancelOrderByClientAction,
} from '@/app/actions/client_orders_actions'
import { formatCurrency } from '@/lib/format_currency'

const paymentLabels: Record<PaymentStatus, { label: string; style: string }> = {
  PENDING: {
    label: 'Aguardando Pagamento',
    style: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  PAID: {
    label: 'Pago',
    style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  FAILED: {
    label: 'Recusado / Falhou',
    style: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  },
  REFUNDED: {
    label: 'Reembolsado',
    style: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  },
}

function getClientLogisticsBadge(order: SerializedClientOrder): { label: string; style: string } {
  if (order.logisticsStatus === 'CANCELLED' || Boolean(order.cancelledAt)) {
    return {
      label: 'Cancelado',
      style: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    }
  }

  if (isOrderExpired(order)) {
    return {
      label: '',
      style: 'hidden',
    }
  }

  if (order.paymentStatus !== 'PAID') {
    return {
      label: '',
      style: 'hidden',
    }
  }

  if (
    order.logisticsStatus === 'PREPARING' ||
    order.logisticsStatus === 'PRODUCING' ||
    order.logisticsStatus === 'PRINTING' ||
    order.logisticsStatus === 'POST_PROCESSING'
  ) {
    if (order.isHybrid) {
      return {
        label: 'Aguardando Produção',
        style: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
      }
    }
    if (order.logisticsStatus === 'PREPARING') {
      return {
        label: 'Na Fila',
        style: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
      }
    }
    return {
      label: 'Em Produção',
      style: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    }
  }

  if (order.logisticsStatus === 'READY_FOR_SHIPPING') {
    return {
      label: 'Aguardando Envio',
      style: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    }
  }

  if (order.logisticsStatus === 'SHIPPED') {
    if (order.isLocalDelivery) {
      return {
        label: 'Enviado',
        style: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
      }
    }
    return {
      label: 'A Caminho',
      style: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    }
  }

  if (order.logisticsStatus === 'DELIVERED') {
    if (order.isFinalized) {
      return {
        label: 'Finalizado',
        style: 'bg-emerald-500 text-slate-950 font-black border-emerald-400 shadow-sm',
      }
    }
    return {
      label: 'Entregue',
      style: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    }
  }

  return {
    label: 'Na Fila',
    style: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  }
}

interface MyOrdersClientProps {
  orders: SerializedClientOrder[]
}

export default function My_Orders_Client({ orders }: MyOrdersClientProps) {
  const [isPending, startTransition] = useTransition()
  const [localOrders, setLocalOrders] = useState<SerializedClientOrder[]>(orders)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  // Inicia expandido para o pedido mais recente se existir
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() => {
    if (orders.length > 0) {
      return { [orders[0].id]: true }
    }
    return {}
  })

  const toggleOrder = (orderId: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }))
  }

  const handleConfirmReceipt = (orderId: string) => {
    if (!window.confirm('Confirma que recebeu esta encomenda em mãos?')) return
    startTransition(async () => {
      const res = await confirmOrderDeliveryByClientAction(orderId)
      if (res.success) {
        setLocalOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  logisticsStatus: 'DELIVERED',
                  deliveredAt: new Date().toISOString(),
                }
              : o
          )
        )
      } else {
        alert(res.error || 'Não foi possível confirmar o recebimento.')
      }
    })
  }

  const handleFinalizeOrder = (orderId: string) => {
    if (
      !window.confirm(
        'Deseja finalizar este pedido agora? Esta ação é definitiva e conclui a compra.'
      )
    )
      return
    startTransition(async () => {
      const res = await finalizeOrderByClientAction(orderId)
      if (res.success) {
        setLocalOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, isFinalized: true } : o))
        )
      } else {
        alert(res.error || 'Não foi possível finalizar o pedido.')
      }
    })
  }

  const handleOpenCancelModal = (orderId: string) => {
    setCancelOrderId(orderId)
    setCancelReason('')
    setIsCancelModalOpen(true)
  }

  const handleCloseCancelModal = () => {
    setIsCancelModalOpen(false)
    setCancelOrderId(null)
    setCancelReason('')
  }

  const handleConfirmCancel = () => {
    if (!cancelOrderId) return
    const orderId = cancelOrderId
    const reason = cancelReason.trim()

    startTransition(async () => {
      const res = await cancelOrderByClientAction(orderId, reason || undefined)
      if (res.success) {
        setLocalOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  logisticsStatus: 'CANCELLED',
                  cancelledAt: new Date().toISOString(),
                }
              : o
          )
        )
        handleCloseCancelModal()
      } else {
        alert(res.error || 'Não foi possível cancelar o pedido.')
      }
    })
  }

  if (localOrders.length === 0) {
    return (
      <div className="bg-[#0a0e1a] border border-slate-800/80 rounded-2xl p-12 text-center space-y-5">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
          <ShoppingBag className="w-7 h-7" aria-hidden="true" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-white">Nenhum pedido encontrado</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Você ainda não realizou nenhum pedido na Lúmen 3D. Explore nosso catálogo de peças a pronta entrega e sob encomenda!
          </p>
        </div>
        <Link
          href="/marketplace"
          aria-label="Ir para o Marketplace e ver produtos disponíveis"
          className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl transition btn-fx"
        >
          Explorar Marketplace
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {localOrders.map((order) => {
        const shortId = order.id.slice(0, 8)
        const isExpanded = Boolean(expandedIds[order.id])
        const detailsPanelId = `order-details-${order.id}`
        const isCancelled =
          order.logisticsStatus === 'CANCELLED' || Boolean(order.cancelledAt)
        const isExpired = isOrderExpired(order)
        const canPayNow =
          order.paymentStatus === 'PENDING' && !isCancelled && !isExpired

        const canCancelClient =
          !isCancelled &&
          !isExpired &&
          !order.isFinalized &&
          !['SHIPPED', 'DELIVERED'].includes(order.logisticsStatus)

        const canConfirmLocalReceipt =
          order.logisticsStatus === 'SHIPPED' &&
          order.isLocalDelivery &&
          !order.isFinalized

        const canFinalizeNow =
          order.logisticsStatus === 'DELIVERED' && !order.isFinalized

        const payBadge =
          isCancelled && order.paymentStatus === 'PENDING'
            ? {
                label: 'Cancelado',
                style: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
              }
            : isExpired
            ? {
                label: 'Cancelado',
                style: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
              }
            : paymentLabels[order.paymentStatus]
        const logBadge = getClientLogisticsBadge(order)
        const purchaseDate = new Date(order.createdAt).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })

        const itemsSubtotal = order.items.reduce(
          (acc, item) => acc + item.priceUnit * item.quantity,
          0
        )

        const showTrackingHighlight =
          (order.logisticsStatus === 'SHIPPED' || order.logisticsStatus === 'DELIVERED') &&
          Boolean(order.trackingCode)

        const trackingUrl = order.trackingCode
          ? `https://app.melhorenvio.com.br/rastreamento/?ids=${encodeURIComponent(order.trackingCode)}`
          : null

        const addressSnapshot = order.shippingAddressSnapshot

        return (
          <article
            key={order.id}
            className="bg-[#0a0e1a] border border-slate-800/90 hover:border-slate-700/80 rounded-2xl overflow-hidden transition"
          >
            {/* Cabeçalho principal do Card do Pedido */}
            <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 shrink-0">
                    <Package className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Pedido</span>
                      <span className="font-mono text-sm font-bold text-white">
                        #{shortId}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-500" aria-hidden="true" />
                      Realizado em {purchaseDate}
                    </p>
                  </div>
                </div>

                {/* Badges de Status Financeiro e Logístico */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2.5 py-1 text-[11px] font-bold border rounded-md ${payBadge.style}`}
                  >
                    {payBadge.label}
                  </span>
                  {!(isCancelled && order.paymentStatus === 'PENDING') && (
                    <span
                      className={`px-2.5 py-1 text-[11px] font-bold border rounded-md uppercase tracking-wider ${logBadge.style}`}
                    >
                      {logBadge.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Valor Total e Ações */}
              <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-800/80">
                <div className="text-left lg:text-right mr-1">
                  <p className="text-[11px] text-slate-400">Total do Pedido</p>
                  <p className="text-base font-black text-cyan-400">
                    {formatCurrency(order.totalAmount)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canPayNow && (
                    <Link
                      href={`/marketplace/checkout/${order.id}`}
                      aria-label={`Pagar agora o pedido ${shortId}`}
                      className="px-3.5 py-2 text-xs font-bold rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition"
                    >
                      Pagar Agora
                    </Link>
                  )}

                  {canConfirmLocalReceipt && (
                    <button
                      type="button"
                      onClick={() => handleConfirmReceipt(order.id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-sm cursor-pointer disabled:opacity-50"
                      title="Confirmar recebimento do pacote entregue pela frota local"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirmar Recebimento</span>
                    </button>
                  )}

                  {canFinalizeNow && (
                    <button
                      type="button"
                      onClick={() => handleFinalizeOrder(order.id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm cursor-pointer disabled:opacity-50"
                      title="Finalizar e concluir pedido agora"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Finalizar Pedido</span>
                    </button>
                  )}

                  {canCancelClient && (
                    <button
                      type="button"
                      onClick={() => handleOpenCancelModal(order.id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition cursor-pointer disabled:opacity-50"
                      title="Cancelar este pedido"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span>Cancelar</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => toggleOrder(order.id)}
                    aria-expanded={isExpanded}
                    aria-controls={detailsPanelId}
                    aria-label={
                      isExpanded
                        ? `Ocultar detalhes do pedido ${shortId}`
                        : `Expandir detalhes do pedido ${shortId}`
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 transition cursor-pointer"
                  >
                    <span>{isExpanded ? 'Ocultar Detalhes' : 'Ver Detalhes'}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Banner de Timeout de Pagamento */}
            {isExpired && (
              <div className="mx-5 sm:mx-6 mb-4 p-3.5 rounded-xl bg-gray-950/20 border border-gray-500/30 flex items-center gap-2.5 text-xs text-gray-300">
                <AlertCircle className="w-4 h-4 text-gray-400 shrink-0" />
                <span>
                  O prazo de pagamento deste pedido expirou.
                </span>
              </div>
            )}

            {/* Banner de Entrega Local em Trânsito (Frota Própria) */}
            {canConfirmLocalReceipt && (
              <div className="mx-5 sm:mx-6 mb-4 p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <Truck className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-slate-200">
                    Sua encomenda saiu para entrega sob responsabilidade da Lúmen 3D. Já recebeu o produto?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleConfirmReceipt(order.id)}
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirmar Recebimento</span>
                </button>
              </div>
            )}

            {/* Banner da Janela de 3 Dias para Pedidos DELIVERED e ainda não finalizados */}
            {canFinalizeNow && (
              <div className="mx-5 sm:mx-6 mb-4 p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-slate-200">
                    Sua encomenda foi entregue. Este pedido será finalizado automaticamente após 3 dias da entrega.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleFinalizeOrder(order.id)}
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Finalizar Agora</span>
                </button>
              </div>
            )}

            {/* Banner Crítico de Rastreio quando SHIPPED ou DELIVERED com trackingCode */}
            {showTrackingHighlight && trackingUrl && (
              <div className="mx-5 sm:mx-6 mb-4 p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                    {order.logisticsStatus === 'DELIVERED' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                    ) : (
                      <Truck className="w-5 h-5 text-cyan-400" aria-hidden="true" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">
                      {order.logisticsStatus === 'DELIVERED'
                        ? 'Encomenda Entregue'
                        : 'Encomenda em Trânsito'}
                    </p>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Código de Rastreio:{' '}
                      <strong className="font-mono text-cyan-400 select-all">
                        {order.trackingCode}
                      </strong>
                    </p>
                  </div>
                </div>

                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Rastrear entrega do pedido ${shortId} com código ${order.trackingCode} no Melhor Envio`}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition w-fit"
                >
                  <span>Rastrear Encomenda</span>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </div>
            )}

            {/* Accordion de Detalhes do Pedido */}
            {isExpanded && (
              <div
                id={detailsPanelId}
                className="border-t border-slate-800/80 bg-slate-950/50 p-5 sm:p-6 space-y-5"
              >
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Itens do Pedido ({order.items.length})
                  </h3>
                  <ul className="divide-y divide-slate-800/60 bg-slate-900/40 border border-slate-800/70 rounded-xl px-4">
                    {order.items.map((item) => {
                      const lineTotal = item.priceUnit * item.quantity
                      return (
                        <li
                          key={item.id}
                          className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-slate-100">
                                {item.productTitle}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold text-[11px]">
                                Qtd: {item.quantity}
                              </span>
                              {item.isMadeToOrder ? (
                                <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-semibold">
                                  Sob Encomenda
                                  {item.productionDays
                                    ? ` (${item.productionDays}d úteis)`
                                    : ''}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-semibold">
                                  Pronta Entrega
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400">
                              Preço unitário: {formatCurrency(item.priceUnit)}
                            </p>
                          </div>

                          <div className="text-left sm:text-right font-bold text-slate-200">
                            {formatCurrency(lineTotal)}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                {/* Resumo Financeiro e Logístico */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="bg-slate-900/40 border border-slate-800/70 rounded-xl p-4 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-300 font-bold mb-1">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
                      <span>Informações de Entrega</span>
                    </div>

                    {order.isLocalDelivery ? (
                      <p className="text-emerald-400 font-semibold">
                        Modalidade: Entrega Local Gratuita (Frota Lúmen 3D)
                      </p>
                    ) : (
                      <p className="text-slate-300">
                        Modalidade:{' '}
                        <span className="font-semibold text-white">
                          {typeof addressSnapshot?.serviceName === 'string'
                            ? addressSnapshot.serviceName
                            : 'Transportadora'}
                        </span>
                      </p>
                    )}

                    {addressSnapshot && typeof addressSnapshot.street === 'string' && (
                      <p className="text-slate-400 leading-relaxed">
                        {String(addressSnapshot.street)}, {String(addressSnapshot.number || 'S/N')}
                        {addressSnapshot.complement
                          ? ` — ${String(addressSnapshot.complement)}`
                          : ''}
                        <br />
                        {String(addressSnapshot.neighborhood || '')} —{' '}
                        {String(addressSnapshot.city || '')}/{String(addressSnapshot.state || '')}
                        {addressSnapshot.zipCode
                          ? ` (CEP: ${String(addressSnapshot.zipCode)})`
                          : ''}
                      </p>
                    )}

                    {!showTrackingHighlight && (
                      <p className="text-[11px] text-slate-400 pt-1">
                        {order.isLocalDelivery
                          ? 'A entrega local é realizada diretamente pela equipe Lúmen 3D.'
                          : 'O código de rastreio será disponibilizado assim que o pacote for despachado.'}
                      </p>
                    )}
                  </div>

                  <div className="bg-slate-900/40 border border-slate-800/70 rounded-xl p-4 flex flex-col justify-between space-y-2 text-xs">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-slate-400">
                        <span>Subtotal dos itens:</span>
                        <span className="text-slate-200 font-medium">
                          {formatCurrency(itemsSubtotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Frete:</span>
                        <span className="text-slate-200 font-medium">
                          {order.shippingCost === 0
                            ? 'Grátis'
                            : formatCurrency(order.shippingCost)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                      <span className="font-bold text-slate-200">Total Pago:</span>
                      <span className="text-sm font-black text-cyan-400">
                        {formatCurrency(order.totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </article>
        )
      })}
      {/* Modal Customizado de Cancelamento de Pedido */}
      {isCancelModalOpen && cancelOrderId && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-white">Cancelar Pedido</h3>
            <p className="text-xs text-slate-400">
              Tem certeza que deseja cancelar este pedido? Se desejar, informe o motivo do cancelamento abaixo.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Motivo do cancelamento (opcional)"
              rows={3}
              disabled={isPending}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition resize-none"
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCloseCancelModal}
                disabled={isPending}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/20 cursor-pointer disabled:opacity-50"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
