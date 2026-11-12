'use client'

import React, { useEffect, useState, useTransition, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Link2,
  Copy,
  Check,
  Package,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  Mail,
  Share2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Send,
  User,
  FileText,
  ShoppingBag,
  X,
  Inbox,
  CreditCard,
  XCircle,
} from 'lucide-react'
import { formatCurrency } from '@/lib/format_currency'
import {
  type CatalogProductOption,
  createAssistedSaleDraftAction,
} from '@/app/actions/assisted_sales_actions'
import { cancelOrderAdminAction } from '@/app/actions/order_cancellation_actions'
import { AdminMetricsAndFilterBar } from '@/components/admin/Admin_Metrics_And_Filter_Bar'
import Admin_Orders_Table from '@/components/admin/Admin_Orders_Table'
import {
  normalizeAdminOrder,
  type NormalizedOrderPresentation,
} from '@/lib/order_presenter'

export interface SerializedAssistedOrderItem {
  id: string
  productTitle: string
  quantity: number
  priceUnit: number
  isMadeToOrder: boolean
  productId: string | null
}

export interface SerializedAssistedOrder {
  id: string
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
  logisticsStatus: string
  totalAmount: number
  shippingCost?: number
  isLocalDelivery?: boolean
  isAssistedSale?: boolean
  clientName?: string | null
  assistedSaleExpectedEmail: string | null
  shippingAddressSnapshot?: Record<string, unknown> | null
  adminNotes: string | null
  createdAt: string
  paidAt: string | null
  cancelledAt?: string | null
  checkoutUrl: string
  user: {
    id: string
    name: string | null
    username: string
    email: string
    phone: string | null
  } | null
  items: SerializedAssistedOrderItem[]
}

interface AssistedSalesClientProps {
  products: CatalogProductOption[]
  initialOrders?: SerializedAssistedOrder[]
  defaultOpenCreateModal?: boolean
}

type OriginOption = 'WhatsApp' | 'Instagram' | 'Outro'

interface DraftItem {
  id: string
  productId: string | null
  productTitle: string
  quantity: number
  priceUnit: number
}

// Helper para extração de canal de atendimento
function parseOrderOrigin(notes: string | null): OriginOption {
  if (!notes) return 'WhatsApp'
  if (notes.includes('[Origem: Instagram]')) return 'Instagram'
  if (notes.includes('[Origem: Outro]')) return 'Outro'
  return 'WhatsApp'
}

// Helper para extração de nome do cliente nas notas caso não venha na prop
function parseClientNameFromNotes(notes: string | null): string | null {
  if (!notes) return null
  const match = notes.match(/\[Cliente:\s*([^\]]+)\]/)
  return match?.[1] ? match[1].trim() : null
}

export default function Assisted_Sales_Client({
  products,
  initialOrders = [],
  defaultOpenCreateModal = false,
}: AssistedSalesClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const actionParam = searchParams.get('action')

  // Estado da listagem de pedidos
  const [orders, setOrders] = useState<SerializedAssistedOrder[]>(initialOrders)

  // Controle de abertura do Modal centralizado (Dialog)
  const [isModalOpen, setIsModalOpen] = useState(() =>
    Boolean(defaultOpenCreateModal || actionParam === 'new')
  )

  useEffect(() => {
    const hasNewActionInUrl =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('action') === 'new'

    if (defaultOpenCreateModal || actionParam === 'new' || hasNewActionInUrl) {
      setIsModalOpen(true)
      if (typeof window !== 'undefined' && window.location.search.includes('action=new')) {
        window.history.replaceState(null, '', window.location.pathname)
      }
    }
  }, [defaultOpenCreateModal, actionParam])

  // Filtros da tabela
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'PENDING' | 'PAID' | 'CANCELLED'
  >('ALL')
  const [originFilter, setOriginFilter] = useState<'ALL' | OriginOption>('ALL')

  // Controle de cópia individual de links na tabela
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null)

  // Banner compacto de confirmação do link recém-criado
  const [lastCreatedDraft, setLastCreatedDraft] = useState<{
    orderId: string
    checkoutUrl: string
    clientName: string
    expectedEmail: string
    totalAmount: number
  } | null>(null)
  const [bannerCopied, setBannerCopied] = useState(false)

  // Estados do formulário dentro do Modal
  const [clientName, setClientName] = useState('')
  const [expectedEmail, setExpectedEmail] = useState('')
  const [origin, setOrigin] = useState<OriginOption>('WhatsApp')
  const [adminNotes, setAdminNotes] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])

  // Alternador de item: Catálogo vs Personalizado
  const [addItemMode, setAddItemMode] = useState<'catalog' | 'custom'>('catalog')

  // Estado para item do catálogo
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '')
  const [catalogQuantity, setCatalogQuantity] = useState<number>(1)
  const [catalogPrice, setCatalogPrice] = useState<number>(products[0]?.price || 50)
  const [catalogError, setCatalogError] = useState<string | null>(null)

  // Estado para item personalizado
  const [customTitle, setCustomTitle] = useState('')
  const [customQuantity, setCustomQuantity] = useState<number>(1)
  const [customPrice, setCustomPrice] = useState<number>(50)
  const [customError, setCustomError] = useState<string | null>(null)

  // Submissão do formulário
  const [isPending, startTransition] = useTransition()
  const [formErrorMsg, setFormErrorMsg] = useState<string | null>(null)

  // Métricas compactas
  const metrics = useMemo(() => {
    const total = orders.length
    const pending = orders.filter(
      (o) => o.paymentStatus === 'PENDING' && o.logisticsStatus !== 'CANCELLED'
    ).length
    const paidOrders = orders.filter((o) => o.paymentStatus === 'PAID')
    const paidCount = paidOrders.length
    const cancelledCount = orders.filter((o) => o.logisticsStatus === 'CANCELLED').length
    const revenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0)

    return { total, pending, paidCount, cancelledCount, revenue }
  }, [orders])

  // Filtragem dos pedidos na Tabela
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter === 'CANCELLED') {
        if (order.logisticsStatus !== 'CANCELLED') return false
      } else if (statusFilter === 'PENDING') {
        if (order.paymentStatus !== 'PENDING' || order.logisticsStatus === 'CANCELLED') {
          return false
        }
      } else if (statusFilter !== 'ALL' && order.paymentStatus !== statusFilter) {
        return false
      }

      if (originFilter !== 'ALL') {
        const normalized = normalizeAdminOrder(order)
        const targetOrigin = originFilter === 'Outro' ? 'Balcão' : originFilter
        if (normalized.origin !== targetOrigin) return false
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const normalized = normalizeAdminOrder(order)
        const matchClientName = normalized.clientName.toLowerCase().includes(query)
        const matchEmail = normalized.clientEmail.toLowerCase().includes(query)
        const matchId = order.id.toLowerCase().includes(query)
        const matchItem = order.items.some((item) =>
          item.productTitle.toLowerCase().includes(query)
        )

        if (!matchClientName && !matchEmail && !matchId && !matchItem) {
          return false
        }
      }

      return true
    })
  }, [orders, statusFilter, originFilter, searchQuery])

  // Atualiza preço ao selecionar outro produto do catálogo
  const handleProductSelectChange = (id: string) => {
    setSelectedProductId(id)
    setCatalogError(null)
    const found = products.find((p) => p.id === id)
    if (found) {
      setCatalogPrice(found.price)
    }
  }

  // Adicionar item do catálogo ao rascunho com validação financeira
  const handleAddCatalogItem = () => {
    setCatalogError(null)
    const found = products.find((p) => p.id === selectedProductId)
    if (!found) {
      setCatalogError('Selecione um produto válido.')
      return
    }

    if (isNaN(catalogQuantity) || catalogQuantity <= 0) {
      setCatalogError('A quantidade deve ser de no mínimo 1.')
      return
    }

    if (isNaN(catalogPrice) || catalogPrice <= 0) {
      setCatalogError('Preço deve ser maior que zero (R$ 0,00 não permitido).')
      return
    }

    setItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        productId: found.id,
        productTitle: found.title,
        quantity: Math.floor(catalogQuantity),
        priceUnit: Number(catalogPrice.toFixed(2)),
      },
    ])
    setCatalogQuantity(1)
    setCatalogPrice(found.price)
    setFormErrorMsg(null)
  }

  // Adicionar item personalizado com validação financeira
  const handleAddCustomItem = () => {
    setCustomError(null)
    const trimmedTitle = customTitle.trim()
    if (!trimmedTitle) {
      setCustomError('Informe o nome/descrição da peça personalizada.')
      return
    }

    if (isNaN(customQuantity) || customQuantity <= 0) {
      setCustomError('A quantidade deve ser de no mínimo 1.')
      return
    }

    if (isNaN(customPrice) || customPrice <= 0) {
      setCustomError('Preço deve ser maior que zero (R$ 0,00 não permitido).')
      return
    }

    setItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        productId: null,
        productTitle: trimmedTitle,
        quantity: Math.floor(customQuantity),
        priceUnit: Number(customPrice.toFixed(2)),
      },
    ])
    setCustomTitle('')
    setCustomQuantity(1)
    setCustomPrice(50)
    setFormErrorMsg(null)
  }

  // Remover item
  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  // Subtotal do rascunho em edição
  const subtotal = items.reduce((acc, curr) => acc + curr.priceUnit * curr.quantity, 0)

  // Submissão do novo rascunho
  const handleSubmitDraft = (e: React.FormEvent) => {
    e.preventDefault()
    setFormErrorMsg(null)

    if (!clientName.trim()) {
      setFormErrorMsg('Informe o nome do cliente.')
      return
    }

    if (!expectedEmail.trim()) {
      setFormErrorMsg('Informe o e-mail esperado do destinatário do link.')
      return
    }

    if (items.length === 0) {
      setFormErrorMsg('Adicione pelo menos um item ao pedido.')
      return
    }

    const hasInvalidPrice = items.some((i) => isNaN(i.priceUnit) || i.priceUnit <= 0)
    if (hasInvalidPrice) {
      setFormErrorMsg('Existem itens com valor unitário inválido (deve ser estritamente maior que zero).')
      return
    }

    const hasInvalidQty = items.some((i) => isNaN(i.quantity) || i.quantity <= 0)
    if (hasInvalidQty) {
      setFormErrorMsg('Existem itens com quantidade inválida (mínimo de 1).')
      return
    }

    if (subtotal <= 0) {
      setFormErrorMsg('O valor total do rascunho deve ser maior que zero.')
      return
    }

    startTransition(async () => {
      try {
        const trimmedClientName = clientName.trim()
        const payload = {
          clientName: trimmedClientName,
          expectedEmail: expectedEmail.trim().toLowerCase(),
          origin,
          adminNotes: adminNotes.trim() || null,
          items: items.map((i) => ({
            productId: i.productId,
            productTitle: i.productTitle,
            quantity: i.quantity,
            priceUnit: i.priceUnit,
          })),
        }

        const res = await createAssistedSaleDraftAction(payload)
        if (res.success && res.orderId && res.checkoutUrl) {
          const newOrder: SerializedAssistedOrder = {
            id: res.orderId,
            paymentStatus: 'PENDING',
            logisticsStatus: 'PREPARING',
            totalAmount: subtotal,
            clientName: trimmedClientName,
            assistedSaleExpectedEmail: expectedEmail.trim().toLowerCase(),
            adminNotes: `[Cliente: ${trimmedClientName}] [Origem: ${origin}] - ${adminNotes.trim() || 'Rascunho de venda assistida'}`,
            createdAt: new Date().toISOString(),
            paidAt: null,
            checkoutUrl: res.checkoutUrl,
            user: null,
            items: items.map((i) => ({
              id: Math.random().toString(36).substring(7),
              productTitle: i.productTitle,
              quantity: i.quantity,
              priceUnit: i.priceUnit,
              isMadeToOrder: true,
              productId: i.productId,
            })),
          }

          // Atualiza lista local imediatamente no topo
          setOrders((prev) => [newOrder, ...prev])

          // Notificação de sucesso
          setLastCreatedDraft({
            orderId: res.orderId,
            checkoutUrl: res.checkoutUrl,
            clientName: trimmedClientName,
            expectedEmail: expectedEmail.trim().toLowerCase(),
            totalAmount: subtotal,
          })

          // Limpa formulário e fecha o modal
          setClientName('')
          setExpectedEmail('')
          setAdminNotes('')
          setItems([])
          setIsModalOpen(false)

          // Revalida a página no servidor
          router.refresh()
        } else {
          setFormErrorMsg(res.error || 'Falha ao criar rascunho de venda assistida.')
        }
      } catch (err: unknown) {
        console.error('Erro na criação:', err)
        setFormErrorMsg('Ocorreu um erro inesperado ao gerar o rascunho.')
      }
    })
  }

  // Copiar link de pedido da tabela
  const handleCopyLink = (order: NormalizedOrderPresentation) => {
    navigator.clipboard.writeText(order.checkoutUrl)
    setCopiedOrderId(order.id)
    setTimeout(() => setCopiedOrderId(null), 2500)
  }

  // Revogar / Cancelar orçamento pendente
  const handleRevokeOrder = (orderId: string) => {
    const shortId = orderId.slice(-6).toUpperCase()
    const reason = window.prompt(
      `Informe o motivo para revogar/cancelar o orçamento #${shortId}:`
    )
    if (reason === null) return
    const trimmed = reason.trim()
    if (!trimmed) return

    startTransition(async () => {
      const res = await cancelOrderAdminAction(orderId, trimmed)
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
        router.refresh()
      } else {
        alert(res.error || 'Falha ao cancelar orçamento.')
      }
    })
  }

  // Copiar link do banner de sucesso
  const handleCopyBannerLink = () => {
    if (!lastCreatedDraft) return
    navigator.clipboard.writeText(lastCreatedDraft.checkoutUrl)
    setBannerCopied(true)
    setTimeout(() => setBannerCopied(false), 2500)
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* 1. BARRA SUPERIOR COMPACTA COM FATURAMENTO E BOTÃO "+ NOVA VENDA ASSISTIDA" */}
      <div className="flex justify-between items-center w-full mb-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400 font-medium">Faturamento</span>
          <span className="text-emerald-400 font-bold tracking-wide">
            {formatCurrency(metrics.revenue)}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormErrorMsg(null)
            setIsModalOpen(true)
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider transition shadow-md shadow-cyan-950/40 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Venda Assistida</span>
        </button>
      </div>

      {/* 2. NOTIFICAÇÃO COMPACTA DO LINK RECÉM-CRIADO */}
      {lastCreatedDraft && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/90 via-[#071927] to-slate-950 border border-cyan-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2.5 truncate w-full sm:w-auto">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 animate-pulse" />
            <div className="truncate">
              <span className="text-cyan-300 font-bold">Link Gerado com Sucesso: </span>
              <span className="text-slate-200">
                Pedido #{lastCreatedDraft.orderId.slice(-6).toUpperCase()} &bull;{' '}
                <strong>{lastCreatedDraft.clientName}</strong> ({lastCreatedDraft.expectedEmail}) &bull;{' '}
                <strong className="text-emerald-400 font-mono">
                  {formatCurrency(lastCreatedDraft.totalAmount)}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleCopyBannerLink}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-1"
            >
              {bannerCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Link</span>
                </>
              )}
            </button>

            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                `Olá! Segue o link seguro para conclusão do seu pedido na Lúmen 3D:\n${lastCreatedDraft.checkoutUrl}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white transition"
              title="Enviar por WhatsApp"
            >
              <Send className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={() => setLastCreatedDraft(null)}
              className="p-1 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. MÉTRICAS E BARRA UNIFICADA DE BUSCA E FILTROS */}
      <AdminMetricsAndFilterBar
        metrics={[
          {
            id: 'total',
            label: 'Total',
            value: metrics.total,
            valueColorClass: 'text-slate-100',
            icon: <ShoppingBag className="w-5 h-5 text-slate-500" />,
          },
          {
            id: 'pending',
            label: 'Aguardando',
            value: metrics.pending,
            valueColorClass: 'text-amber-400',
            icon: <Clock className="w-5 h-5 text-amber-400" />,
            showPulseDot: metrics.pending > 0,
            dotColorClass: 'bg-amber-400',
          },
          {
            id: 'paid',
            label: 'Pagos',
            value: metrics.paidCount,
            valueColorClass: 'text-emerald-400',
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
          },
          {
            id: 'cancelled',
            label: 'Cancelados',
            value: metrics.cancelledCount,
            valueColorClass: 'text-red-500',
            icon: <XCircle className="w-5 h-5 text-red-500" />,
          },
        ]}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Buscar por cliente, e-mail, ID ou peça..."
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        filters={[
          {
            id: 'ALL',
            label: 'Todos',
            count: orders.length,
            icon: <Inbox className="w-3.5 h-3.5 text-cyan-400" />,
            activeColorClass:
              'bg-cyan-950/50 border-cyan-500/40 text-cyan-300 shadow-sm',
          },
          {
            id: 'PENDING',
            label: 'Aguardando',
            count: metrics.pending,
            icon: <Clock className="w-3.5 h-3.5 text-amber-400" />,
            activeColorClass:
              'bg-amber-950/50 border-amber-500/40 text-amber-300 shadow-sm',
          },
          {
            id: 'PAID',
            label: 'Pagos',
            count: metrics.paidCount,
            icon: <CreditCard className="w-3.5 h-3.5 text-emerald-400" />,
            activeColorClass:
              'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 shadow-sm',
          },
          {
            id: 'CANCELLED',
            label: 'Cancelados',
            count: metrics.cancelledCount,
            icon: <XCircle className="w-3.5 h-3.5 text-rose-400" />,
            activeColorClass:
              'bg-rose-950/50 border-rose-500/40 text-rose-300 shadow-sm',
          },
        ]}
        rightSlot={
          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value as 'ALL' | OriginOption)}
            aria-label="Filtrar por canal de origem"
            className="px-3 py-2 bg-[#050811]/60 border border-gray-800/80 rounded-xl text-xs font-semibold text-gray-200 focus:outline-none focus:border-cyan-800/70 cursor-pointer"
          >
            <option value="ALL">Todas Origens</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Instagram">Instagram</option>
            <option value="Outro">Outro</option>
          </select>
        }
      />

      {/* 4. TABELA DE GERENCIAMENTO UNIFICADA */}
      <Admin_Orders_Table
        orders={filteredOrders}
        mode="assisted"
        isPending={isPending}
        onCopyLink={handleCopyLink}
        copiedOrderId={copiedOrderId}
        onCancelOrder={handleRevokeOrder}
        emptyTitle="Nenhum rascunho de venda assistida encontrado nesta visualização."
        emptySubtitle='Alterne os filtros ou clique em "+ Nova Venda Assistida" acima para emitir um link.'
      />

      {/* 5. MODAL CENTRALIZADO (DIALOG) PARA CRIAÇÃO DE RASCUNHO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          {/* Backdrop escuro com blur e clique para fechar */}
          <div
            onClick={() => setIsModalOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            aria-hidden="true"
          />

          {/* Caixa do Dialog centralizada perfeitamente */}
          <div className="relative w-full max-w-2xl bg-[#090e1d] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in zoom-in-95 duration-200">
            {/* Topo do Modal com Título e Botão X */}
            <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/70 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-100">
                    Nova Venda Assistida
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Emita um link exclusivo de checkout para pedidos sob medida
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo com scroll independente para não quebrar o modal */}
            <form onSubmit={handleSubmitDraft} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-4 max-h-[calc(90vh-140px)]">
                {formErrorMsg && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{formErrorMsg}</span>
                  </div>
                )}

                {/* Nome do Cliente, E-mail e Origem */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-4 space-y-1">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Nome do Cliente *</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Ex: João Silva"
                      aria-label="Nome do Cliente"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="sm:col-span-5 space-y-1">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-cyan-400" />
                      <span>E-mail do Cliente *</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={expectedEmail}
                      onChange={(e) => setExpectedEmail(e.target.value)}
                      placeholder="cliente@exemplo.com"
                      aria-label="E-mail do Cliente"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                      <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Canal</span>
                    </label>
                    <select
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value as OriginOption)}
                      aria-label="Canal de atendimento"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Instagram">Instagram</option>
                      <option value="Outro">Outro / Balcão</option>
                    </select>
                  </div>
                </div>

                {/* Inclusão de Peças */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5" />
                      <span>Adicionar Peça</span>
                    </span>

                    <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setAddItemMode('catalog')}
                        className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                          addItemMode === 'catalog'
                            ? 'bg-cyan-600 text-white font-bold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Do Catálogo
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddItemMode('custom')}
                        className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                          addItemMode === 'custom'
                            ? 'bg-indigo-600 text-white font-bold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Personalizado 3D
                      </button>
                    </div>
                  </div>

                  {addItemMode === 'catalog' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                      <div className="sm:col-span-6">
                        <label className="text-[11px] text-slate-400 block mb-1">Produto</label>
                        <select
                          value={selectedProductId}
                          onChange={(e) => handleProductSelectChange(e.target.value)}
                          aria-label="Selecionar produto do catálogo"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500 cursor-pointer"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title} &bull; {formatCurrency(p.price)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[11px] text-slate-400 block mb-1">Qtd</label>
                        <input
                          type="number"
                          min="1"
                          value={catalogQuantity === 0 ? '' : catalogQuantity}
                          onChange={(e) => {
                            setCatalogError(null)
                            setCatalogQuantity(parseInt(e.target.value) || 0)
                          }}
                          aria-label="Quantidade do produto"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500 text-center"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[11px] text-slate-400 block mb-1">Preço (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={catalogPrice === 0 ? '' : catalogPrice}
                          onChange={(e) => {
                            setCatalogError(null)
                            setCatalogPrice(parseFloat(e.target.value) || 0)
                          }}
                          aria-label="Preço unitário do produto"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500 text-right font-mono"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          onClick={handleAddCatalogItem}
                          className="w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition cursor-pointer"
                        >
                          + Incluir
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                      <div className="sm:col-span-6">
                        <label className="text-[11px] text-slate-400 block mb-1">Descrição da Peça *</label>
                        <input
                          type="text"
                          value={customTitle}
                          onChange={(e) => {
                            setCustomError(null)
                            setCustomTitle(e.target.value)
                          }}
                          placeholder="Ex: Suporte Fone Personalizado"
                          aria-label="Descrição da peça personalizada"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[11px] text-slate-400 block mb-1">Qtd</label>
                        <input
                          type="number"
                          min="1"
                          value={customQuantity === 0 ? '' : customQuantity}
                          onChange={(e) => {
                            setCustomError(null)
                            setCustomQuantity(parseInt(e.target.value) || 0)
                          }}
                          aria-label="Quantidade da peça personalizada"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500 text-center"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[11px] text-slate-400 block mb-1">Preço (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={customPrice === 0 ? '' : customPrice}
                          onChange={(e) => {
                            setCustomError(null)
                            setCustomPrice(parseFloat(e.target.value) || 0)
                          }}
                          aria-label="Preço da peça personalizada"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500 text-right font-mono"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          onClick={handleAddCustomItem}
                          className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition cursor-pointer"
                        >
                          + Incluir
                        </button>
                      </div>
                    </div>
                  )}

                  {(catalogError || customError) && (
                    <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{catalogError || customError}</span>
                    </p>
                  )}

                  {/* Lista com scroll caso muitos itens sejam inseridos */}
                  {items.length > 0 && (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 divide-y divide-slate-800/60 overflow-y-auto max-h-40 mt-2">
                      {items.map((item) => (
                        <div key={item.id} className="p-2.5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono text-cyan-300 font-bold">{item.quantity}x</span>
                            <span className="text-slate-200 truncate">{item.productTitle}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                              {item.productId ? 'Catálogo' : 'Personalizado'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono font-bold text-slate-200">
                              {formatCurrency(item.priceUnit * item.quantity)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                              title="Remover"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Observações Internas */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Observações Internas (adminNotes)</span>
                  </label>
                  <input
                    type="text"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Ex: Peça em filamento preto fosco. Entrega presencial no balcão."
                    aria-label="Observações internas da venda"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Rodapé Fixo do Modal */}
              <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-4 shrink-0">
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">Total do Rascunho</span>
                  <span
                    className={`text-lg font-black font-mono ${
                      subtotal > 0 ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    {formatCurrency(subtotal)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isPending || items.length === 0 || subtotal <= 0}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition shadow-md shadow-cyan-950/40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Emitindo...</span>
                      </>
                    ) : (
                      <>
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Emitir Link Privado</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
