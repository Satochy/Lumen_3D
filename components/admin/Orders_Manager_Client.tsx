'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Package,
  Truck,
  CheckCircle2,
  AlertTriangle,
  ShoppingBag,
  CreditCard,
  Clock,
} from 'lucide-react'
import type { PaymentStatus, LogisticsStatus } from '@prisma/client'
import {
  updateOrderStatusAction,
  updateOrderTrackingAction,
  updateOrderAdminNotesAction,
  resolveOrderOccurrenceAction,
  confirmLocalDeliveryAction as confirmDeliveryDeliveredAction,
  finalizeOrderAdminAction,
} from '@/app/actions/orders'
import {
  confirmLocalDeliveryAction,
  generateMelhorEnvioLabelAction,
} from '@/app/actions/shipping_actions'
import { cancelOrderAdminAction } from '@/app/actions/order_cancellation_actions'
import { AdminMetricsAndFilterBar } from '@/components/admin/Admin_Metrics_And_Filter_Bar'
import Admin_Orders_Table from '@/components/admin/Admin_Orders_Table'
import { normalizeAdminOrder } from '@/lib/order_presenter'

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
  userId: string | null
  paymentStatus: PaymentStatus
  logisticsStatus: LogisticsStatus
  totalAmount: number
  shippingCost: number
  trackingCode: string | null
  shippingLabelUrl?: string | null
  externalShipmentId?: string | null
  isLocalDelivery: boolean
  isAssistedSale: boolean
  assistedSaleExpectedEmail?: string | null
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
  defaultSearch?: string
  defaultExpand?: string
}

export default function Orders_Manager_Client({
  initialOrders,
  defaultTab = 'todos',
  defaultSearch = '',
  defaultExpand = '',
}: OrdersManagerClientProps) {
  const searchParams = useSearchParams()
  const searchParam = searchParams.get('search')
  const expandParam = searchParams.get('expand')
  const tabParam = searchParams.get('tab')

  const [orders, setOrders] = useState<SerializedAdminOrder[]>(initialOrders)
  const [activeTab, setActiveTab] = useState<string>(() => tabParam || defaultTab)
  const [searchTerm, setSearchTerm] = useState<string>(
    () => searchParam ?? defaultSearch ?? ''
  )
  const [isPending, startTransition] = useTransition()
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>(() => {
    const initialExpandId = expandParam || defaultExpand
    return initialExpandId ? { [initialExpandId]: true } : {}
  })
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      (window.location.search.includes('search=') ||
        window.location.search.includes('expand=') ||
        window.location.search.includes('tab='))
    ) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text })
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev))
    }, 4500)
  }

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
      const q = searchTerm.toLowerCase().trim()
      const normalized = normalizeAdminOrder(order)
      const matchId = order.id.toLowerCase().includes(q)
      const matchClient =
        normalized.clientName.toLowerCase().includes(q) ||
        normalized.clientEmail.toLowerCase().includes(q)
      const matchOrigin = normalized.origin.toLowerCase().includes(q)
      const matchProduct = order.items.some((i) =>
        i.productTitle.toLowerCase().includes(q)
      )
      return matchId || matchClient || matchOrigin || matchProduct
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
  const handleSaveTracking = (orderId: string, code: string, markShipped: boolean = false) => {
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
        showToast('success', 'Código de rastreio atualizado com sucesso.')
      } else {
        showToast('error', res.error || 'Erro ao salvar rastreio.')
      }
    })
  }

  // Ação de salvar notas internas
  const handleSaveNotes = (orderId: string, notes: string) => {
    startTransition(async () => {
      const res = await updateOrderAdminNotesAction(orderId, notes)
      if (res.success) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, adminNotes: notes || null } : o))
        )
        showToast('success', 'Notas internas salvas.')
      }
    })
  }

  // Ação de confirmar saída física para Entrega Local (Frota Própria)
  const handleConfirmLocalDelivery = (orderId: string) => {
    startTransition(async () => {
      const res = await confirmLocalDeliveryAction(orderId)
      if (res.success) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  logisticsStatus: 'SHIPPED',
                  shippedAt: new Date().toISOString(),
                }
              : o
          )
        )
      } else {
        alert(res.error || 'Erro ao confirmar entrega local.')
      }
    })
  }

  // Ação de confirmar entrega física ao cliente (Local / Balcão -> DELIVERED)
  const handleConfirmCustomerDelivery = (orderId: string) => {
    startTransition(async () => {
      const res = await confirmDeliveryDeliveredAction(orderId)
      if (res.success) {
        setOrders((prev) =>
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
        showToast('success', 'Entrega física confirmada com sucesso!')
      } else {
        alert(res.error || 'Erro ao confirmar entrega ao cliente.')
      }
    })
  }

  // Ação de finalizar pedido manualmente pela Administração
  const handleFinalizeOrder = (orderId: string) => {
    startTransition(async () => {
      const res = await finalizeOrderAdminAction(orderId)
      if (res.success) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  logisticsStatus: 'DELIVERED',
                  adminNotes: o.adminNotes
                    ? `${o.adminNotes}\n[FINALIZADO: Concluído manualmente pela administração]`
                    : '[FINALIZADO: Concluído manualmente pela administração]',
                }
              : o
          )
        )
        showToast('success', 'Pedido finalizado com sucesso!')
      } else {
        alert(res.error || 'Erro ao finalizar o pedido.')
      }
    })
  }

  // Ação de emitir etiqueta no Melhor Envio
  const handleGenerateMelhorEnvioLabel = (orderId: string) => {
    startTransition(async () => {
      const res = await generateMelhorEnvioLabelAction(orderId)
      if (res.success) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  shippingLabelUrl: res.shippingLabelUrl || o.shippingLabelUrl,
                  externalShipmentId: res.externalShipmentId || o.externalShipmentId,
                }
              : o
          )
        )
      } else {
        alert(res.error || 'Erro ao emitir etiqueta no Melhor Envio.')
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

  // Ação de cancelamento administrativo com reposição de estoque
  const handleCancelOrder = (orderId: string) => {
    const shortId = orderId.slice(-6).toUpperCase()
    const reason = window.prompt(
      `Informe o motivo do cancelamento do pedido #${shortId}:`
    )
    if (reason === null) return

    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      showToast('error', 'É obrigatório informar o motivo do cancelamento.')
      return
    }

    startTransition(async () => {
      const res = await cancelOrderAdminAction(orderId, trimmedReason)
      if (res.success) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  logisticsStatus: 'CANCELLED',
                  cancelledAt: res.cancelledAt || new Date().toISOString(),
                  adminNotes: res.adminNotes ?? o.adminNotes,
                }
              : o
          )
        )
        showToast(
          'success',
          `Pedido #${shortId} cancelado com sucesso e estoque atualizado.`
        )
      } else {
        showToast('error', res.error || 'Falha ao cancelar o pedido.')
      }
    })
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Toast de feedback */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-bold shadow-2xl transition ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/95 border-rose-500/40 text-rose-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* MÉTRICAS E BARRA UNIFICADA DE BUSCA E FILTROS */}
      <AdminMetricsAndFilterBar
        metrics={[
          {
            id: 'total',
            label: 'Total de Pedidos',
            value: orders.length,
            valueColorClass: 'text-slate-100',
            icon: <ShoppingBag className="w-5 h-5 text-slate-500" />,
          },
          {
            id: 'paid',
            label: 'Pagos',
            value: paidOrders.length,
            valueColorClass: 'text-emerald-400',
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
          },
          {
            id: 'pending',
            label: 'Aguardando',
            value: pendingOrders.length,
            valueColorClass: 'text-amber-400',
            icon: <Clock className="w-5 h-5 text-amber-400" />,
            showPulseDot: pendingOrders.length > 0,
            dotColorClass: 'bg-amber-400',
          },
          {
            id: 'occurrences',
            label: 'Cancelados',
            value: occurrenceOrders.length,
            valueColorClass: 'text-rose-400',
            icon: <AlertTriangle className="w-5 h-5 text-rose-400" />,
          },
        ]}
        searchQuery={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por ID, cliente ou peça..."
        activeFilter={activeTab}
        onFilterChange={setActiveTab}
        filters={[
          {
            id: 'todos',
            label: 'Todos',
            count: orders.length,
            icon: <ShoppingBag className="w-3.5 h-3.5 text-cyan-400" />,
            activeColorClass:
              'bg-cyan-950/50 border-cyan-500/40 text-cyan-300 shadow-sm',
          },
          {
            id: 'pagos',
            label: 'Pagos',
            count: paidOrders.length,
            icon: <CreditCard className="w-3.5 h-3.5 text-emerald-400" />,
            activeColorClass:
              'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 shadow-sm',
          },
          {
            id: 'pendentes',
            label: 'Aguardando',
            count: pendingOrders.length,
            icon: <Clock className="w-3.5 h-3.5 text-amber-400" />,
            activeColorClass:
              'bg-amber-950/50 border-amber-500/40 text-amber-300 shadow-sm',
          },
          {
            id: 'envio',
            label: 'Prontos p/ Envio',
            count: readyOrders.length,
            icon: <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />,
            activeColorClass:
              'bg-teal-950/50 border-teal-500/40 text-teal-300 shadow-sm',
          },
          {
            id: 'transito',
            label: 'Em Transporte',
            count: shippedOrders.length,
            icon: <Truck className="w-3.5 h-3.5 text-cyan-400" />,
            activeColorClass:
              'bg-cyan-950/50 border-cyan-500/40 text-cyan-300 shadow-sm',
          },
          {
            id: 'entregues',
            label: 'Entregues',
            count: deliveredOrders.length,
            icon: <Package className="w-3.5 h-3.5 text-slate-400" />,
            activeColorClass:
              'bg-slate-800/80 border-slate-600/50 text-slate-200 shadow-sm',
          },
          {
            id: 'ocorrencias',
            label: 'Cancelados',
            count: occurrenceOrders.length,
            icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />,
            activeColorClass:
              'bg-rose-950/50 border-rose-500/40 text-rose-300 shadow-sm',
          },
        ]}
      />

      {/* TABELA DE GERENCIAMENTO UNIFICADA */}
      <Admin_Orders_Table
        orders={filteredOrders}
        mode="orders"
        expandable={true}
        expandedOrders={expandedOrders}
        onToggleExpand={toggleExpand}
        isPending={isPending}
        onCancelOrder={handleCancelOrder}
        onStatusChange={handleStatusChange}
        onConfirmLocalDelivery={handleConfirmLocalDelivery}
        onConfirmDelivery={handleConfirmCustomerDelivery}
        onFinalizeOrder={handleFinalizeOrder}
        onGenerateLabel={handleGenerateMelhorEnvioLabel}
        onSaveTracking={handleSaveTracking}
        onSaveNotes={handleSaveNotes}
        onResolveOccurrence={handleResolveOccurrence}
      />
    </div>
  )
}
