'use client'

import React, { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import {
  Printer,
  CheckCircle2,
  Package,
  Check,
  Loader2,
  Clock,
  User,
  MapPin,
  AlertTriangle,
  Sparkles,
  Layers,
  ExternalLink,
  Lock,
} from 'lucide-react'
import { OrderItemProductionStatus } from '@prisma/client'
import {
  type ProductionQueueItem,
  advanceItemStatusAction,
} from '@/app/actions/production_actions'
import { AdminMetricsAndFilterBar } from '@/components/admin/Admin_Metrics_And_Filter_Bar'
import {
  resolveOrderClientIdentity,
  type PresentableOrderInput,
} from '@/lib/order_presenter'

interface ProductionQueueClientProps {
  initialItems: ProductionQueueItem[]
  initialSearch?: string
}

type TabKey = 'todos' | 'na_fila' | 'imprimindo' | 'pos_processamento' | 'concluidos'

const statusBadges: Record<
  OrderItemProductionStatus,
  { label: string; style: string; dot: string }
> = {
  QUEUED: {
    label: 'Na Fila',
    style: 'bg-[#121624] text-slate-300 border-slate-800',
    dot: 'bg-slate-400',
  },
  PRINTING: {
    label: 'Imprimindo',
    style: 'bg-[#0c1f38] text-sky-300 border-sky-900/60',
    dot: 'bg-sky-400 animate-pulse',
  },
  POST_PROCESSING: {
    label: 'Pós-Processamento',
    style: 'bg-[#221035] text-purple-300 border-purple-900/60',
    dot: 'bg-purple-400',
  },
  READY: {
    label: 'Concluído',
    style: 'bg-[#062c1d] text-emerald-300 border-emerald-900/70',
    dot: 'bg-emerald-400',
  },
}

function renderVariantBadge(snapshot: unknown) {
  if (!snapshot) {
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-800">
        Padrão
      </span>
    )
  }

  let parsed = snapshot
  if (typeof snapshot === 'string') {
    try {
      parsed = JSON.parse(snapshot)
    } catch {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
          {snapshot}
        </span>
      )
    }
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const entries = Object.entries(parsed as Record<string, unknown>)
    if (entries.length === 0) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-800">
          Padrão
        </span>
      )
    }

    return (
      <div className="flex flex-wrap gap-1">
        {entries.map(([key, value]) => (
          <span
            key={key}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-950/60 text-cyan-300 border border-cyan-800/40 text-[10px] font-mono"
          >
            <span className="text-cyan-500/80">{key}:</span>
            <span className="font-semibold text-cyan-200">{String(value)}</span>
          </span>
        ))}
      </div>
    )
  }

  return (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-800">
      Padrão
    </span>
  )
}

export default function Production_Queue_Client({
  initialItems,
  initialSearch = '',
}: ProductionQueueClientProps) {
  const [items, setItems] = useState<ProductionQueueItem[]>(initialItems)
  const [activeTab, setActiveTab] = useState<TabKey>('todos')
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>(
    () =>
      initialSearch ||
      (typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('search') || ''
        : '')
  )
  const [, startTransition] = useTransition()
  const [successBanner, setSuccessBanner] = useState<{
    orderId: string
    shortId: string
  } | null>(null)

  // Limpa o parâmetro search da URL após montar
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search) {
      const params = new URLSearchParams(window.location.search)
      if (params.has('search')) {
        params.delete('search')
        const newQuery = params.toString() ? `?${params.toString()}` : ''
        window.history.replaceState(
          {},
          '',
          `${window.location.pathname}${newQuery}${window.location.hash}`
        )
      }
    }
  }, [])

  // Cálculo de dias decorridos desde a compra
  const getElapsedDays = (createdAtStr: string) => {
    const created = new Date(createdAtStr)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - created.getTime())
    return Math.floor(diffTime / (1000 * 60 * 60 * 24))
  }

  // Contadores por Status Real de Produção
  const activeItemsCount = items.filter(
    (i) => i.productionStatus !== OrderItemProductionStatus.READY
  ).length
  const naFilaCount = items.filter(
    (i) => i.productionStatus === OrderItemProductionStatus.QUEUED
  ).length
  const imprimindoCount = items.filter(
    (i) => i.productionStatus === OrderItemProductionStatus.PRINTING
  ).length
  const posProcessamentoCount = items.filter(
    (i) => i.productionStatus === OrderItemProductionStatus.POST_PROCESSING
  ).length
  const concluidosCount = items.filter(
    (i) => i.productionStatus === OrderItemProductionStatus.READY
  ).length

  // Filtragem ativa por tab e busca
  const filteredItems = items.filter((item) => {
    if (activeTab === 'todos') {
      // "Todos" mostra todos os itens ativos na oficina
      if (item.productionStatus === OrderItemProductionStatus.READY) return false
    } else if (activeTab === 'na_fila') {
      if (item.productionStatus !== OrderItemProductionStatus.QUEUED) return false
    } else if (activeTab === 'imprimindo') {
      if (item.productionStatus !== OrderItemProductionStatus.PRINTING) return false
    } else if (activeTab === 'pos_processamento') {
      if (item.productionStatus !== OrderItemProductionStatus.POST_PROCESSING) return false
    } else if (activeTab === 'concluidos') {
      if (item.productionStatus !== OrderItemProductionStatus.READY) return false
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      const { clientName, clientEmail } = resolveOrderClientIdentity(
        item.order as unknown as PresentableOrderInput
      )
      const matchProduct = item.productTitle.toLowerCase().includes(q)
      const matchOrder = item.order.id.toLowerCase().includes(q)
      const matchUser =
        clientName.toLowerCase().includes(q) ||
        clientEmail.toLowerCase().includes(q) ||
        item.order.user?.name?.toLowerCase().includes(q) ||
        item.order.user?.username?.toLowerCase().includes(q) ||
        item.order.user?.email?.toLowerCase().includes(q)
      return matchProduct || matchOrder || matchUser
    }

    return true
  })

  // Avançar para a próxima etapa na esteira
  const handleAdvanceStage = (orderItemId: string) => {
    if (loadingItemId) return
    const targetItem = items.find((i) => i.id === orderItemId)
    setLoadingItemId(orderItemId)

    startTransition(async () => {
      try {
        const res = await advanceItemStatusAction(orderItemId)
        if (res.success && res.newStatus) {
          const nowStr = new Date().toISOString()
          setItems((prev) =>
            prev.map((i) =>
              i.id === orderItemId
                ? {
                    ...i,
                    productionStatus: res.newStatus as OrderItemProductionStatus,
                    isReady: res.newStatus === OrderItemProductionStatus.READY,
                    readyAt:
                      res.newStatus === OrderItemProductionStatus.READY ? nowStr : i.readyAt,
                  }
                : i
            )
          )

          if (res.orderMovedToReady && targetItem) {
            setSuccessBanner({
              orderId: targetItem.orderId,
              shortId: targetItem.orderId.slice(-6).toUpperCase(),
            })
          }
        } else {
          alert(res.error || 'Erro ao avançar etapa.')
        }
      } catch (err: unknown) {
        console.error('Erro na ação:', err)
        alert('Ocorreu um erro ao atualizar o item.')
      } finally {
        setLoadingItemId(null)
      }
    })
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Banner de Notificação de Auto-Avanço */}
      {successBanner && (
        <div className="p-4 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl shadow-teal-950/30 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-teal-100">
                🎉 Todas as peças do pedido #{successBanner.shortId} estão prontas!
              </p>
              <p className="text-[11px] text-teal-300/80">
                O pedido foi automaticamente promovido para <strong>Pronto p/ Envio</strong> no Gerenciar Vendas.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Link
              href="/admin/orders?tab=envio"
              className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition shadow-sm"
            >
              Ver na Expedição
            </Link>
            <button
              onClick={() => setSuccessBanner(null)}
              className="p-1 text-teal-400 hover:text-teal-200 text-xs"
              aria-label="Fechar alerta"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 2. MÉTRICAS E BARRA UNIFICADA DE BUSCA E FILTROS */}
      <AdminMetricsAndFilterBar
        metrics={[
          {
            id: 'queued',
            label: 'Peças na Fila',
            value: naFilaCount,
            valueColorClass: 'text-indigo-400',
            icon: <Clock className="w-5 h-5 text-indigo-400" />,
          },
          {
            id: 'printing',
            label: 'Imprimindo',
            value: imprimindoCount,
            valueColorClass: 'text-sky-400',
            icon: <Printer className="w-5 h-5 text-sky-400" />,
            showPulseDot: imprimindoCount > 0,
            dotColorClass: 'bg-sky-400',
          },
          {
            id: 'post_processing',
            label: 'Pós-Processamento',
            value: posProcessamentoCount,
            valueColorClass: 'text-purple-400',
            icon: <Sparkles className="w-5 h-5 text-purple-400" />,
          },
          {
            id: 'completed',
            label: 'Concluídas',
            value: concluidosCount,
            valueColorClass: 'text-emerald-400',
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
          },
        ]}
        searchQuery={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por peça, pedido ou cliente..."
        activeFilter={activeTab}
        onFilterChange={setActiveTab}
        filters={[
          {
            id: 'todos',
            label: 'Todos Ativos',
            count: activeItemsCount,
            icon: <Layers className="w-3.5 h-3.5 text-cyan-400" />,
            activeColorClass:
              'bg-cyan-950/50 border-cyan-500/40 text-cyan-300 shadow-sm',
          },
          {
            id: 'na_fila',
            label: 'Na Fila',
            count: naFilaCount,
            icon: <Clock className="w-3.5 h-3.5 text-indigo-400" />,
            activeColorClass:
              'bg-indigo-950/50 border-indigo-500/40 text-indigo-300 shadow-sm',
          },
          {
            id: 'imprimindo',
            label: 'Imprimindo',
            count: imprimindoCount,
            icon: <Printer className="w-3.5 h-3.5 text-sky-400" />,
            activeColorClass:
              'bg-sky-950/50 border-sky-500/40 text-sky-300 shadow-sm',
          },
          {
            id: 'pos_processamento',
            label: 'Pós-Processamento',
            count: posProcessamentoCount,
            icon: <Sparkles className="w-3.5 h-3.5 text-purple-400" />,
            activeColorClass:
              'bg-purple-950/50 border-purple-500/40 text-purple-300 shadow-sm',
          },
          {
            id: 'concluidos',
            label: 'Concluídos',
            count: concluidosCount,
            icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
            activeColorClass:
              'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 shadow-sm',
          },
        ]}
      />

      {/* 4. Order List Table de Produção */}
      <div>
        {filteredItems.length === 0 ? (
          /* Estado Vazio (Empty State) Refinado */
          <div className="py-10 px-6 rounded-2xl bg-[#0a0e1a] border border-gray-800 text-center text-slate-400 space-y-3 max-w-2xl mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-slate-200">
                {activeTab === 'concluidos'
                  ? 'Nenhuma peça no histórico de concluídos ainda.'
                  : 'Tudo em dia na oficina!'}
              </h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {activeTab === 'concluidos'
                  ? 'As peças finalizadas nas etapas anteriores serão arquivadas permanentemente aqui.'
                  : 'Não há peças sob encomenda aguardando produção para esta etapa.'}
              </p>
            </div>
            {activeTab !== 'concluidos' && (
              <div className="pt-1">
                <Link
                  href="/admin/orders"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-cyan-400 border border-slate-800 transition"
                >
                  <span>Ver Gerenciar Vendas</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800/80 bg-[#080d1e]/90 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/60 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Pedido & Cliente</th>
                  <th className="py-3 px-4">Peça & Especificações</th>
                  <th className="py-3 px-4 text-center">Quantidade</th>
                  <th className="py-3 px-4">Data Limite / Prazo</th>
                  <th className="py-3 px-4">Status Operacional</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-xs">
                {filteredItems.map((item) => {
                  const createdDate = new Date(item.order.createdAt)
                  const elapsedDays = getElapsedDays(item.order.createdAt)
                  const isCompleted = item.productionStatus === OrderItemProductionStatus.READY
                  const isOverdue =
                    item.productionDays &&
                    elapsedDays > item.productionDays &&
                    !isCompleted

                  const deadlineDate = item.productionDays
                    ? new Date(
                        createdDate.getTime() +
                          item.productionDays * 24 * 60 * 60 * 1000
                      )
                    : null

                  const badge =
                    statusBadges[item.productionStatus] || statusBadges.QUEUED
                  const isLoading = loadingItemId === item.id

                  const { clientName } = resolveOrderClientIdentity(
                    item.order as unknown as PresentableOrderInput
                  )

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors duration-150 ${
                        isOverdue
                          ? 'bg-rose-950/15 hover:bg-rose-950/25'
                          : isCompleted
                          ? 'bg-slate-950/40 hover:bg-slate-950/60 opacity-90'
                          : 'hover:bg-slate-900/50'
                      }`}
                    >
                      {/* Coluna 1: Pedido & Cliente */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/admin/orders?search=${item.order.id.slice(-6).toUpperCase()}&expand=${item.order.id}`}
                              className="font-bold text-slate-100 hover:text-cyan-300 transition text-xs"
                              title="Ver pedido no Gerenciar Vendas"
                            >
                              #{item.order.id.slice(-6).toUpperCase()}
                            </Link>
                            {item.order.isLocalDelivery && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[10px] text-teal-400 font-mono"
                                title="Entrega Local Grátis"
                              >
                                <MapPin className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                          <p
                            className="text-[11px] text-slate-400 flex items-center gap-1 font-sans truncate max-w-[150px]"
                            title={clientName}
                          >
                            <User className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate">{clientName}</span>
                          </p>
                        </div>
                      </td>

                      {/* Coluna 2: Peça & Especificações */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {item.product?.images?.[0] ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={item.product.images[0]}
                              alt={item.productTitle}
                              className="w-9 h-9 rounded-xl object-cover border border-slate-800 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                          )}

                          <div className="min-w-0 max-w-[200px] sm:max-w-[260px] space-y-1">
                            <p className="font-semibold text-slate-100 truncate text-xs">
                              {item.productTitle}
                            </p>
                            {renderVariantBadge(item.variantAttributesSnapshot)}
                          </div>
                        </div>
                      </td>

                      {/* Coluna 3: Quantidade (Destacada) */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-indigo-950/70 text-indigo-300 border border-indigo-900/60 shadow-sm">
                          {item.quantity} un
                        </span>
                      </td>

                      {/* Coluna 4: Data Limite / Prazo */}
                      <td className="py-3.5 px-4 font-mono">
                        {deadlineDate ? (
                          <div className="space-y-0.5">
                            <p className="text-slate-200 font-semibold text-xs">
                              {deadlineDate.toLocaleDateString('pt-BR')}
                            </p>
                            <div className="flex items-center gap-1 text-[10px]">
                              {isOverdue ? (
                                <span className="px-1.5 py-0.2 rounded bg-[#2c0e12] text-rose-300 border border-rose-900/70 font-bold inline-flex items-center gap-1">
                                  <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                                  <span>Atrasado ({elapsedDays}d)</span>
                                </span>
                              ) : isCompleted ? (
                                <span className="text-emerald-400 font-mono">
                                  Entregue no prazo
                                </span>
                              ) : (
                                <span className="text-slate-400">
                                  {item.productionDays}d úteis (há {elapsedDays}d)
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <p className="text-slate-300 text-xs">
                              {createdDate.toLocaleDateString('pt-BR')}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              Comprado há {elapsedDays}d
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Coluna 5: Status Operacional (Badge do Status Real) */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border inline-flex items-center gap-1.5 ${badge.style}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* Coluna 6: Ação */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isCompleted ? (
                            /* Visão de Concluídos: Histórico Inalterável */
                            <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono justify-end">
                              <Lock className="w-3 h-3 text-emerald-400/80" />
                              <span title={`Concluído em ${item.readyAt ? new Date(item.readyAt).toLocaleString('pt-BR') : 'registro'}`}>
                                Histórico Inalterável
                              </span>
                            </div>
                          ) : (
                            /* Etapas Ativas: Botão de Avanço na Esteira + Atalho Concluir */
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Botão de Avançar Etapa */}
                              {item.productionStatus === OrderItemProductionStatus.QUEUED && (
                                <button
                                  onClick={() => handleAdvanceStage(item.id)}
                                  disabled={isLoading || Boolean(loadingItemId)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-xs transition shadow-md shadow-sky-950/40 cursor-pointer disabled:cursor-not-allowed"
                                  title="Iniciar impressão desta peça na máquina"
                                >
                                  {isLoading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Printer className="w-3.5 h-3.5" />
                                  )}
                                  <span>Iniciar Impressão</span>
                                </button>
                              )}

                              {item.productionStatus === OrderItemProductionStatus.PRINTING && (
                                <button
                                  onClick={() => handleAdvanceStage(item.id)}
                                  disabled={isLoading || Boolean(loadingItemId)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-xs transition shadow-md shadow-purple-950/40 cursor-pointer disabled:cursor-not-allowed"
                                  title="Enviar peça para bancada de pós-processamento"
                                >
                                  {isLoading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Sparkles className="w-3.5 h-3.5" />
                                  )}
                                  <span>Enviar p/ Acabamento</span>
                                </button>
                              )}

                              {item.productionStatus === OrderItemProductionStatus.POST_PROCESSING && (
                                <button
                                  onClick={() => handleAdvanceStage(item.id)}
                                  disabled={isLoading || Boolean(loadingItemId)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-xs transition shadow-md shadow-cyan-950/40 cursor-pointer disabled:cursor-not-allowed"
                                  title="Finalizar e marcar como pronta"
                                >
                                  {isLoading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                  <span>Concluir Peça</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
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
