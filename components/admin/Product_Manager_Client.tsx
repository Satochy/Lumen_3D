'use client'

import React, { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Package,
  Clock,
  ExternalLink,
  Plus,
  Upload,
  Download,
  Trash2,
  Archive,
  RotateCcw,
  CheckCircle2,
  X,
  FileSpreadsheet,
  AlertCircle,
  CheckSquare,
} from 'lucide-react'
import { formatCurrency } from '@/lib/format_currency'
import { AdminMetricsAndFilterBar } from '@/components/admin/Admin_Metrics_And_Filter_Bar'
import Product_Form from '@/components/admin/Product_Form'
import {
  createProductAction,
  deleteProductAction,
  archiveProductAction,
  restoreProductAction,
  bulkArchiveProductsAction,
  bulkDeleteProductsAction,
} from '@/app/actions/product_actions'

export interface SerializedAdminProduct {
  id: string
  title: string
  slug: string
  description: string
  category: string
  price: number
  stock: number
  reservedStock: number
  isMadeToOrder: boolean
  productionDays: number | null
  weightGrams: number | null
  dimensions: string | null
  images: string[]
  isFeatured: boolean
  archivedAt: string | null
  createdAt: string
  orderItemsCount: number
}

interface ProductManagerClientProps {
  initialProducts: SerializedAdminProduct[]
  defaultOpenCreateModal?: boolean
}

type ProductFilterKey = 'Pronta Entrega' | 'Sob Encomenda' | 'Ativos' | 'Arquivados'

export default function Product_Manager_Client({
  initialProducts,
  defaultOpenCreateModal = false,
}: ProductManagerClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const actionParam = searchParams.get('action')
  const [isPending, startTransition] = useTransition()

  // Busca e filtros cumulativos da tela principal
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])

  // Modal de Seleção Múltipla em Lote (Bulk Actions)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [bulkSearchQuery, setBulkSearchQuery] = useState('')
  const [bulkActiveFilters, setBulkActiveFilters] = useState<string[]>([])
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])

  // Modais de Cadastro de Produto e Importação CSV
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(() =>
    Boolean(defaultOpenCreateModal || actionParam === 'new')
  )
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null)

  // Abre o modal de criação automaticamente quando acionado por atalho (?action=new)
  useEffect(() => {
    const hasNewActionInUrl =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('action') === 'new'

    if (defaultOpenCreateModal || actionParam === 'new' || hasNewActionInUrl) {
      setIsCreateModalOpen(true)
      if (typeof window !== 'undefined' && window.location.search.includes('action=new')) {
        window.history.replaceState(null, '', window.location.pathname)
      }
    }
  }, [defaultOpenCreateModal, actionParam])

  // Feedback de ação (erros/sucesso)
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  // Métricas gerais
  const totalCount = initialProducts.length
  const activeCount = useMemo(
    () => initialProducts.filter((p) => p.archivedAt === null).length,
    [initialProducts]
  )
  const readyStockCount = useMemo(
    () => initialProducts.filter((p) => !p.isMadeToOrder).length,
    [initialProducts]
  )
  const madeToOrderCount = useMemo(
    () => initialProducts.filter((p) => p.isMadeToOrder).length,
    [initialProducts]
  )
  const archivedCount = useMemo(
    () => initialProducts.filter((p) => p.archivedAt !== null).length,
    [initialProducts]
  )

  // Helper de alternância cumulativa de filtros (desmarca opostos diretos)
  const toggleFilterInList = (prev: string[], id: ProductFilterKey): string[] => {
    if (prev.includes(id)) {
      return prev.filter((item) => item !== id)
    }
    const next = [...prev, id]
    if (id === 'Pronta Entrega') {
      return next.filter((item) => item !== 'Sob Encomenda')
    }
    if (id === 'Sob Encomenda') {
      return next.filter((item) => item !== 'Pronta Entrega')
    }
    if (id === 'Ativos') {
      return next.filter((item) => item !== 'Arquivados')
    }
    if (id === 'Arquivados') {
      return next.filter((item) => item !== 'Ativos')
    }
    return next
  }

  const handleToggleFilter = (id: ProductFilterKey) => {
    setActiveFilters((prev) => toggleFilterInList(prev, id))
  }

  const handleToggleBulkFilter = (id: ProductFilterKey) => {
    setBulkActiveFilters((prev) => toggleFilterInList(prev, id))
  }

  // Função auxiliar reutilizável de filtragem (busca + interseção de filtros)
  const filterProductCollection = (
    list: SerializedAdminProduct[],
    filters: string[],
    query: string
  ) => {
    return list.filter((product) => {
      const matchesAllFilters = filters.every((filter) => {
        if (filter === 'Pronta Entrega') return !product.isMadeToOrder
        if (filter === 'Sob Encomenda') return product.isMadeToOrder
        if (filter === 'Ativos') return product.archivedAt === null
        if (filter === 'Arquivados') return product.archivedAt !== null
        return true
      })

      if (!matchesAllFilters) return false

      if (query.trim()) {
        const q = query.toLowerCase().trim()
        const matchTitle = product.title.toLowerCase().includes(q)
        const matchSlug = product.slug.toLowerCase().includes(q)
        const matchCategory = product.category.toLowerCase().includes(q)
        const matchId = product.id.toLowerCase().includes(q)
        if (!matchTitle && !matchSlug && !matchCategory && !matchId) {
          return false
        }
      }

      return true
    })
  }

  // Lista filtrada da tabela principal
  const filteredProducts = useMemo(
    () => filterProductCollection(initialProducts, activeFilters, searchQuery),
    [initialProducts, activeFilters, searchQuery]
  )

  // Lista filtrada do modal de Seleção Múltipla
  const bulkFilteredProducts = useMemo(
    () =>
      filterProductCollection(
        initialProducts,
        bulkActiveFilters,
        bulkSearchQuery
      ),
    [initialProducts, bulkActiveFilters, bulkSearchQuery]
  )

  // Selecionar / Desmarcar todos os produtos visíveis no modal de Seleção Múltipla
  const allBulkFilteredSelected =
    bulkFilteredProducts.length > 0 &&
    bulkFilteredProducts.every((p) => selectedProductIds.includes(p.id))

  const handleSelectAllBulk = () => {
    if (allBulkFilteredSelected) {
      const visibleSet = new Set(bulkFilteredProducts.map((p) => p.id))
      setSelectedProductIds((prev) => prev.filter((id) => !visibleSet.has(id)))
    } else {
      const merged = new Set([
        ...selectedProductIds,
        ...bulkFilteredProducts.map((p) => p.id),
      ])
      setSelectedProductIds(Array.from(merged))
    }
  }

  // Selecionar / Desmarcar produto individual no modal de Seleção Múltipla
  const handleSelectOneBulk = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  // Exportar produtos renderizados para CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Nome', 'Categoria', 'Preço', 'Estoque', 'Tipo']
    const escapeCsvField = (val: string | number) => {
      const str = String(val ?? '')
      if (str.includes(';') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const rows = filteredProducts.map((p) => {
      const available = Math.max(0, p.stock - (p.reservedStock ?? 0))
      const tipo = p.isMadeToOrder ? 'Sob Encomenda' : 'Pronta Entrega'
      return [
        escapeCsvField(p.id),
        escapeCsvField(p.title),
        escapeCsvField(p.category),
        escapeCsvField(p.price.toFixed(2)),
        escapeCsvField(available),
        escapeCsvField(tipo),
      ].join(';')
    })

    const csv = ['\uFEFF' + headers.join(';'), ...rows].join('\n')
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `catalogo_lumen3d_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Baixar planilha modelo de importação
  const handleDownloadTemplateCSV = () => {
    const sampleCsv =
      '\uFEFFNome;Slug;Categoria;Preço;Estoque;Tipo;PrazoProducaoDias;PesoGramas;Dimensoes;Descricao\n' +
      'Vaso Geométrico Hexagonal;vaso-geometrico-hexagonal;Decoração;89.90;10;Pronta Entrega;;250;12x12x20 cm;Vaso impresso em PLA premium com acabamento fosco.'
    const url = URL.createObjectURL(
      new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' })
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'modelo_importacao_lumen3d.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Arquivar produto individual
  const handleArchive = (id: string) => {
    setFeedbackMsg(null)
    startTransition(async () => {
      const res = await archiveProductAction(id)
      if (!res.success) {
        setFeedbackMsg({
          type: 'error',
          text: res.error || 'Erro ao arquivar produto.',
        })
      } else {
        router.refresh()
      }
    })
  }

  // Restaurar produto individual
  const handleRestore = (id: string) => {
    setFeedbackMsg(null)
    startTransition(async () => {
      const res = await restoreProductAction(id)
      if (!res.success) {
        setFeedbackMsg({
          type: 'error',
          text: res.error || 'Erro ao restaurar produto.',
        })
      } else {
        router.refresh()
      }
    })
  }

  // Excluir permanentemente produto individual com window.confirm
  const handlePermanentDelete = (product: SerializedAdminProduct) => {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir "${product.title}" permanentemente? Esta ação é irreversível e apagará o produto do catálogo.`
    )
    if (!confirmed) return

    setFeedbackMsg(null)
    startTransition(async () => {
      const res = await deleteProductAction(product.id)
      if (!res.success) {
        setFeedbackMsg({
          type: 'error',
          text:
            res.error ||
            'Não foi possível excluir este produto permanentemente.',
        })
      } else {
        setSelectedProductIds((prev) =>
          prev.filter((id) => id !== product.id)
        )
        setFeedbackMsg({
          type: 'success',
          text: `Produto "${product.title}" excluído permanentemente.`,
        })
        router.refresh()
      }
    })
  }

  // Arquivar em lote no Modal de Seleção Múltipla
  const handleBulkArchive = () => {
    if (selectedProductIds.length === 0) return
    const confirmed = window.confirm(
      `Deseja arquivar os ${selectedProductIds.length} produtos selecionados?`
    )
    if (!confirmed) return

    setFeedbackMsg(null)
    startTransition(async () => {
      const res = await bulkArchiveProductsAction(selectedProductIds)
      if (!res.success) {
        setFeedbackMsg({
          type: 'error',
          text: res.error || 'Falha ao arquivar produtos selecionados.',
        })
      } else {
        setFeedbackMsg({
          type: 'success',
          text: `${res.count ?? selectedProductIds.length} produtos arquivados com sucesso.`,
        })
        setSelectedProductIds([])
        setIsBulkModalOpen(false)
        router.refresh()
      }
    })
  }

  // Excluir permanentemente em lote no Modal de Seleção Múltipla
  const handleBulkDelete = () => {
    if (selectedProductIds.length === 0) return
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir permanentemente os ${selectedProductIds.length} produtos selecionados? Esta ação não pode ser desfeita.`
    )
    if (!confirmed) return

    setFeedbackMsg(null)
    startTransition(async () => {
      const res = await bulkDeleteProductsAction(selectedProductIds)
      if (!res.success) {
        setFeedbackMsg({
          type: 'error',
          text:
            res.error ||
            'Não foi possível excluir os produtos selecionados.',
        })
      } else {
        const extraNote =
          res.blockedCount && res.blockedCount > 0
            ? ` (${res.blockedCount} com histórico de vendas foram preservados — utilize Arquivar).`
            : ''
        setFeedbackMsg({
          type: 'success',
          text: `${res.deletedCount ?? 0} produtos excluídos permanentemente.${extraNote}`,
        })
        setSelectedProductIds([])
        setIsBulkModalOpen(false)
        router.refresh()
      }
    })
  }

  // Dados comuns para <AdminMetricsAndFilterBar> (tela principal e modal em lote)
  const sharedMetrics = [
    {
      id: 'total',
      label: 'Total Cadastrados',
      value: totalCount,
      valueColorClass: 'text-slate-100',
      icon: <Package className="w-5 h-5 text-slate-400" />,
    },
    {
      id: 'active',
      label: 'Ativos na Vitrine',
      value: activeCount,
      valueColorClass: 'text-cyan-400',
      icon: <CheckCircle2 className="w-5 h-5 text-cyan-400" />,
    },
    {
      id: 'made_to_order',
      label: 'Sob Encomenda',
      value: madeToOrderCount,
      valueColorClass: 'text-amber-400',
      icon: <Clock className="w-5 h-5 text-amber-400" />,
    },
    {
      id: 'archived',
      label: 'Arquivados',
      value: archivedCount,
      valueColorClass: 'text-slate-400',
      icon: <Archive className="w-5 h-5 text-slate-500" />,
    },
  ]

  const sharedFilterTabs = [
    {
      id: 'Pronta Entrega' as ProductFilterKey,
      label: 'Pronta Entrega',
      count: readyStockCount,
      icon: <Package className="w-3.5 h-3.5 text-emerald-400" />,
      activeColorClass:
        'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 shadow-sm',
    },
    {
      id: 'Sob Encomenda' as ProductFilterKey,
      label: 'Sob Encomenda',
      count: madeToOrderCount,
      icon: <Clock className="w-3.5 h-3.5 text-amber-400" />,
      activeColorClass:
        'bg-amber-950/50 border-amber-500/40 text-amber-300 shadow-sm',
    },
    {
      id: 'Ativos' as ProductFilterKey,
      label: 'Ativos',
      count: activeCount,
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />,
      activeColorClass:
        'bg-cyan-950/50 border-cyan-500/40 text-cyan-300 shadow-sm',
    },
    {
      id: 'Arquivados' as ProductFilterKey,
      label: 'Arquivados',
      count: archivedCount,
      icon: <Archive className="w-3.5 h-3.5 text-slate-400" />,
      activeColorClass:
        'bg-slate-800/80 border-slate-600/50 text-slate-200 shadow-sm',
    },
  ]

  return (
    <div className="space-y-4">
      {/* 1. BARRA DE AÇÕES SUPERIOR: Seleção Múltipla à ESQUERDA | Importar, Exportar e Cadastrar à DIREITA */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        {/* Extremidade esquerda: Botão de Seleção Múltipla */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400 font-medium">Seleção Múltipla:</span>
          <button
          type="button"
          onClick={() => {
            setBulkSearchQuery(searchQuery)
            setBulkActiveFilters(activeFilters)
            setIsBulkModalOpen(true)
          }}
          className="gap-2 px-4 py-2 rounded-xl bg-[#0a0e1a] hover:bg-white/5 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white font-semibold text-xs transition cursor-pointer"
        >
          <CheckSquare className="w-4 h-4 text-cyan-400" />
          </button>
        </div>

        {/* Extremidade direita: Importar, Exportar e Cadastrar */}
        <div className="flex flex-wrap justify-end items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedImportFile(null)
              setIsImportModalOpen(true)
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-transparent hover:bg-white/5 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white font-semibold text-xs transition cursor-pointer"
          >
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>Importar Produto</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0a0e1a] hover:bg-white/5 border border-gray-800 hover:border-gray-700 text-gray-200 hover:text-white font-semibold text-xs transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Exportar Dados</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-[#050811] font-bold text-xs transition shadow-lg shadow-cyan-500/10 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Cadastrar Produto</span>
          </button>
        </div>
      </div>

      {/* ALERTA DE FEEDBACK (SUCESSO / ERRO) */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 ${
            feedbackMsg.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-gray-400 hover:text-white transition cursor-pointer"
            aria-label="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* BARRA DE MÉTRICAS E FILTROS CUMULATIVOS MULTI-SELECT */}
      <AdminMetricsAndFilterBar<ProductFilterKey>
        metrics={sharedMetrics}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Buscar por nome, slug, categoria ou ID..."
        isMultiSelect={true}
        activeFilters={activeFilters}
        onFilterChange={handleToggleFilter}
        filters={sharedFilterTabs}
        rightSlot={
          activeFilters.length > 0 ? (
            <button
              type="button"
              onClick={() => setActiveFilters([])}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
            >
              Limpar filtros ({activeFilters.length})
            </button>
          ) : null
        }
      />

      {/* TABELA DE GERENCIAMENTO DE PRODUTOS (PIM) */}
      <div className="rounded-2xl border border-gray-800/80 bg-[#0a0e1a] shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800/80 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-100">
              Produtos no Inventário ({filteredProducts.length})
            </h2>
            <p className="text-xs text-gray-400">
              Gerencie preços, prazos sob encomenda, saldos, arquivamento e exclusão permanente
            </p>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="p-10 text-center text-gray-400 space-y-2">
            <Package className="w-8 h-8 text-gray-500 mx-auto" />
            <p className="text-xs font-semibold text-gray-300">
              Nenhum produto encontrado para os filtros selecionados.
            </p>
            <p className="text-[11px] text-gray-500">
              Ajuste os filtros cumulativos acima ou cadastre um novo produto.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead>
                <tr className="border-b border-gray-800/80 bg-[#050811]/60 text-[10px] font-mono uppercase tracking-wider text-gray-400">
                  <th className="py-3.5 px-4">Item</th>
                  <th className="py-3.5 px-4">Preço</th>
                  <th className="py-3.5 px-4">Tipo / Estoque</th>
                  <th className="py-3.5 px-4">Categoria</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filteredProducts.map((product) => {
                  const isArchived = product.archivedAt !== null
                  const availableStock = Math.max(
                    0,
                    product.stock - (product.reservedStock ?? 0)
                  )

                  return (
                    <tr
                      key={product.id}
                      className={`hover:bg-slate-900/40 transition ${
                        isArchived ? 'opacity-65' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {product.images?.[0] ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={product.images[0]}
                              alt={product.title}
                              className="w-10 h-10 rounded-xl object-cover border border-gray-800 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-[#050811] border border-gray-800 flex items-center justify-center text-gray-600 shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <span className="font-semibold text-slate-100 block">
                              {product.title}
                            </span>
                            <span className="text-[10px] font-mono text-gray-500">
                              /{product.slug}
                            </span>
                            {isArchived && (
                              <span className="inline-block ml-2 px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-slate-300 border border-slate-700">
                                Arquivado
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-100">
                        {formatCurrency(product.price)}
                      </td>

                      <td className="py-3.5 px-4">
                        {product.isMadeToOrder ? (
                          <div className="space-y-0.5">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              <span>Sob Encomenda</span>
                            </span>
                            <span className="text-[10px] text-gray-500 block">
                              Preparo:{' '}
                              {product.productionDays
                                ? `${product.productionDays} dias`
                                : 'Sob demanda'}
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border inline-block ${
                                availableStock > 0
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              }`}
                            >
                              {availableStock} un disponível
                            </span>
                            {product.reservedStock > 0 && (
                              <span className="text-[10px] text-amber-400/80 block font-mono">
                                ({product.reservedStock} reservada
                                {product.reservedStock > 1 ? 's' : ''})
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-gray-300">{product.category}</td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-2">
                          {!isArchived && (
                            <Link
                              href={`/marketplace/${product.slug}`}
                              target="_blank"
                              className="bg-[#050811] hover:bg-gray-900 border border-gray-800 text-gray-300 p-1.5 rounded-lg text-xs transition"
                              title="Visualizar na loja pública"
                              aria-label={`Visualizar ${product.title} na loja pública`}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          )}

                          <Link
                            href={`/admin/products/${product.id}/edit`}
                            className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-3 py-1 rounded-lg text-xs font-semibold transition"
                          >
                            Editar
                          </Link>

                          {isArchived ? (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleRestore(product.id)}
                              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Restaurar</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleArchive(product.id)}
                              className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <Archive className="w-3 h-3" />
                              <span>Arquivar</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handlePermanentDelete(product)}
                            title="Excluir produto permanentemente"
                            aria-label={`Excluir ${product.title} permanentemente`}
                            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Excluir</span>
                          </button>
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

      {/* 2. MODAL / OVERLAY DE SELEÇÃO EM LOTE (BULK ACTIONS) */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div
            onClick={() => setIsBulkModalOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            aria-hidden="true"
          />

          <div className="relative w-full max-w-6xl bg-[#050811] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] z-10">
            {/* Cabeçalho do Modal de Seleção em Lote */}
            <div className="px-6 py-4 border-b border-gray-800/80 flex items-center justify-between bg-[#0a0e1a] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-100">
                    Seleção Múltipla em Lote
                  </h2>
                  <p className="text-[11px] text-gray-400">
                    Filtre o inventário abaixo e marque os produtos que deseja arquivar ou excluir de uma só vez
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition cursor-pointer"
                aria-label="Fechar modal de seleção em lote"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corpo do Modal com <AdminMetricsAndFilterBar> e Tabela Simplificada */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <AdminMetricsAndFilterBar<ProductFilterKey>
                metrics={sharedMetrics}
                searchQuery={bulkSearchQuery}
                onSearchChange={setBulkSearchQuery}
                searchPlaceholder="Filtrar produtos antes de selecionar..."
                isMultiSelect={true}
                activeFilters={bulkActiveFilters}
                onFilterChange={handleToggleBulkFilter}
                filters={sharedFilterTabs}
                rightSlot={
                  bulkActiveFilters.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setBulkActiveFilters([])}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
                    >
                      Limpar filtros ({bulkActiveFilters.length})
                    </button>
                  ) : null
                }
              />

              <div className="rounded-2xl border border-gray-800/80 bg-[#0a0e1a] overflow-hidden">
                {bulkFilteredProducts.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-xs">
                    Nenhum produto encontrado com os filtros atuais.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[42vh]">
                    <table className="w-full text-left text-xs text-slate-300 border-collapse">
                      <thead className="sticky top-0 z-10 bg-[#050811] border-b border-gray-800/80 text-[10px] font-mono uppercase tracking-wider text-gray-400">
                        <tr>
                          <th className="py-3 pl-4 pr-2 w-10">
                            <input
                              type="checkbox"
                              checked={allBulkFilteredSelected}
                              onChange={handleSelectAllBulk}
                              aria-label="Selecionar Todos"
                              title="Selecionar Todos"
                              className="w-4 h-4 rounded bg-[#050811] border-gray-700 text-cyan-500 focus:ring-0 cursor-pointer"
                            />
                          </th>
                          <th className="py-3 px-4">Produto</th>
                          <th className="py-3 px-4">SKU / Slug</th>
                          <th className="py-3 px-4">Categoria</th>
                          <th className="py-3 px-4">Tipo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {bulkFilteredProducts.map((product) => {
                          const isSelected = selectedProductIds.includes(
                            product.id
                          )
                          const isArchived = product.archivedAt !== null

                          return (
                            <tr
                              key={product.id}
                              onClick={() => handleSelectOneBulk(product.id)}
                              className={`cursor-pointer transition ${
                                isSelected
                                  ? 'bg-cyan-950/30 hover:bg-cyan-950/40'
                                  : 'hover:bg-slate-900/40'
                              } ${isArchived ? 'opacity-65' : ''}`}
                            >
                              <td
                                className="py-3 pl-4 pr-2 w-10"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    handleSelectOneBulk(product.id)
                                  }
                                  aria-label={`Selecionar ${product.title}`}
                                  className="w-4 h-4 rounded bg-[#050811] border-gray-700 text-cyan-500 focus:ring-0 cursor-pointer"
                                />
                              </td>

                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  {product.images?.[0] ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                      src={product.images[0]}
                                      alt={product.title}
                                      className="w-9 h-9 rounded-xl object-cover border border-gray-800 shrink-0"
                                    />
                                  ) : (
                                    <div className="w-9 h-9 rounded-xl bg-[#050811] border border-gray-800 flex items-center justify-center text-gray-600 shrink-0">
                                      <Package className="w-4 h-4" />
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-100">
                                      {product.title}
                                    </span>
                                    {isArchived && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-slate-300 border border-slate-700">
                                        Arquivado
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-4 font-mono text-gray-400">
                                /{product.slug}
                              </td>

                              <td className="py-3 px-4 text-gray-300">
                                {product.category}
                              </td>

                              <td className="py-3 px-4">
                                {product.isMadeToOrder ? (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>Sob Encomenda</span>
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                                    <Package className="w-2.5 h-2.5" />
                                    <span>Pronta Entrega</span>
                                  </span>
                                )}
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

            {/* 3. BARRA DE AÇÕES EM LOTE (BULK ACTIONS BAR) NO RODAPÉ DO MODAL */}
            {selectedProductIds.length > 0 && (
              <div className="px-6 py-4 bg-[#0a0e1a] border-t border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-2xl">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold text-xs">
                    {selectedProductIds.length}{' '}
                    {selectedProductIds.length === 1
                      ? 'produto selecionado'
                      : 'produtos selecionados'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedProductIds([])}
                    className="text-xs text-gray-400 hover:text-white underline underline-offset-4 transition cursor-pointer"
                  >
                    Desmarcar todos
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleBulkArchive}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    <Archive className="w-3.5 h-3.5 text-amber-400" />
                    <span>Arquivar Selecionados</span>
                  </button>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleBulkDelete}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Excluir Selecionados</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO DE PRODUTO */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div
            onClick={() => setIsCreateModalOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            aria-hidden="true"
          />

          <div className="relative w-full max-w-4xl bg-[#050811] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] z-10">
            <div className="px-6 py-4 border-b border-gray-800/80 flex items-center justify-between bg-[#0a0e1a] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-100">
                    Cadastrar Novo Produto
                  </h2>
                  <p className="text-[11px] text-gray-400">
                    Adicione uma nova peça 3D ao catálogo da Lúmen
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition cursor-pointer"
                aria-label="Fechar modal de cadastro"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <Product_Form
                action={createProductAction}
                submitLabel="Cadastrar Produto no Catálogo"
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE IMPORTAÇÃO DE PRODUTOS (CSV / XLSX) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div
            onClick={() => setIsImportModalOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            aria-hidden="true"
          />

          <div className="relative w-full max-w-lg bg-[#0a0e1a] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden z-10">
            <div className="px-6 py-4 border-b border-gray-800/80 flex items-center justify-between bg-[#050811]/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-100">
                    Importar Produtos em Lote
                  </h2>
                  <p className="text-[11px] text-gray-400">
                    Envie uma planilha CSV ou Excel (.xlsx) padronizada
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition cursor-pointer"
                aria-label="Fechar modal de importação"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="p-4 rounded-xl bg-[#050811]/60 border border-gray-800/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-gray-200">
                      Planilha Modelo da Lúmen 3D
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Contém todas as colunas necessárias e uma linha de exemplo.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadTemplateCSV}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold whitespace-nowrap transition cursor-pointer"
                >
                  Baixar planilha modelo
                </button>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="csv-upload-input"
                  className="block text-xs font-medium text-gray-400"
                >
                  Arquivo de Importação (.csv, .xlsx)
                </label>
                <input
                  id="csv-upload-input"
                  type="file"
                  accept=".csv, .xlsx"
                  onChange={(e) =>
                    setSelectedImportFile(e.target.files?.[0] ?? null)
                  }
                  className="block w-full bg-[#050811]/60 border border-dashed border-gray-800 hover:border-cyan-800/70 rounded-xl p-3 text-xs text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500/15 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-cyan-300 hover:file:bg-cyan-500/25 cursor-pointer"
                />
                {selectedImportFile && (
                  <p className="text-[11px] text-cyan-400 font-mono">
                    Selecionado: {selectedImportFile.name} (
                    {(selectedImportFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800/80">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-transparent hover:bg-white/5 border border-gray-800 text-gray-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!selectedImportFile}
                  onClick={() => {
                    setIsImportModalOpen(false)
                    setFeedbackMsg({
                      type: 'success',
                      text: `Arquivo "${selectedImportFile?.name}" recebido e pronto para processamento.`,
                    })
                  }}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-[#050811] font-bold text-xs transition cursor-pointer disabled:cursor-not-allowed"
                >
                  Confirmar Arquivo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
