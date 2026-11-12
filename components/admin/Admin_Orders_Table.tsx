'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Package,
  PackageCheck,
  Printer,
  Send,
  Share2,
  ShoppingBag,
  Store,
  Truck,
  UserCheck,
  XCircle,
} from 'lucide-react'
import { formatCurrency } from '@/lib/format_currency'
import {
  dispatchOrderAction,
  confirmLocalDeliveryAction,
  finalizeOrderAdminAction,
} from '@/app/actions/orders'
import {
  isOrderExpired,
  normalizeAdminOrder,
  resolveOrderLogisticsPresentation,
  resolveOrderPaymentPresentation,
  UNIFIED_LOGISTICS_BADGES,
  UNIFIED_MODALITY_BADGES,
  UNIFIED_ORIGIN_BADGES,
  UNIFIED_PAYMENT_BADGES,
  type NormalizedOrderPresentation,
  type OrderLogisticsStatusKey,
  type PresentableOrderInput,
} from '@/lib/order_presenter'

export type AdminOrdersTableColumn =
  | 'id'
  | 'client'
  | 'location'
  | 'origin'
  | 'modality'
  | 'itemsValue'
  | 'shipping'
  | 'total'
  | 'paymentStatus'
  | 'logisticsStatus'
  | 'actions'

export type AdminOrdersTableMode = 'dashboard' | 'orders' | 'assisted' | 'finance'

export interface AdminOrdersTableProps {
  orders: PresentableOrderInput[]
  mode: AdminOrdersTableMode
  columns?: AdminOrdersTableColumn[]
  expandable?: boolean
  expandedOrders?: Record<string, boolean>
  expandedOrderId?: string | null
  onToggleExpand?: (orderId: string) => void
  isPending?: boolean
  emptyTitle?: string
  emptySubtitle?: string
  onStatusChange?: (orderId: string, newStatus: OrderLogisticsStatusKey) => void
  onCancelOrder?: (orderId: string) => void
  onConfirmLocalDelivery?: (orderId: string) => void
  onConfirmDelivery?: (orderId: string) => Promise<void> | void
  onFinalizeOrder?: (orderId: string) => Promise<void> | void
  onGenerateLabel?: (orderId: string) => void
  onSaveTracking?: (orderId: string, trackingCode: string, markShipped: boolean) => void
  onSaveNotes?: (orderId: string, notes: string) => void
  onResolveOccurrence?: (orderId: string, occurrenceId: string) => void
  onToggleItemReady?: (orderItemId: string) => Promise<void> | void
  onDispatchOrder?: (orderId: string, trackingCode?: string) => Promise<void> | void
  onCopyLink?: (order: NormalizedOrderPresentation) => void
  copiedOrderId?: string | null
  renderCustomActions?: (order: NormalizedOrderPresentation) => React.ReactNode
}

const DEFAULT_COLUMNS_BY_MODE: Record<AdminOrdersTableMode, AdminOrdersTableColumn[]> = {
  dashboard: [
    'id',
    'client',
    'origin',
    'modality',
    'logisticsStatus',
    'total',
    'paymentStatus',
    'actions',
  ],
  orders: [
    'id',
    'client',
    'origin',
    'modality',
    'logisticsStatus',
    'total',
    'paymentStatus',
    'actions',
  ],
  assisted: [
    'id',
    'client',
    'origin',
    'modality',
    'total',
    'paymentStatus',
    'actions',
  ],
  finance: [
    'id',
    'client',
    'origin',
    'modality',
    'itemsValue',
    'shipping',
    'total',
    'paymentStatus',
    'actions',
  ],
}

function formatTimestamp(val?: string | Date | null): string | null {
  if (!val) return null
  const d = val instanceof Date ? val : new Date(val)
  if (isNaN(d.getTime())) return null
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function parseAdminNotes(rawNotes: string | null | undefined): {
  tags: string[]
  cleanText: string
} {
  if (!rawNotes) {
    return { tags: [], cleanText: '' }
  }

  const tags: string[] = []
  const tagRegex = /\[([^\]]+)\]/g
  let match: RegExpExecArray | null
  while ((match = tagRegex.exec(rawNotes)) !== null) {
    const content = match[1].trim()
    if (content) {
      tags.push(content)
    }
  }

  let cleanText = rawNotes.replace(/\[([^\]]+)\]/g, '').trim()
  cleanText = cleanText
    .replace(/^(\s*[-•]\s*)?observa[çc][õo]es\s*:\s*/i, '')
    .replace(/^[-•]\s*/, '')
    .trim()

  return { tags, cleanText }
}

function resolvePaymentMethodLabel(order: NormalizedOrderPresentation): string {
  const rawMethod = order.raw.paymentMethod?.toLowerCase() || ''
  let method = ''
  if (rawMethod.includes('pix')) method = 'PIX'
  else if (rawMethod.includes('credit') || rawMethod.includes('cartao')) method = 'Cartão de Crédito'
  else if (rawMethod.includes('debit')) method = 'Cartão de Débito'
  else if (order.raw.paymentMethod) method = order.raw.paymentMethod

  if (order.isAssistedSale) {
    return method ? `Link Assistido (${method})` : 'Link Assistido'
  }
  return method || (order.isPaid ? 'Mercado Pago' : 'Pendente')
}

function TechnicalMetadataBar({
  order,
  originBadge,
  modalityBadge,
  paymentMethodLabel,
  onCopyId,
  copiedId,
}: {
  order: NormalizedOrderPresentation
  originBadge: { label: string; badgeClass: string }
  modalityBadge: { label: string; badgeClass: string }
  paymentMethodLabel: string
  onCopyId: (id: string) => void
  copiedId: string | null
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs">
      <div className="flex items-center gap-1.5 font-mono">
        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">ID:</span>
        <span className="text-slate-200 font-semibold select-all text-[11px]">{order.id}</span>
        <button
          type="button"
          onClick={() => onCopyId(order.id)}
          className="p-1 text-slate-500 hover:text-cyan-400 transition cursor-pointer"
          title="Copiar ID completo do pedido"
        >
          {copiedId === order.id ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Origem:</span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${originBadge.badgeClass}`}
          >
            {order.origin}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Modalidade:</span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${modalityBadge.badgeClass}`}
          >
            {order.modality}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Pagamento:</span>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900 text-slate-200 border border-slate-800">
            {paymentMethodLabel}
          </span>
        </div>

        {order.raw.externalPaymentId && (
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
              Transação Ext:
            </span>
            <span className="text-cyan-300 font-semibold text-[10px] bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
              {order.raw.externalPaymentId}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function OrderLifecycleStepper({
  order,
  originBadge,
  modalityBadge,
  onCopyId,
  copiedId,
}: {
  order: NormalizedOrderPresentation
  originBadge: { label: string; badgeClass: string }
  modalityBadge: { label: string; badgeClass: string }
  onCopyId: (id: string) => void
  copiedId: string | null
}) {
  const isPaid = order.isPaid
  const paymentMethodLabel = resolvePaymentMethodLabel(order)
  const isExpired = isOrderExpired(order)

  if (order.isCancelled || isExpired) {
    const titleText = isExpired ? 'Pedido Cancelado' : 'Pedido Cancelado'
    const descText = isExpired
      ? `Prazo de pagamento expirado. As operações de produção e logística foram suspensas.`
      : order.raw.cancelledAt
        ? `Cancelado administrativamente em ${formatTimestamp(order.raw.cancelledAt)}. As operações de produção e logística foram suspensas.`
        : 'Pedido cancelado administrativamente. As ações logísticas estão suspensas.'

    return (
      <div className="space-y-3">
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-300 shrink-0">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-rose-100 uppercase tracking-wider flex items-center gap-2">
                <span>{titleText}</span>
              </p>
              <p className="text-[11px] text-rose-300/80 mt-0.5">
                {descText}
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto px-2.5 py-1 rounded-md text-[10px] font-bold bg-rose-900/60 text-rose-300 border border-rose-700/60 uppercase tracking-wider">
            {isExpired ? 'Tempo de pagamento expirado' : 'Cancelado Administrativamente'}
          </span>
        </div>

        <TechnicalMetadataBar
          order={order}
          originBadge={originBadge}
          modalityBadge={modalityBadge}
          paymentMethodLabel={paymentMethodLabel}
          onCopyId={onCopyId}
          copiedId={copiedId}
        />
      </div>
    )
  }

  const hasProductionStep =
    order.modality === 'Sob Encomenda' ||
    order.modality === 'Híbrido' ||
    order.hasMadeToOrder

  interface StepItem {
    id: string
    title: string
    subtitle: string
    status: 'completed' | 'current' | 'upcoming'
    icon: React.ReactNode
  }

  const steps: StepItem[] = []

  // 1. Pedido Gerado
  steps.push({
    id: 'created',
    title: 'Pedido Gerado',
    subtitle: `${order.dateFormatted} às ${order.timeFormatted}`,
    status: 'completed',
    icon: <FileText className="w-3.5 h-3.5" />,
  })

  // 2. Pagamento Pendente / Realizado
  steps.push({
    id: 'payment',
    title: isPaid ? 'Pagamento Realizado' : 'Pagamento Pendente',
    subtitle: isPaid
      ? `${formatTimestamp(order.raw.paidAt) || 'Pago'}${paymentMethodLabel ? ` • ${paymentMethodLabel}` : ''}`
      : 'Aguardando confirmação',
    status: isPaid ? 'completed' : 'current',
    icon: <CreditCard className="w-3.5 h-3.5" />,
  })

  // 3. Na Fila de Produção (Condicional)
  if (hasProductionStep) {
    const isProductionDone = [
      'READY_FOR_SHIPPING',
      'SHIPPED',
      'DELIVERED',
    ].includes(order.logisticsStatus)
    const inProduction =
      isPaid &&
      ['PREPARING', 'PRODUCING', 'PRINTING', 'POST_PROCESSING'].includes(
        order.logisticsStatus
      )

    steps.push({
      id: 'production',
      title: 'Na Fila de Produção',
      subtitle: !isPaid
        ? 'Aguardando pagamento'
        : inProduction
          ? 'Em produção na oficina'
          : 'Produção concluída',
      status: isProductionDone
        ? 'completed'
        : inProduction
          ? 'current'
          : 'upcoming',
      icon: <Printer className="w-3.5 h-3.5" />,
    })
  }

  // 4. Pronto para Envio
  const isPastReady = ['SHIPPED', 'DELIVERED'].includes(order.logisticsStatus)
  const isReadyNow = order.logisticsStatus === 'READY_FOR_SHIPPING'
  steps.push({
    id: 'ready_for_shipping',
    title: 'Pronto para Envio',
    subtitle: isPastReady
      ? 'Concluído'
      : isReadyNow
        ? 'Aguardando despacho'
        : 'Aguardando etapas anteriores',
    status: isPastReady ? 'completed' : isReadyNow ? 'current' : 'upcoming',
    icon: <Package className="w-3.5 h-3.5" />,
  })

  // 5. Enviado (A Caminho / Enviado Local)
  const isShippedOrDelivered = ['SHIPPED', 'DELIVERED'].includes(
    order.logisticsStatus
  )
  const isShippedNow = order.logisticsStatus === 'SHIPPED'
  const shippedLabel = order.location.isLocal ? 'Enviado Local' : 'A Caminho'
  steps.push({
    id: 'shipped',
    title: shippedLabel,
    subtitle: isShippedOrDelivered
      ? formatTimestamp(order.raw.shippedAt) || 'Em trânsito'
      : 'Aguardando expedição',
    status:
      order.logisticsStatus === 'DELIVERED'
        ? 'completed'
        : isShippedNow
          ? 'current'
          : 'upcoming',
    icon: <Truck className="w-3.5 h-3.5" />,
  })

  // 6. Recebido
  const isDelivered = order.logisticsStatus === 'DELIVERED'
  steps.push({
    id: 'delivered',
    title: 'Recebido',
    subtitle: isDelivered
      ? formatTimestamp(order.raw.deliveredAt) || 'Entregue'
      : 'Aguardando entrega',
    status: order.isFinalized
      ? 'completed'
      : isDelivered
        ? 'current'
        : 'upcoming',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  })

  // 7. Finalizado
  steps.push({
    id: 'finalized',
    title: 'Finalizado',
    subtitle: order.isFinalized
      ? 'Pedido concluído'
      : 'Conclusão cliente ou 3 dias',
    status: order.isFinalized ? 'completed' : 'upcoming',
    icon: <PackageCheck className="w-3.5 h-3.5" />,
  })

  return (
    <div className="space-y-3">
      {/* Stepper Card */}
      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 shadow-inner">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-slate-400">
            Fluxo Operacional do Pedido
          </span>
          {order.isFinalized ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <Check className="w-3 h-3" />
              <span>Ciclo Concluído</span>
            </span>
          ) : (
            <span className="text-[10px] font-mono text-cyan-400 font-semibold">
              Etapa: {order.logisticsBadge.label}
            </span>
          )}
        </div>

        <div className="overflow-x-auto pb-4 pt-1">
          <div className="min-w-[720px] flex items-start justify-between relative">
            {steps.map((step, idx) => {
              const isCompleted = step.status === 'completed'
              const isCurrent = step.status === 'current'
              const hasNext = idx < steps.length - 1
              const nextStep = hasNext ? steps[idx + 1] : null
              const lineActive =
                isCompleted &&
                nextStep &&
                (nextStep.status === 'completed' || nextStep.status === 'current')

              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center shrink-0 w-24 text-center relative z-10">
                    <div
                      className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center transition-all duration-200 ${
                        isCompleted
                          ? 'bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 shadow-md shadow-emerald-950/50'
                          : isCurrent
                            ? 'bg-cyan-950 border-2 border-cyan-400 text-cyan-200 ring-4 ring-cyan-500/30 shadow-lg shadow-cyan-950/60 animate-pulse'
                            : 'bg-slate-900 border border-slate-800 text-slate-600'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-4 h-4 text-emerald-300" />
                      ) : (
                        step.icon
                      )}
                    </div>
                    <span
                      className={`mt-2 w-24 text-xs font-semibold leading-tight text-center whitespace-normal break-words ${
                        isCompleted
                          ? 'text-slate-100'
                          : isCurrent
                            ? 'text-cyan-300 font-bold'
                            : 'text-slate-500'
                      }`}
                    >
                      {step.title}
                    </span>
                    <span
                      className={`mt-0.5 w-24 text-[10px] font-mono leading-tight text-center whitespace-normal break-words ${
                        isCompleted
                          ? 'text-emerald-400/80'
                          : isCurrent
                            ? 'text-cyan-400'
                            : 'text-slate-600'
                      }`}
                    >
                      {step.subtitle}
                    </span>
                  </div>

                  {hasNext && (
                    <div
                      className={`h-0.5 flex-1 mt-[17px] transition-colors duration-200 ${
                        lineActive
                          ? 'bg-gradient-to-r from-emerald-500/70 to-cyan-500/70'
                          : 'bg-slate-800'
                      }`}
                    />
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </div>
      </div>

      {/* Faixa de Metadados Técnicos */}
      <TechnicalMetadataBar
        order={order}
        originBadge={originBadge}
        modalityBadge={modalityBadge}
        paymentMethodLabel={paymentMethodLabel}
        onCopyId={onCopyId}
        copiedId={copiedId}
      />
    </div>
  )
}

export default function Admin_Orders_Table({
  orders,
  mode,
  columns,
  expandable = false,
  expandedOrders: controlledExpandedRecord,
  expandedOrderId: controlledExpandedId,
  onToggleExpand,
  isPending = false,
  emptyTitle = 'Nenhum pedido encontrado nesta visualização.',
  emptySubtitle = 'Alterne os filtros ou limpe o termo de busca acima.',
  onCancelOrder,
  onConfirmLocalDelivery,
  onConfirmDelivery,
  onFinalizeOrder,
  onGenerateLabel,
  onSaveTracking,
  onSaveNotes,
  onResolveOccurrence,
  onDispatchOrder,
  onCopyLink,
  copiedOrderId: controlledCopiedId,
  renderCustomActions,
}: AdminOrdersTableProps) {
  const activeColumns = columns ?? DEFAULT_COLUMNS_BY_MODE[mode]

  const [internalPending, startTransition] = useTransition()
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null)
  const [loadingDeliveryOrderId, setLoadingDeliveryOrderId] = useState<string | null>(null)
  const [loadingFinalizeOrderId, setLoadingFinalizeOrderId] = useState<string | null>(null)
  const [dispatchedOrdersMap, setDispatchedOrdersMap] = useState<Record<string, boolean>>({})
  const [deliveredOrdersMap, setDeliveredOrdersMap] = useState<Record<string, boolean>>({})
  const [finalizedOrdersMap, setFinalizedOrdersMap] = useState<Record<string, boolean>>({})

  // 1. AJUSTE DO ESTADO DE EXPANSÃO (Single Source of Truth: string | null)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(() => {
    if (controlledExpandedId) return controlledExpandedId
    if (controlledExpandedRecord) {
      return Object.keys(controlledExpandedRecord).find((k) => controlledExpandedRecord[k]) ?? null
    }
    return null
  })

  const [internalCopiedId, setInternalCopiedId] = useState<string | null>(null)
  const [copiedFullId, setCopiedFullId] = useState<string | null>(null)
  const [copiedTrackingId, setCopiedTrackingId] = useState<string | null>(null)
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({})
  const [cleanNotesInputs, setCleanNotesInputs] = useState<Record<string, string>>({})

  const isAnyPending = isPending || internalPending

  const handleCopyFullId = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopiedFullId(id)
    setTimeout(() => setCopiedFullId(null), 2500)
  }

  const handleConfirmLocal = (orderId: string) => {
    if (loadingOrderId) return
    if (!window.confirm('Confirma a saída física deste pedido para Entrega Local / Balcão?')) return
    setLoadingOrderId(orderId)
    startTransition(async () => {
      try {
        if (onConfirmLocalDelivery) {
          await onConfirmLocalDelivery(orderId)
        } else {
          const res = await dispatchOrderAction(orderId)
          if (!res.success) {
            alert(res.error || 'Erro ao confirmar entrega local.')
            return
          }
        }
        setDispatchedOrdersMap((prev) => ({ ...prev, [orderId]: true }))
      } catch (err: unknown) {
        console.error('Erro ao confirmar entrega local:', err)
        alert('Falha ao confirmar saída para entrega local.')
      } finally {
        setLoadingOrderId(null)
      }
    })
  }

  const handleConfirmDelivery = (orderId: string) => {
    if (loadingDeliveryOrderId) return
    if (
      !window.confirm(
        'Confirmar a entrega física deste pedido ao cliente? O pedido avançará para status RECEBIDO e iniciará o prazo de 3 dias para finalização automática.'
      )
    ) {
      return
    }
    setLoadingDeliveryOrderId(orderId)
    startTransition(async () => {
      try {
        if (onConfirmDelivery) {
          await onConfirmDelivery(orderId)
        } else {
          const res = await confirmLocalDeliveryAction(orderId)
          if (!res.success) {
            alert(res.error || 'Erro ao confirmar entrega ao cliente.')
            return
          }
        }
        setDeliveredOrdersMap((prev) => ({ ...prev, [orderId]: true }))
      } catch (err: unknown) {
        console.error('Erro ao confirmar entrega ao cliente:', err)
        alert('Falha ao confirmar entrega ao cliente.')
      } finally {
        setLoadingDeliveryOrderId(null)
      }
    })
  }

  const handleFinalizeOrder = (orderId: string) => {
    if (loadingFinalizeOrderId) return
    if (
      !window.confirm(
        'Deseja finalizar este pedido agora? Esta ação encerrará a janela de devolução, trancará o pedido imediatamente e avançará o ciclo operacional para FINALIZADO.'
      )
    ) {
      return
    }
    setLoadingFinalizeOrderId(orderId)
    startTransition(async () => {
      try {
        if (onFinalizeOrder) {
          await onFinalizeOrder(orderId)
        } else {
          const res = await finalizeOrderAdminAction(orderId)
          if (!res.success) {
            alert(res.error || 'Erro ao finalizar o pedido.')
            return
          }
        }
        setFinalizedOrdersMap((prev) => ({ ...prev, [orderId]: true }))
      } catch (err: unknown) {
        console.error('Erro ao finalizar pedido:', err)
        alert('Falha ao finalizar o pedido.')
      } finally {
        setLoadingFinalizeOrderId(null)
      }
    })
  }

  const handleDispatchTransport = (orderId: string) => {
    const order = normalizedList.find((o) => o.id === orderId)
    const trackingVal = (
      trackingInputs[orderId] !== undefined
        ? trackingInputs[orderId]
        : (order?.trackingCode || '')
    ).trim()

    if (!trackingVal) {
      alert('Por favor, informe e salve o código de rastreio da transportadora antes de despachar o pedido.')
      return
    }

    if (!window.confirm(`Confirma o despacho do pedido via transportadora com o código de rastreio "${trackingVal}"?`)) return
    setLoadingOrderId(orderId)
    startTransition(async () => {
      try {
        if (onDispatchOrder) {
          await onDispatchOrder(orderId, trackingVal)
        } else if (onSaveTracking) {
          await onSaveTracking(orderId, trackingVal, true)
        } else {
          const res = await dispatchOrderAction(orderId, trackingVal)
          if (!res.success) {
            alert(res.error || 'Erro ao despachar pedido.')
            return
          }
        }
        setDispatchedOrdersMap((prev) => ({ ...prev, [orderId]: true }))
      } catch (err: unknown) {
        console.error('Erro ao despachar pedido:', err)
        alert('Falha ao despachar pedido.')
      } finally {
        setLoadingOrderId(null)
      }
    })
  }

  const copiedId = controlledCopiedId !== undefined ? controlledCopiedId : internalCopiedId

  // 2. FUNÇÃO DE ALTERNÂNCIA (Toggle exclusivo / Acordeão)
  const handleToggleExpand = (orderId: string) => {
    setExpandedOrderId((prev) => (prev === orderId ? null : orderId))
    if (onToggleExpand) {
      onToggleExpand(orderId)
    }
  }

  const handleCopy = (normalized: NormalizedOrderPresentation) => {
    if (onCopyLink) {
      onCopyLink(normalized)
      return
    }
    const url =
      normalized.checkoutUrl.startsWith('http') || typeof window === 'undefined'
        ? normalized.checkoutUrl
        : `${window.location.origin}${normalized.checkoutUrl}`
    navigator.clipboard.writeText(url)
    setInternalCopiedId(normalized.id)
    setTimeout(() => setInternalCopiedId(null), 2500)
  }

  const getWhatsAppShareUrl = (normalized: NormalizedOrderPresentation) => {
    const url =
      normalized.checkoutUrl.startsWith('http') || typeof window === 'undefined'
        ? normalized.checkoutUrl
        : `${window.location.origin}${normalized.checkoutUrl}`
    const text =
      `Olá, ${normalized.clientName}! Seu pedido na Lúmen 3D já está pronto para pagamento.\n\n` +
      `📦 Total: ${formatCurrency(normalized.grandTotal)}\n` +
      `🔗 Acesse o link seguro para concluir seu pedido:\n` +
      `${url}`
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800/80 bg-[#080d1e]/90 p-10 text-center text-slate-400 space-y-2 shadow-2xl backdrop-blur-sm">
        <ShoppingBag className="w-8 h-8 text-slate-500 mx-auto" />
        <p className="text-xs font-semibold text-slate-300">{emptyTitle}</p>
        {emptySubtitle && <p className="text-[11px] text-slate-400">{emptySubtitle}</p>}
      </div>
    )
  }

  const normalizedList = orders.map((o) => normalizeAdminOrder(o))
  const isFinanceMode = mode === 'finance'

  return (
    <div
      className={`rounded-2xl border overflow-hidden backdrop-blur-sm ${
        isFinanceMode
          ? 'border-slate-800/90 bg-[#050811]/90 shadow-xl'
          : 'border-slate-800/80 bg-[#080d1e]/90 shadow-2xl'
      }`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr
              className={`border-b text-[11px] font-mono uppercase tracking-wider font-bold ${
                isFinanceMode
                  ? 'border-slate-800 bg-slate-900/80 text-slate-300'
                  : 'border-slate-800/80 bg-slate-950/80 text-slate-400'
              }`}
            >
              {activeColumns.map((col) => {
                switch (col) {
                  case 'id':
                    return (
                      <th key={col} className="py-4 px-5 whitespace-nowrap">
                        ID Pedido
                      </th>
                    )
                  case 'client':
                    return (
                      <th key={col} className="py-4 px-5 min-w-[200px]">
                        Cliente
                      </th>
                    )
                  case 'location':
                    return (
                      <th key={col} className="py-4 px-5 whitespace-nowrap">
                        Local / UF
                      </th>
                    )
                  case 'origin':
                    return (
                      <th key={col} className="py-4 px-5 whitespace-nowrap">
                        Origem
                      </th>
                    )
                  case 'modality':
                    return (
                      <th key={col} className="py-4 px-5 whitespace-nowrap">
                        Modalidade
                      </th>
                    )
                  case 'itemsValue':
                    return (
                      <th key={col} className="py-4 px-5 text-right whitespace-nowrap">
                        Valor Peças
                      </th>
                    )
                  case 'shipping':
                    return (
                      <th key={col} className="py-4 px-5 text-right whitespace-nowrap">
                        Frete
                      </th>
                    )
                  case 'total':
                    return (
                      <th key={col} className="py-4 px-5 text-right whitespace-nowrap">
                        Total (R$)
                      </th>
                    )
                  case 'paymentStatus':
                    return (
                      <th key={col} className="py-4 px-5 whitespace-nowrap">
                        Pagamento
                      </th>
                    )
                  case 'logisticsStatus':
                    return (
                      <th key={col} className="py-4 px-5 whitespace-nowrap">
                        Status
                      </th>
                    )
                  case 'actions':
                    return (
                      <th key={col} className="py-4 px-5 text-right whitespace-nowrap">
                        Ação
                      </th>
                    )
                }
              })}
            </tr>
          </thead>

          <tbody className="text-xs text-slate-200">
            {normalizedList.map((order) => {
              const isDeliveredLocal = Boolean(deliveredOrdersMap[order.id])
              const isFinalizedManual = Boolean(finalizedOrdersMap[order.id])
              const isFinalized = order.isFinalized || isFinalizedManual

              const displayLogisticsStatus = isFinalized
                ? ('DELIVERED' as const)
                : isDeliveredLocal
                  ? ('DELIVERED' as const)
                  : order.logisticsStatus

              const displayOrder: NormalizedOrderPresentation = {
                ...order,
                logisticsStatus: displayLogisticsStatus,
                isFinalized,
                logisticsBadge: isFinalized
                  ? {
                      label: 'Finalizado',
                      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                    }
                  : isDeliveredLocal
                    ? UNIFIED_LOGISTICS_BADGES.DELIVERED
                    : order.logisticsBadge,
                raw: {
                  ...order.raw,
                  logisticsStatus: displayLogisticsStatus,
                  deliveredAt:
                    order.raw.deliveredAt ||
                    (isDeliveredLocal || isFinalizedManual ? new Date().toISOString() : null),
                  adminNotes: isFinalizedManual
                    ? `${order.raw.adminNotes || ''}\n[FINALIZADO: Concluído manualmente pela administração]`
                    : order.raw.adminNotes,
                },
              }

              const payBadge = resolveOrderPaymentPresentation(displayOrder)

              const logBadge =
                resolveOrderLogisticsPresentation(displayOrder) ||
                UNIFIED_LOGISTICS_BADGES[displayOrder.logisticsStatus] ||
                UNIFIED_LOGISTICS_BADGES.PREPARING

              const originBadge = UNIFIED_ORIGIN_BADGES[displayOrder.origin]
              const modalityBadge = UNIFIED_MODALITY_BADGES[displayOrder.modality]
              const isExpanded = Boolean((expandable || mode === 'orders') && expandedOrderId === order.id)
              const isCopied = copiedId === order.id
              const parsedNotes = parseAdminNotes(displayOrder.adminNotes)

              return (
                <React.Fragment key={order.id}>
                  <tr
                    className={`border-b border-slate-800/60 last:border-0 transition-colors ${
                      order.hasOpenOccurrence
                        ? 'bg-rose-950/20 hover:bg-rose-950/30'
                        : isFinanceMode
                          ? 'hover:bg-slate-800/30 even:bg-slate-900/20'
                          : 'hover:bg-slate-800/20'
                    }`}
                  >
                    {activeColumns.map((col) => {
                      switch (col) {
                        case 'id':
                          return (
                            <td key={col} className="py-4 px-5 font-mono whitespace-nowrap">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs sm:text-[13px] font-bold text-cyan-400 tracking-wide">
                                    #{order.shortId}
                                  </span>
                                  {order.hasOpenOccurrence && (
                                    <span
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/80 text-[10px] font-bold"
                                      title="Ocorrência financeira pendente de revisão"
                                    >
                                      <AlertTriangle className="w-2.5 h-2.5 text-rose-400 animate-pulse" />
                                      <span>Atenção</span>
                                    </span>
                                  )}
                                  {order.location.isLocal && (
                                    <span
                                      className="inline-flex items-center text-[10px] text-cyan-400"
                                      title="Entrega Local / Regional"
                                    >
                                      <MapPin className="w-3 h-3" />
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400">
                                  {order.dateFormatted} • {order.timeFormatted}
                                </span>
                              </div>
                            </td>
                          )

                        case 'client':
                          return (
                            <td key={col} className="py-4 px-5">
                              <div className="min-w-[180px] max-w-[260px]">
                                <p
                                  className="text-xs sm:text-[13px] font-bold text-slate-100 truncate"
                                  title={order.clientName}
                                >
                                  {order.clientName}
                                </p>
                                <div
                                  className="flex items-center gap-1.5 text-slate-500 text-[10px] font-mono truncate mt-0.5"
                                  title={order.clientEmail}
                                >
                                  <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                                  <span className="truncate">{order.clientEmail}</span>
                                </div>
                                {order.linkedUserLabel &&
                                  order.linkedUserLabel.toLowerCase() !==
                                    order.clientName.toLowerCase() && (
                                    <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold truncate mt-0.5">
                                      <UserCheck className="w-3 h-3 shrink-0" />
                                      <span className="truncate">
                                        Conta: {order.linkedUserLabel}
                                      </span>
                                    </div>
                                  )}
                              </div>
                            </td>
                          )

                        case 'location':
                          return (
                            <td key={col} className="py-4 px-5 whitespace-nowrap">
                              <span className="text-slate-100 font-medium block">
                                {order.location.label}
                              </span>
                              {order.location.zipCode && (
                                <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                                  CEP {order.location.zipCode}
                                </span>
                              )}
                            </td>
                          )

                        case 'origin':
                          return (
                            <td key={col} className="py-4 px-5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${originBadge.badgeClass}`}
                              >
                                {order.origin === 'Marketplace' ? (
                                  <Store className="w-3 h-3 shrink-0" />
                                ) : order.origin === 'Balcão' ? (
                                  <ShoppingBag className="w-3 h-3 shrink-0" />
                                ) : (
                                  <Share2 className="w-3 h-3 shrink-0" />
                                )}
                                <span>{originBadge.label}</span>
                              </span>
                            </td>
                          )

                        case 'modality':
                          return (
                            <td key={col} className="py-4 px-5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${modalityBadge.badgeClass}`}
                              >
                                {modalityBadge.label}
                              </span>
                            </td>
                          )

                        case 'itemsValue':
                          return (
                            <td
                              key={col}
                              className="py-4 px-5 text-right font-mono text-slate-200 whitespace-nowrap"
                            >
                              {formatCurrency(order.itemsTotal)}
                            </td>
                          )

                        case 'shipping':
                          return (
                            <td
                              key={col}
                              className="py-4 px-5 text-right font-mono text-slate-300 whitespace-nowrap"
                            >
                              {order.shippingCost > 0 ? (
                                formatCurrency(order.shippingCost)
                              ) : (
                                <span className="text-emerald-400 font-bold text-[11px]">
                                  Grátis
                                </span>
                              )}
                            </td>
                          )

                        case 'total':
                          return (
                            <td
                              key={col}
                              className="py-4 px-5 text-right font-mono whitespace-nowrap"
                            >
                              <span className="text-xs sm:text-[13px] font-bold text-slate-100">
                                {formatCurrency(order.grandTotal)}
                              </span>
                            </td>
                          )

                        case 'paymentStatus':
                          return (
                            <td key={col} className="py-4 px-5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border uppercase tracking-wider ${payBadge.badgeClass}`}
                              >
                                {order.isPending ? (
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                                  </span>
                                ) : (
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${payBadge.dotClass}`}
                                  />
                                )}
                                <span>{payBadge.label}</span>
                              </span>
                            </td>
                          )

                        case 'logisticsStatus':
                          return (
                            <td key={col} className="py-4 px-5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border uppercase tracking-wider ${logBadge.badgeClass}`}
                              >
                                {logBadge.label}
                              </span>
                            </td>
                          )

                        case 'actions':
                          return (
                            <td
                              key={col}
                              className="py-4 px-5 text-right whitespace-nowrap"
                            >
                              {renderCustomActions ? (
                                renderCustomActions(order)
                              ) : mode === 'dashboard' ? (
                                <Link
                                  href={`/admin/orders?search=${order.shortId}&expand=${order.id}`}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-slate-200 border border-slate-800 hover:border-slate-700 transition-colors"
                                >
                                  <span>Detalhes</span>
                                </Link>
                              ) : mode === 'finance' ? (
                                <Link
                                  href={`/admin/orders?search=${order.shortId}&expand=${order.id}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 border border-slate-800 transition-colors"
                                  title="Auditar pedido em Gerenciar Vendas"
                                >
                                  <span>Detalhes</span>
                                </Link>
                              ) : mode === 'assisted' ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  {order.isCancelled || isOrderExpired(order) ? (
                                    <button
                                      type="button"
                                      disabled
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 text-slate-500 border border-slate-800 font-bold text-[11px] uppercase tracking-wider opacity-60 cursor-not-allowed"
                                      title={isOrderExpired(order) ? 'Prazo de pagamento expirado (Timeout 24h)' : 'Link revogado: pedido cancelado'}
                                    >
                                      <AlertCircle className="w-3 h-3" />
                                      <span>{isOrderExpired(order) ? 'Expirado' : 'Revogado'}</span>
                                    </button>
                                  ) : !order.isPaid ? (
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(order)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] uppercase tracking-wider transition cursor-pointer shadow-md"
                                      title="Copiar link de checkout do pedido"
                                    >
                                      {isCopied ? (
                                        <>
                                          <Check className="w-3 h-3 text-emerald-300" />
                                          <span>Copiado!</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3 h-3" />
                                          <span>Copiar Link</span>
                                        </>
                                      )}
                                    </button>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 font-bold px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/40">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Convertido</span>
                                    </span>
                                  )}

                                  {!order.isCancelled && !isOrderExpired(order) && (
                                    <>
                                      <a
                                        href={getWhatsAppShareUrl(order)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 hover:text-white border border-emerald-800/50 transition"
                                        title="Enviar no WhatsApp"
                                      >
                                        <Send className="w-3.5 h-3.5" />
                                      </a>

                                      <a
                                        href={order.checkoutUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
                                        title="Abrir página de checkout"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>

                                      {onCancelOrder && !order.isPaid && (
                                        <button
                                          type="button"
                                          onClick={() => onCancelOrder(order.id)}
                                          disabled={isPending}
                                          title={`Revogar / Cancelar orçamento #${order.shortId}`}
                                          aria-label={`Revogar orçamento #${order.shortId}`}
                                          className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 text-rose-400 hover:text-rose-200 border border-rose-900/50 transition disabled:opacity-50 cursor-pointer"
                                        >
                                          <XCircle className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              ) : (
                                /* mode === 'orders' */
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleExpand(order.id)}
                                    className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition cursor-pointer"
                                    title={
                                      isExpanded
                                        ? 'Recolher detalhes do pedido'
                                        : 'Ver detalhes do pedido'
                                    }
                                    aria-label={
                                      isExpanded
                                        ? 'Recolher detalhes do pedido'
                                        : 'Ver detalhes do pedido'
                                    }
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4 text-cyan-400" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 text-slate-400" />
                                    )}
                                  </button>

                                  {onCancelOrder &&
                                    !order.isFinalized &&
                                    !order.isCancelled && (
                                      <button
                                        type="button"
                                        onClick={() => onCancelOrder(order.id)}
                                        disabled={isPending}
                                        title={`Cancelar pedido #${order.shortId}`}
                                        aria-label={`Cancelar pedido #${order.shortId}`}
                                        className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 text-rose-400 hover:text-rose-200 border border-rose-900/50 transition disabled:opacity-50 cursor-pointer"
                                      >
                                        <XCircle className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                </div>
                              )}
                            </td>
                          )
                      }
                    })}
                  </tr>

                  {/* Gaveta de Detalhes Expansível */}
                  {isExpanded && (
                    <tr className="border-b border-slate-800/80">
                      <td colSpan={activeColumns.length} className="p-0">
                        <div className="bg-slate-900/60 p-6 border-b border-slate-800/80 mb-4 space-y-5">
                          {/* Alerta de Ocorrência se houver */}
                          {order.hasOpenOccurrence && (
                            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5">
                                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                <div>
                                  <span className="text-xs font-bold text-rose-200">
                                    Ocorrência Aberta: Revisão de Divergência
                                  </span>
                                  {order.raw.occurrences?.[0] && (
                                    <p className="text-[11px] text-rose-300/90 mt-0.5">
                                      {order.raw.occurrences[0].description} (
                                      {order.raw.occurrences[0].type})
                                    </p>
                                  )}
                                </div>
                              </div>
                              {order.raw.occurrences?.[0] && onResolveOccurrence && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onResolveOccurrence(
                                      order.id,
                                      order.raw.occurrences![0].id
                                    )
                                  }
                                  disabled={isPending}
                                  className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-semibold text-[11px] transition shrink-0 cursor-pointer"
                                >
                                  Marcar Resolvida
                                </button>
                              )}
                            </div>
                          )}

                          {/* 1. LINHA DO TEMPO (STEPPER) & METADADOS OPERACIONAIS COMPLETOS */}
                          <OrderLifecycleStepper
                            order={displayOrder}
                            originBadge={originBadge}
                            modalityBadge={modalityBadge}
                            onCopyId={handleCopyFullId}
                            copiedId={copiedFullId}
                          />

                          {/* 2. LISTA DE ITENS DO PEDIDO (COM DEEP LINK "CONFERIR NA FILA" E BADGES ESTÁTICAS) */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-300">
                                Peças do Pedido ({order.totalUnits} un):
                              </span>
                              <span className="text-[11px] font-mono text-slate-400">
                                Subtotal Peças:{' '}
                                <strong className="text-slate-200">
                                  {formatCurrency(order.itemsTotal)}
                                </strong>{' '}
                                • Frete:{' '}
                                <strong className="text-cyan-400">
                                  {order.shippingCost > 0
                                    ? formatCurrency(order.shippingCost)
                                    : 'Grátis'}
                                </strong>{' '}
                                • Total:{' '}
                                <strong className="text-emerald-400">
                                  {formatCurrency(order.grandTotal)}
                                </strong>
                              </span>
                            </div>
                            <div className="divide-y divide-slate-800/60 bg-slate-950/60 rounded-xl border border-slate-800/60 p-3">
                              {order.raw.items.map((item) => {
                                const isMto = Boolean(
                                  item.isMadeToOrder || item.product?.isMadeToOrder
                                )
                                const isItemReady = Boolean(
                                  item.isReady ||
                                    item.productionStatus === 'READY' ||
                                    item.readyAt
                                )

                                return (
                                  <div
                                    key={item.id}
                                    className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                                  >
                                    <div className="flex items-center gap-3">
                                      {item.product?.images?.[0] ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                          src={item.product.images[0]}
                                          alt={item.productTitle}
                                          className="w-9 h-9 rounded-lg object-cover border border-slate-800 shrink-0"
                                        />
                                      ) : (
                                        <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                                          <Package className="w-4 h-4" />
                                        </div>
                                      )}
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold text-slate-200">
                                            {item.productTitle}
                                          </span>
                                          <span className="text-slate-400 font-mono text-[11px]">
                                            x{item.quantity}
                                          </span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 block font-mono">
                                          Unitário: {formatCurrency(item.priceUnit)} • Total:{' '}
                                          {formatCurrency(item.priceUnit * item.quantity)}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 self-end sm:self-auto">
                                      {order.isCancelled ? (
                                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                                          Cancelado
                                        </span>
                                      ) : isMto ? (
                                        isItemReady ? (
                                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                            <span>Produção Concluída</span>
                                          </span>
                                        ) : (
                                          <Link
                                            href={`/admin/production?search=${order.id.slice(-6).toUpperCase()}`}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/70 text-indigo-300 hover:text-indigo-200 border border-indigo-700/50 hover:border-indigo-500/60 font-semibold text-xs transition shadow-sm cursor-pointer"
                                            title="Conferir e gerenciar esta peça na Fila de Produção da oficina"
                                          >
                                            <Printer className="w-3.5 h-3.5 text-indigo-400" />
                                            <span>Conferir na Fila</span>
                                            <ExternalLink className="w-3 h-3 text-indigo-400/80" />
                                          </Link>
                                        )
                                      ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                                          <Check className="w-3 h-3 text-emerald-400" />
                                          <span>Pronta Entrega</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          {/* 3. PAINEL DUPLO: ENDEREÇO DE ENTREGA & EXPEDIÇÃO + NOTAS INTERNAS DA VENDA */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Card 1: Endereço de Entrega & Central de Expedição */}
                            <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-3 text-xs flex flex-col justify-between">
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between text-slate-300 font-bold">
                                  <span className="flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                                    <span>Endereço de Entrega & Expedição</span>
                                  </span>
                                  <span className="text-[11px] text-cyan-400 font-mono font-bold">
                                    Frete:{' '}
                                    {order.shippingCost > 0
                                      ? formatCurrency(order.shippingCost)
                                      : 'Grátis'}
                                  </span>
                                </div>

                                {order.location.street ? (
                                  <div className="text-slate-400 space-y-0.5 text-[11px] leading-relaxed">
                                    <p className="text-slate-200 font-medium">
                                      {order.location.street}, {order.location.number}
                                      {order.location.complement
                                        ? ` (${order.location.complement})`
                                        : ''}
                                    </p>
                                    <p>
                                      {order.location.neighborhood} — {order.location.city}/
                                      {order.location.state}
                                    </p>
                                    <p className="font-mono text-cyan-300">
                                      CEP: {order.location.zipCode}
                                    </p>
                                    <p className="text-slate-400 pt-0.5">
                                      Modalidade:{' '}
                                      {order.location.serviceName ||
                                        (order.location.isLocal
                                          ? 'Entrega Local / Frota Própria'
                                          : 'Transportadora Padrão')}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-slate-400 text-xs">
                                    {order.location.isLocal
                                      ? 'Entrega Local / Balcão — Endereço a combinar com o cliente.'
                                      : 'Endereço ainda não preenchido pelo destinatário ou retirada em balcão.'}
                                  </p>
                                )}
                              </div>

                              {/* Seção Condicional de Expedição */}
                              <div className="pt-2.5 border-t border-slate-800/80 space-y-2">
                                {isOrderExpired(order) ? (
                                  <p className="text-[11px] text-rose-400 italic bg-rose-950/20 p-2.5 rounded-lg border border-rose-800/40 flex items-center gap-2">
                                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                    <span>
                                      Pedido cancelado por timeout de pagamento (${order.isAssistedSale ? '24h' : '10h'}). Expedição, emissão de etiqueta e produção estão bloqueadas.
                                    </span>
                                  </p>
                                ) : (
                                  <>
                                {/* Cenário 1: Antes de READY_FOR_SHIPPING (ex: aguardando pagamento, na fila, produzindo, cancelado) */}
                                {!['READY_FOR_SHIPPING', 'SHIPPED', 'DELIVERED'].includes(
                                  order.logisticsStatus
                                ) && (
                                  <p className="text-[11px] text-slate-500 italic bg-slate-950/40 p-2 rounded-lg border border-slate-800/40 flex items-center gap-2">
                                    <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                    <span>
                                      As ferramentas de etiqueta e rastreio serão liberadas quando
                                      o pedido estiver Pronto para Envio.
                                    </span>
                                  </p>
                                )}

                                {/* Cenário 2: Quando ATINGE READY_FOR_SHIPPING ("Pronto para Envio") */}
                                {order.logisticsStatus === 'READY_FOR_SHIPPING' &&
                                  !dispatchedOrdersMap[order.id] && (
                                    <div className="space-y-2.5 bg-blue-950/20 p-3 rounded-xl border border-blue-500/20">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                                          <Truck className="w-3.5 h-3.5 text-blue-400" />
                                          <span>Central de Expedição</span>
                                        </span>
                                        <span className="text-[10px] font-mono text-blue-300/80 bg-blue-900/40 px-2 py-0.5 rounded border border-blue-800/40 font-semibold">
                                          Pronto para Envio
                                        </span>
                                      </div>

                                      {order.location.isLocal ? (
                                        /* Subcenário 2A: Entrega Local / Regional / Balcão */
                                        <div className="space-y-2">
                                          <p className="text-[11px] text-slate-300">
                                            Logística local própria (Itapetininga e Região) — sem
                                            necessidade de etiqueta de transportadora.
                                          </p>
                                          <button
                                            type="button"
                                            onClick={() => handleConfirmLocal(order.id)}
                                            disabled={isAnyPending || loadingOrderId === order.id}
                                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-md shadow-emerald-950/40 cursor-pointer disabled:opacity-50"
                                          >
                                            {loadingOrderId === order.id ? (
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                              <Truck className="w-3.5 h-3.5" />
                                            )}
                                            <span>Confirmar Saída para Entrega Local</span>
                                          </button>
                                        </div>
                                      ) : (
                                        /* Subcenário 2B: Transportadora / Melhor Envio */
                                        <div className="space-y-2">
                                          {/* 1. Botão Gerar Etiqueta ou Link Imprimir PDF */}
                                          <div className="flex items-center gap-2">
                                            {order.shippingLabelUrl ? (
                                              <a
                                                href={order.shippingLabelUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-xs font-semibold text-white rounded-lg transition shadow-md shadow-cyan-950/40"
                                              >
                                                <Printer className="w-3.5 h-3.5" />
                                                <span>Imprimir Etiqueta PDF</span>
                                                <ExternalLink className="w-3 h-3 text-cyan-200" />
                                              </a>
                                            ) : (
                                              onGenerateLabel && (
                                                <button
                                                  type="button"
                                                  onClick={() => onGenerateLabel(order.id)}
                                                  disabled={isPending}
                                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded-lg transition shadow-md shadow-blue-950/40 disabled:opacity-50 cursor-pointer"
                                                >
                                                  <Package className="w-3.5 h-3.5" />
                                                  <span>Gerar / Emitir Etiqueta (Melhor Envio)</span>
                                                </button>
                                              )
                                            )}
                                          </div>

                                          {/* 2. Input para informar/editar código de rastreio e salvar */}
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="text"
                                              value={
                                                trackingInputs[order.id] !== undefined
                                                  ? trackingInputs[order.id]
                                                  : (order.trackingCode || '')
                                              }
                                              onChange={(e) =>
                                                setTrackingInputs((prev) => ({
                                                  ...prev,
                                                  [order.id]: e.target.value,
                                                }))
                                              }
                                              placeholder="Código de Rastreio (Melhor Envio)"
                                              aria-label={`Código de rastreio para o pedido #${order.shortId}`}
                                              className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                                            />
                                            {onSaveTracking && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const code =
                                                    trackingInputs[order.id] !== undefined
                                                      ? trackingInputs[order.id]
                                                      : (order.trackingCode || '')
                                                  onSaveTracking(order.id, code, false)
                                                }}
                                                disabled={isPending}
                                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg transition cursor-pointer"
                                              >
                                                Salvar
                                              </button>
                                            )}
                                          </div>

                                          {/* 3. Botão primário Confirmar Envio / Despachar Pedido */}
                                          <button
                                            type="button"
                                            onClick={() => handleDispatchTransport(order.id)}
                                            disabled={isAnyPending || loadingOrderId === order.id}
                                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-blue-950/50 disabled:opacity-50 cursor-pointer"
                                          >
                                            {loadingOrderId === order.id ? (
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                              <Send className="w-3.5 h-3.5" />
                                            )}
                                            <span>Confirmar Envio / Despachar Pedido</span>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  </>
                                )}

                                {/* Cenário 3: Pedido despachado nesta sessão */}
                                {dispatchedOrdersMap[order.id] && (
                                  <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>
                                      Pedido despachado com sucesso! Status atualizado para Enviado.
                                    </span>
                                  </div>
                                )}

                                {/* Cenário 4: Já em SHIPPED, DELIVERED ou Finalizado */}
                                {['SHIPPED', 'DELIVERED'].includes(displayOrder.logisticsStatus) &&
                                  !dispatchedOrdersMap[order.id] && (
                                    <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                                      <div className="flex items-center justify-between text-[11px]">
                                        <span className="font-bold text-slate-300 flex items-center gap-1.5">
                                          <Truck className="w-3.5 h-3.5 text-cyan-400" />
                                          <span>Dados de Expedição</span>
                                        </span>
                                        <span className="font-mono text-cyan-400 font-semibold">
                                          {displayOrder.logisticsBadge.label}
                                        </span>
                                      </div>

                                      {/* Data de Envio e Entrega */}
                                      <div className="space-y-0.5 text-[11px] text-slate-400 font-mono">
                                        {displayOrder.raw.shippedAt && (
                                          <p className="flex items-center gap-1.5 text-slate-300">
                                            <span className="text-slate-500">Enviado em:</span>
                                            <strong>{formatTimestamp(displayOrder.raw.shippedAt)}</strong>
                                          </p>
                                        )}
                                        {displayOrder.raw.deliveredAt && (
                                          <p className="flex items-center gap-1.5 text-emerald-400">
                                            <span className="text-slate-500">Entregue em:</span>
                                            <strong>{formatTimestamp(displayOrder.raw.deliveredAt)}</strong>
                                          </p>
                                        )}
                                      </div>

                                      {/* Rastreio */}
                                      {displayOrder.trackingCode ? (
                                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-slate-500 text-[10px]">
                                              Rastreio:
                                            </span>
                                            <span className="text-cyan-300 font-bold">
                                              {displayOrder.trackingCode}
                                            </span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              navigator.clipboard.writeText(displayOrder.trackingCode || '')
                                              setCopiedTrackingId(order.id)
                                              setTimeout(() => setCopiedTrackingId(null), 2000)
                                            }}
                                            className="p-1 hover:text-cyan-300 text-slate-400 transition cursor-pointer"
                                            title="Copiar código de rastreio"
                                          >
                                            {copiedTrackingId === order.id ? (
                                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                                            ) : (
                                              <Copy className="w-3.5 h-3.5" />
                                            )}
                                          </button>
                                        </div>
                                      ) : displayOrder.location.isLocal ? (
                                        <p className="text-[11px] text-teal-400/90 font-mono">
                                          Entrega local por frota própria (sem código de rastreio externo).
                                        </p>
                                      ) : null}

                                      {/* Link da Etiqueta se houver */}
                                      {displayOrder.shippingLabelUrl && (
                                        <a
                                          href={displayOrder.shippingLabelUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-semibold transition"
                                        >
                                          <Printer className="w-3.5 h-3.5" />
                                          <span>Ver / Imprimir Etiqueta PDF</span>
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}

                                      {/* Botão Primário: Confirmar Entrega ao Cliente (Local / Balcão em SHIPPED) */}
                                      {displayOrder.logisticsStatus === 'SHIPPED' &&
                                        (displayOrder.location.isLocal || !displayOrder.trackingCode) &&
                                        !displayOrder.isFinalized &&
                                        !isDeliveredLocal && (
                                          <div className="pt-2 border-t border-slate-800">
                                            <button
                                              type="button"
                                              onClick={() => handleConfirmDelivery(order.id)}
                                              disabled={isAnyPending || loadingDeliveryOrderId === order.id}
                                              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-emerald-950/50 cursor-pointer disabled:opacity-50"
                                            >
                                              {loadingDeliveryOrderId === order.id ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                              ) : (
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                              )}
                                              <span>Confirmar Entrega ao Cliente</span>
                                            </button>
                                          </div>
                                        )}

                                      {/* Feedback Imediato de Entrega Confirmada nesta sessão */}
                                      {isDeliveredLocal && !isFinalizedManual && (
                                        <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                          <span>
                                            Entrega física ao cliente confirmada! O pedido avançou para Recebido.
                                          </span>
                                        </div>
                                      )}

                                      {/* Botão de Finalização Manual pelo Administrador (DELIVERED e ainda não finalizado) */}
                                      {displayOrder.logisticsStatus === 'DELIVERED' &&
                                        !displayOrder.isFinalized && (
                                          <div className="p-3 bg-gradient-to-r from-amber-950/20 to-emerald-950/20 border border-amber-500/30 rounded-xl space-y-2 mt-2">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                              <div className="space-y-0.5">
                                                <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                                                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                                                  <span>Aguardando Conclusão (3 dias pós-entrega)</span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 leading-tight">
                                                  (Opcional) Encerra a janela de devoluções e tranca o pedido imediatamente.
                                                </p>
                                              </div>

                                              <button
                                                type="button"
                                                onClick={() => handleFinalizeOrder(order.id)}
                                                disabled={isAnyPending || loadingFinalizeOrderId === order.id}
                                                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-amber-950/50 cursor-pointer disabled:opacity-50 shrink-0"
                                                title="(Opcional) Encerra a janela de devoluções e tranca o pedido imediatamente."
                                              >
                                                {loadingFinalizeOrderId === order.id ? (
                                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                  <Lock className="w-3.5 h-3.5 text-amber-200" />
                                                )}
                                                <span>Finalizar Pedido Agora</span>
                                              </button>
                                            </div>
                                          </div>
                                        )}

                                      {/* Feedback Imediato de Pedido Finalizado nesta sessão */}
                                      {isFinalizedManual && (
                                        <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2 mt-2">
                                          <PackageCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                                          <span>
                                            Pedido finalizado pela administração! Ciclo concluído e edições trancadas.
                                          </span>
                                        </div>
                                      )}

                                      {/* Edição de rastreio permitida APENAS se estiver SHIPPED com transportadora e NÃO finalizado */}
                                      {displayOrder.logisticsStatus === 'SHIPPED' &&
                                        !displayOrder.isFinalized &&
                                        displayOrder.trackingCode && (
                                          <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                                            <input
                                              type="text"
                                              value={
                                                trackingInputs[order.id] !== undefined
                                                  ? trackingInputs[order.id]
                                                  : (displayOrder.trackingCode || '')
                                              }
                                              onChange={(e) =>
                                                setTrackingInputs((prev) => ({
                                                  ...prev,
                                                  [order.id]: e.target.value,
                                                }))
                                              }
                                              placeholder="Atualizar Código de Rastreio"
                                              className="flex-1 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                                            />
                                            {onSaveTracking && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const code =
                                                    trackingInputs[order.id] !== undefined
                                                      ? trackingInputs[order.id]
                                                      : (displayOrder.trackingCode || '')
                                                  onSaveTracking(order.id, code, false)
                                                }}
                                                disabled={isPending}
                                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg transition cursor-pointer"
                                              >
                                                Atualizar
                                              </button>
                                            )}
                                          </div>
                                        )}

                                      {/* Se Finalizado: indicação 100% somente leitura */}
                                      {displayOrder.isFinalized && (
                                        <p className="text-[10px] text-slate-500 font-mono pt-1">
                                          Registro histórico finalizado (somente leitura).
                                        </p>
                                      )}
                                    </div>
                                  )}
                              </div>
                            </div>

                            {/* Card 2: Notas Internas da Venda (com separação visual de metadados em tags) */}
                            <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-2.5 text-xs flex flex-col justify-between">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-1.5 text-slate-300 font-bold">
                                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Notas Internas da Venda</span>
                                  </span>
                                  {displayOrder.isFinalized && (
                                    <span className="text-[10px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
                                      <Lock className="w-3 h-3" />
                                      <span>Finalizado (Imutável)</span>
                                    </span>
                                  )}
                                </div>

                                {/* Tags / Pílulas informativas de metadados automáticos */}
                                {parsedNotes.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 pt-0.5 max-h-24 overflow-y-auto">
                                    {parsedNotes.tags.map((tag, idx) => (
                                      <span
                                        key={idx}
                                        className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-950/80 text-slate-300 border border-slate-800"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Textarea contendo APENAS a observação real da venda */}
                                <textarea
                                  value={
                                    cleanNotesInputs[order.id] !== undefined
                                      ? cleanNotesInputs[order.id]
                                      : parsedNotes.cleanText
                                  }
                                  disabled={displayOrder.isFinalized}
                                  readOnly={displayOrder.isFinalized}
                                  onChange={(e) =>
                                    setCleanNotesInputs((prev) => ({
                                      ...prev,
                                      [order.id]: e.target.value,
                                    }))
                                  }
                                  placeholder={
                                    displayOrder.isFinalized
                                      ? 'Pedido finalizado. Notas arquivadas.'
                                      : 'Anotações internas sobre esta venda...'
                                  }
                                  aria-label={`Notas internas sobre a venda #${order.shortId}`}
                                  rows={3}
                                  className={`w-full px-2.5 py-2 border rounded-lg text-xs placeholder:text-slate-600 focus:outline-none resize-none ${
                                    displayOrder.isFinalized
                                      ? 'bg-slate-950/40 border-slate-900 text-slate-400 cursor-not-allowed'
                                      : 'bg-slate-950 border-slate-800 text-slate-100 focus:border-amber-500'
                                  }`}
                                />
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <div>
                                  {onCancelOrder &&
                                    !displayOrder.isFinalized &&
                                    !displayOrder.isCancelled &&
                                    displayOrder.logisticsStatus !== 'DELIVERED' && (
                                      <button
                                        type="button"
                                        onClick={() => onCancelOrder(order.id)}
                                        disabled={isPending}
                                        className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-semibold rounded-lg transition inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                                      >
                                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                                        <span>Cancelar Pedido</span>
                                      </button>
                                    )}
                                </div>
                                {onSaveNotes && !displayOrder.isFinalized && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const currentClean =
                                        cleanNotesInputs[order.id] !== undefined
                                          ? cleanNotesInputs[order.id]
                                          : parsedNotes.cleanText
                                      const tagsFormatted = parsedNotes.tags
                                        .map((t) => `[${t}]`)
                                        .join(' ')
                                      const combined = tagsFormatted
                                        ? currentClean.trim()
                                          ? `${tagsFormatted} - Observações: ${currentClean.trim()}`
                                          : tagsFormatted
                                        : currentClean.trim()

                                      onSaveNotes(order.id, combined)
                                    }}
                                    disabled={isPending}
                                    className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold rounded-lg transition cursor-pointer disabled:opacity-50"
                                  >
                                    Salvar Notas
                                  </button>
                                )}
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
    </div>
  )
}
