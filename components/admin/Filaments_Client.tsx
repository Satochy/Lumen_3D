'use client'

import React, { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CircleDot,
  Plus,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  Scale,
  Disc,
  Trash2,
  Save,
  X,
  FileSpreadsheet,
  CheckSquare,
} from 'lucide-react'
import { AdminMetricsAndFilterBar } from '@/components/admin/Admin_Metrics_And_Filter_Bar'
import {
  createFilamentAction,
  updateFilamentWeight,
  deleteFilamentAction,
} from '@/app/actions/filaments'

export interface SerializedFilament {
  id: string
  material: string
  color: string
  hexColor: string | null
  spoolWeightKg: number
  remainingGrams: number
  minThresholdGrams: number
  createdAt: string
}

interface FilamentsClientProps {
  initialFilaments: SerializedFilament[]
}

type FilamentFilterKey = 'PLA' | 'ABS' | 'PETG' | 'LOW_STOCK'

const inputCls =
  'w-full bg-[#050811]/60 border border-gray-800/80 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-800/70 transition-colors'
const labelCls = 'block text-xs font-medium text-gray-400 mb-1.5'

export default function Filaments_Client({
  initialFilaments,
}: FilamentsClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Estados de busca e filtros cumulativos da tela principal
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [materialFilter, setMaterialFilter] = useState<string>('ALL')

  // Estados do Modal de Seleção Múltipla em Lote (Bulk Actions)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [bulkSearchQuery, setBulkSearchQuery] = useState('')
  const [bulkActiveFilters, setBulkActiveFilters] = useState<string[]>([])
  const [bulkMaterialFilter, setBulkMaterialFilter] = useState<string>('ALL')
  const [selectedFilamentIds, setSelectedFilamentIds] = useState<string[]>([])

  // Estados dos Modais de Nova Bobina e Importação de Dados
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null)
  const [hexPreview, setHexPreview] = useState('#22d3ee')

  // Estados de edição rápida de peso (gramas) por linha
  const [weightInputs, setWeightInputs] = useState<Record<string, string>>({})

  // Feedback visual
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  // Métricas para os 4 Cards
  const totalSpools = initialFilaments.length
  const totalWeightKg = useMemo(
    () =>
      (
        initialFilaments.reduce((acc, f) => acc + f.remainingGrams, 0) / 1000
      ).toFixed(2),
    [initialFilaments]
  )
  const lowStockCount = useMemo(
    () =>
      initialFilaments.filter((f) => f.remainingGrams <= f.minThresholdGrams)
        .length,
    [initialFilaments]
  )
  const normalStockCount = useMemo(
    () =>
      initialFilaments.filter((f) => f.remainingGrams > f.minThresholdGrams)
        .length,
    [initialFilaments]
  )
  const plaCount = useMemo(
    () =>
      initialFilaments.filter((f) => f.material.toUpperCase() === 'PLA').length,
    [initialFilaments]
  )
  const petgCount = useMemo(
    () =>
      initialFilaments.filter((f) => f.material.toUpperCase() === 'PETG')
        .length,
    [initialFilaments]
  )
  const absCount = useMemo(
    () =>
      initialFilaments.filter((f) => f.material.toUpperCase() === 'ABS').length,
    [initialFilaments]
  )

  // Materiais únicos para o rightSlot opcional
  const uniqueMaterials = useMemo(() => {
    const set = new Set(initialFilaments.map((f) => f.material.toUpperCase()))
    return Array.from(set)
  }, [initialFilaments])

  // Alternância cumulativa de filtros (permite combinar ex: PLA + Baixo Estoque)
  const toggleFilterInList = (
    prev: string[],
    id: FilamentFilterKey
  ): string[] => {
    if (prev.includes(id)) {
      return prev.filter((item) => item !== id)
    }
    return [...prev, id]
  }

  const handleToggleFilter = (id: FilamentFilterKey) => {
    setActiveFilters((prev) => toggleFilterInList(prev, id))
  }

  const handleToggleBulkFilter = (id: FilamentFilterKey) => {
    setBulkActiveFilters((prev) => toggleFilterInList(prev, id))
  }

  // Função auxiliar reutilizável de filtragem (tela principal e modal em lote)
  const filterFilamentCollection = (
    list: SerializedFilament[],
    filters: string[],
    matSelect: string,
    query: string
  ) => {
    const selectedMaterialTabs = filters.filter((f) =>
      ['PLA', 'ABS', 'PETG'].includes(f)
    )
    const requireLowStock = filters.includes('LOW_STOCK')

    return list.filter((item) => {
      const isLow = item.remainingGrams <= item.minThresholdGrams
      const matUpper = item.material.toUpperCase()

      if (
        selectedMaterialTabs.length > 0 &&
        !selectedMaterialTabs.includes(matUpper)
      ) {
        return false
      }

      if (requireLowStock && !isLow) {
        return false
      }

      if (matSelect !== 'ALL' && matUpper !== matSelect) {
        return false
      }

      if (query.trim()) {
        const q = query.toLowerCase().trim()
        const matchColor = item.color.toLowerCase().includes(q)
        const matchMaterial = item.material.toLowerCase().includes(q)
        const matchHex = item.hexColor?.toLowerCase().includes(q)
        const matchId = item.id.toLowerCase().includes(q)
        if (!matchColor && !matchMaterial && !matchHex && !matchId) return false
      }

      return true
    })
  }

  // Filtragem combinada da tabela principal
  const filteredFilaments = useMemo(
    () =>
      filterFilamentCollection(
        initialFilaments,
        activeFilters,
        materialFilter,
        searchQuery
      ),
    [initialFilaments, activeFilters, materialFilter, searchQuery]
  )

  // Filtragem combinada do modal de Seleção Múltipla
  const bulkFilteredFilaments = useMemo(
    () =>
      filterFilamentCollection(
        initialFilaments,
        bulkActiveFilters,
        bulkMaterialFilter,
        bulkSearchQuery
      ),
    [initialFilaments, bulkActiveFilters, bulkMaterialFilter, bulkSearchQuery]
  )

  // Selecionar / Desmarcar todos os filamentos visíveis no modal de Seleção Múltipla
  const allBulkFilteredSelected =
    bulkFilteredFilaments.length > 0 &&
    bulkFilteredFilaments.every((f) => selectedFilamentIds.includes(f.id))

  const handleSelectAllBulk = () => {
    if (allBulkFilteredSelected) {
      const visibleSet = new Set(bulkFilteredFilaments.map((f) => f.id))
      setSelectedFilamentIds((prev) => prev.filter((id) => !visibleSet.has(id)))
    } else {
      const merged = new Set([
        ...selectedFilamentIds,
        ...bulkFilteredFilaments.map((f) => f.id),
      ])
      setSelectedFilamentIds(Array.from(merged))
    }
  }

  // Selecionar / Desmarcar filamento individual no modal de Seleção Múltipla
  const handleSelectOneBulk = (id: string) => {
    setSelectedFilamentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  // Exportar filamentos filtrados para CSV
  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Cor',
      'Material',
      'HEX',
      'SaldoRestanteGramas',
      'AlertaMinimoGramas',
    ]
    const escapeCsvField = (val: string | number) => {
      const str = String(val ?? '')
      if (str.includes(';') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const rows = filteredFilaments.map((f) =>
      [
        escapeCsvField(f.id),
        escapeCsvField(f.color),
        escapeCsvField(f.material),
        escapeCsvField(f.hexColor || ''),
        escapeCsvField(f.remainingGrams),
        escapeCsvField(f.minThresholdGrams),
      ].join(';')
    )

    const csv = ['\uFEFF' + headers.join(';'), ...rows].join('\n')
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `filamentos_lumen3d_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Baixar planilha modelo de importação de filamentos
  const handleDownloadTemplateCSV = () => {
    const sampleCsv =
      '\uFEFFMaterial;Cor;HEX;PesoAtualGramas;AlertaMinimoGramas\n' +
      'PLA;Preto Fosco;#111827;1000;200'
    const url = URL.createObjectURL(
      new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' })
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'modelo_filamentos_lumen3d.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Submissão do formulário de nova bobina
  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setFeedbackMsg(null)

    startTransition(async () => {
      const res = await createFilamentAction(formData)
      if (!res.success) {
        setFeedbackMsg({
          type: 'error',
          text: res.error || 'Não foi possível cadastrar a bobina.',
        })
      } else {
        setIsCreateModalOpen(false)
        setFeedbackMsg({
          type: 'success',
          text: 'Nova bobina adicionada ao estoque com sucesso.',
        })
        router.refresh()
      }
    })
  }

  // Atualizar peso restante de uma bobina
  const handleUpdateWeight = (item: SerializedFilament) => {
    const rawVal = weightInputs[item.id]
    const parsedVal =
      rawVal !== undefined ? parseFloat(rawVal) : item.remainingGrams

    if (Number.isNaN(parsedVal) || parsedVal < 0) {
      setFeedbackMsg({
        type: 'error',
        text: 'Informe um peso válido em gramas (mínimo 0g).',
      })
      return
    }

    setFeedbackMsg(null)
    startTransition(async () => {
      const res = await updateFilamentWeight(item.id, parsedVal)
      if (!res.success) {
        setFeedbackMsg({
          type: 'error',
          text: res.error || 'Erro ao atualizar o peso do carretel.',
        })
      } else {
        setFeedbackMsg({
          type: 'success',
          text: `Peso de "${item.material} ${item.color}" atualizado para ${parsedVal}g.`,
        })
        router.refresh()
      }
    })
  }

  // Excluir bobina individual
  const handleDeleteFilament = (item: SerializedFilament) => {
    const confirmed = window.confirm(
      `Tem certeza que deseja remover o carretel "${item.material} - ${item.color}" do estoque?`
    )
    if (!confirmed) return

    setFeedbackMsg(null)
    startTransition(async () => {
      const res = await deleteFilamentAction(item.id)
      if (!res.success) {
        setFeedbackMsg({
          type: 'error',
          text: res.error || 'Erro ao remover carretel.',
        })
      } else {
        setSelectedFilamentIds((prev) => prev.filter((id) => id !== item.id))
        setFeedbackMsg({
          type: 'success',
          text: `Carretel "${item.material} - ${item.color}" removido.`,
        })
        router.refresh()
      }
    })
  }

  // Excluir bobinas selecionadas em lote (com window.confirm)
  const handleBulkDelete = () => {
    if (selectedFilamentIds.length === 0) return
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir permanentemente os ${selectedFilamentIds.length} filamentos selecionados? Esta ação não pode ser desfeita.`
    )
    if (!confirmed) return

    setFeedbackMsg(null)
    startTransition(async () => {
      const results = await Promise.all(
        selectedFilamentIds.map((id) => deleteFilamentAction(id))
      )
      const failedCount = results.filter((r) => !r.success).length
      const deletedCount = results.length - failedCount

      if (deletedCount === 0) {
        setFeedbackMsg({
          type: 'error',
          text: 'Não foi possível excluir os filamentos selecionados.',
        })
      } else {
        setFeedbackMsg({
          type: 'success',
          text: `${deletedCount} ${
            deletedCount === 1
              ? 'filamento excluído'
              : 'filamentos excluídos'
          } com sucesso.`,
        })
        setSelectedFilamentIds([])
        setIsBulkModalOpen(false)
        router.refresh()
      }
    })
  }

  // Métricas e abas compartilhadas entre a tela principal e o modal de seleção em lote
  const sharedMetrics = [
    {
      id: 'total_spools',
      label: 'Total de Filamentos',
      value: totalSpools,
      valueColorClass: 'text-slate-100',
      icon: <Disc className="w-5 h-5 text-slate-400" />,
    },
    {
      id: 'normal_stock',
      label: 'Em Estoque',
      value: normalStockCount,
      valueColorClass: 'text-emerald-400',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
    },
    {
      id: 'low_stock',
      label: 'Baixo Estoque',
      value: lowStockCount,
      valueColorClass:
        lowStockCount > 0 ? 'text-rose-400' : 'text-emerald-400',
      icon: (
        <AlertTriangle
          className={`w-5 h-5 ${
            lowStockCount > 0 ? 'text-rose-400' : 'text-emerald-400'
          }`}
        />
      ),
      showPulseDot: lowStockCount > 0,
      dotColorClass: 'bg-rose-500',
    },
    {
      id: 'total_weight',
      label: 'Massa Total Disponível',
      value: `${totalWeightKg} kg`,
      valueColorClass: 'text-cyan-400',
      icon: <Scale className="w-5 h-5 text-cyan-400" />,
    },
  ]

  const sharedFilterTabs = [
    {
      id: 'PLA' as FilamentFilterKey,
      label: 'PLA',
      count: plaCount,
      icon: <Disc className="w-3.5 h-3.5 text-sky-400" />,
      activeColorClass:
        'bg-sky-950/50 border-sky-500/40 text-sky-300 shadow-sm',
    },
    {
      id: 'ABS' as FilamentFilterKey,
      label: 'ABS',
      count: absCount,
      icon: <Disc className="w-3.5 h-3.5 text-purple-400" />,
      activeColorClass:
        'bg-purple-950/50 border-purple-500/40 text-purple-300 shadow-sm',
    },
    {
      id: 'PETG' as FilamentFilterKey,
      label: 'PETG',
      count: petgCount,
      icon: <Disc className="w-3.5 h-3.5 text-amber-400" />,
      activeColorClass:
        'bg-amber-950/50 border-amber-500/40 text-amber-300 shadow-sm',
    },
    {
      id: 'LOW_STOCK' as FilamentFilterKey,
      label: 'Baixo Estoque',
      count: lowStockCount,
      icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />,
      activeColorClass:
        'bg-rose-950/50 border-rose-500/40 text-rose-300 shadow-sm',
    },
  ]

  return (
    <div className="space-y-4">
      {/* 1. BARRA DE AÇÕES SUPERIOR: Seleção Múltipla à ESQUERDA | Importar, Exportar e Cadastrar à DIREITA */}
      <div className="flex justify-between items-center w-full mb-4 flex-wrap gap-3">
        {/* Lado ESQUERDO: Botão de Seleção Múltipla */}
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
        
        {/* Lado DIREITO: Importar Dados, Exportar Dados e Cadastrar Filamento */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setSelectedImportFile(null)
              setIsImportModalOpen(true)
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-transparent hover:bg-white/5 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white font-semibold text-xs transition cursor-pointer"
          >
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>Importar Dados</span>
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
            <span>Cadastrar Filamento</span>
          </button>
        </div>
      </div>

      {/* ALERTA DE FEEDBACK */}
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
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
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

      {/* 2. MÉTRICAS (4 CARDS) E BARRA UNIFICADA DE BUSCA E FILTROS MULTI-SELECT */}
      <AdminMetricsAndFilterBar<FilamentFilterKey>
        metrics={sharedMetrics}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Buscar por cor, material (PLA, ABS, PETG) ou código HEX..."
        isMultiSelect={true}
        activeFilters={activeFilters}
        onFilterChange={handleToggleFilter}
        filters={sharedFilterTabs}
        rightSlot={
          <div className="flex items-center gap-2">
            {activeFilters.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveFilters([])}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
              >
                Limpar filtros ({activeFilters.length})
              </button>
            )}
            {uniqueMaterials.length > 0 && (
              <select
                value={materialFilter}
                onChange={(e) => setMaterialFilter(e.target.value)}
                aria-label="Filtrar por material"
                className="px-3 py-2 bg-[#050811]/60 border border-gray-800/80 rounded-xl text-xs font-semibold text-gray-200 focus:outline-none focus:border-cyan-800/70 cursor-pointer"
              >
                <option value="ALL">Todos Materiais</option>
                {uniqueMaterials.map((mat) => (
                  <option key={mat} value={mat}>
                    {mat}
                  </option>
                ))}
              </select>
            )}
          </div>
        }
      />

      {/* 3. TABELA DE BOBINAS CADASTRADAS */}
      <div className="bg-[#0a0e1a] border border-gray-800/80 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-800/80 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-100">
              Bobinas Cadastradas ({filteredFilaments.length})
            </h2>
            <p className="text-xs text-gray-400">
              Controle de consumo, pesagem rápida em gramas e alertas de reposição por carretel
            </p>
          </div>
        </div>

        {filteredFilaments.length === 0 ? (
          <div className="p-10 text-center text-gray-400 space-y-2">
            <Disc className="w-8 h-8 text-gray-500 mx-auto" />
            <p className="text-xs font-semibold text-gray-300">
              Nenhuma bobina encontrada nesta visualização.
            </p>
            <p className="text-[11px] text-gray-500">
              Alterne os filtros acima ou clique em &quot;Cadastrar Filamento&quot; para registrar um novo carretel.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead>
                <tr className="border-b border-gray-800/80 bg-[#050811]/60 text-[10px] font-mono uppercase tracking-wider text-gray-400">
                  <th className="py-3.5 px-4">Cor & Identificação</th>
                  <th className="py-3.5 px-4">Material</th>
                  <th className="py-3.5 px-4">Saldo Restante</th>
                  <th className="py-3.5 px-4">Ajuste de Pesagem (g)</th>
                  <th className="py-3.5 px-4">Status do Carretel</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filteredFilaments.map((item) => {
                  const isLow = item.remainingGrams <= item.minThresholdGrams
                  const totalSpoolGrams = Math.max(
                    1,
                    (item.spoolWeightKg || 1) * 1000
                  )
                  const percentage = Math.min(
                    100,
                    Math.max(
                      0,
                      Math.round((item.remainingGrams / totalSpoolGrams) * 100)
                    )
                  )
                  const currentInputVal =
                    weightInputs[item.id] ?? String(item.remainingGrams)

                  return (
                    <tr
                      key={item.id}
                      className={`transition ${
                        isLow
                          ? 'bg-rose-950/15 hover:bg-rose-950/25'
                          : 'hover:bg-slate-900/40'
                      }`}
                    >
                      {/* 1. Cor & Identificação */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {item.hexColor ? (
                            <span
                              className="w-6 h-6 rounded-lg border border-gray-700 shrink-0 shadow-inner"
                              style={{ backgroundColor: item.hexColor }}
                              title={item.hexColor}
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-lg bg-[#050811] border border-gray-800 flex items-center justify-center shrink-0">
                              <CircleDot className="w-3.5 h-3.5 text-gray-500" />
                            </div>
                          )}
                          <div>
                            <span className="font-semibold text-slate-100 block">
                              {item.color}
                            </span>
                            <span className="text-[10px] font-mono text-gray-500">
                              {item.hexColor || 'Sem HEX'} &bull; Alerta &le;{' '}
                              {item.minThresholdGrams}g
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Material */}
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-[#050811] text-cyan-300 border border-gray-800">
                          {item.material}
                        </span>
                      </td>

                      {/* 3. Saldo Restante & Barra de Progresso */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1.5 min-w-[140px]">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="font-bold text-slate-100">
                              {item.remainingGrams}g
                            </span>
                            <span className="text-gray-500">{percentage}%</span>
                          </div>
                          <div className="w-full bg-[#050811] rounded-full h-1.5 overflow-hidden border border-gray-800">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isLow ? 'bg-rose-500' : 'bg-cyan-400'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* 4. Ajuste de Pesagem inline */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 max-w-[160px]">
                          <input
                            type="number"
                            min="0"
                            value={currentInputVal}
                            onChange={(e) =>
                              setWeightInputs((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            aria-label={`Peso restante em gramas de ${item.color}`}
                            className="w-24 bg-[#050811]/60 border border-gray-800/80 rounded-lg px-2.5 py-1 text-xs font-mono text-gray-200 focus:outline-none focus:border-cyan-800/70"
                          />
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleUpdateWeight(item)}
                            title="Salvar novo peso"
                            className="p-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 transition cursor-pointer disabled:opacity-50"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* 5. Status do Carretel */}
                      <td className="py-3.5 px-4">
                        {isLow ? (
                          <span className="px-2.5 py-1 text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>
                              Abaixo do Mínimo ({item.minThresholdGrams}g)
                            </span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Em Estoque</span>
                          </span>
                        )}
                      </td>

                      {/* 6. Ações */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDeleteFilament(item)}
                          title="Excluir bobina"
                          aria-label={`Excluir bobina ${item.material} ${item.color}`}
                          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Excluir</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. MODAL / OVERLAY DE SELEÇÃO EM LOTE (BULK ACTIONS) */}
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
                    Filtre o estoque de filamentos abaixo e marque as bobinas que deseja excluir de uma só vez
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

            {/* Corpo do Modal com <AdminMetricsAndFilterBar> e Tabela de Seleção */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <AdminMetricsAndFilterBar<FilamentFilterKey>
                metrics={sharedMetrics}
                searchQuery={bulkSearchQuery}
                onSearchChange={setBulkSearchQuery}
                searchPlaceholder="Filtrar filamentos antes de selecionar..."
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
                {bulkFilteredFilaments.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-xs">
                    Nenhum filamento encontrado com os filtros atuais.
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
                          <th className="py-3 px-4">Cor</th>
                          <th className="py-3 px-4">Material</th>
                          <th className="py-3 px-4">Saldo Restante</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {bulkFilteredFilaments.map((item) => {
                          const isSelected = selectedFilamentIds.includes(
                            item.id
                          )
                          const isLow =
                            item.remainingGrams <= item.minThresholdGrams
                          const totalSpoolGrams = Math.max(
                            1,
                            (item.spoolWeightKg || 1) * 1000
                          )
                          const percentage = Math.min(
                            100,
                            Math.max(
                              0,
                              Math.round(
                                (item.remainingGrams / totalSpoolGrams) * 100
                              )
                            )
                          )

                          return (
                            <tr
                              key={item.id}
                              onClick={() => handleSelectOneBulk(item.id)}
                              className={`cursor-pointer transition ${
                                isSelected
                                  ? 'bg-cyan-950/30 hover:bg-cyan-950/40'
                                  : 'hover:bg-slate-900/40'
                              }`}
                            >
                              <td
                                className="py-3 pl-4 pr-2 w-10"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleSelectOneBulk(item.id)}
                                  aria-label={`Selecionar ${item.material} ${item.color}`}
                                  className="w-4 h-4 rounded bg-[#050811] border-gray-700 text-cyan-500 focus:ring-0 cursor-pointer"
                                />
                              </td>

                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  {item.hexColor ? (
                                    <span
                                      className="w-6 h-6 rounded-lg border border-gray-700 shrink-0 shadow-inner"
                                      style={{
                                        backgroundColor: item.hexColor,
                                      }}
                                      title={item.hexColor}
                                    />
                                  ) : (
                                    <div className="w-6 h-6 rounded-lg bg-[#050811] border border-gray-800 flex items-center justify-center shrink-0">
                                      <CircleDot className="w-3.5 h-3.5 text-gray-500" />
                                    </div>
                                  )}
                                  <div>
                                    <span className="font-semibold text-slate-100 block">
                                      {item.color}
                                    </span>
                                    <span className="text-[10px] font-mono text-gray-500">
                                      {item.hexColor || 'Sem HEX'} &bull; Alerta
                                      &le; {item.minThresholdGrams}g
                                    </span>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-[#050811] text-cyan-300 border border-gray-800">
                                  {item.material}
                                </span>
                              </td>

                              <td className="py-3 px-4">
                                <div className="flex items-center gap-4">
                                  <div className="space-y-1.5 min-w-[140px]">
                                    <div className="flex items-center justify-between text-[11px] font-mono">
                                      <span className="font-bold text-slate-100">
                                        {item.remainingGrams}g
                                      </span>
                                      <span className="text-gray-500">
                                        {percentage}%
                                      </span>
                                    </div>
                                    <div className="w-full bg-[#050811] rounded-full h-1.5 overflow-hidden border border-gray-800">
                                      <div
                                        className={`h-full rounded-full transition-all ${
                                          isLow ? 'bg-rose-500' : 'bg-cyan-400'
                                        }`}
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>
                                  </div>
                                  {isLow && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md inline-flex items-center gap-1 shrink-0">
                                      <AlertTriangle className="w-2.5 h-2.5" />
                                      <span>Baixo Estoque</span>
                                    </span>
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

            {/* BARRA FLUTUANTE INFERIOR QUANDO selectedFilamentIds.length > 0 */}
            {selectedFilamentIds.length > 0 && (
              <div className="px-6 py-4 bg-[#0a0e1a] border-t border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-2xl">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold text-xs">
                    {selectedFilamentIds.length}{' '}
                    {selectedFilamentIds.length === 1
                      ? 'filamento selecionado'
                      : 'filamentos selecionados'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedFilamentIds([])}
                    className="text-xs text-gray-400 hover:text-white underline underline-offset-4 transition cursor-pointer"
                  >
                    Desmarcar todos
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
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

      {/* 5. MODAL DE CADASTRO DE NOVA BOBINA */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div
            onClick={() => setIsCreateModalOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            aria-hidden="true"
          />

          <div className="relative w-full max-w-xl bg-[#0a0e1a] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden z-10">
            <div className="px-6 py-4 border-b border-gray-800/80 flex items-center justify-between bg-[#050811]/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-100">
                    Adicionar Nova Bobina ao Estoque
                  </h2>
                  <p className="text-[11px] text-gray-400">
                    Cadastre um novo carretel de filamento para controle da oficina
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition cursor-pointer"
                aria-label="Fechar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="filament-material" className={labelCls}>
                    Material (ex: PLA, PETG, ABS) *
                  </label>
                  <input
                    id="filament-material"
                    type="text"
                    name="material"
                    required
                    placeholder="PLA"
                    className={`${inputCls} uppercase`}
                  />
                </div>

                <div>
                  <label htmlFor="filament-color" className={labelCls}>
                    Nome da Cor *
                  </label>
                  <input
                    id="filament-color"
                    type="text"
                    name="color"
                    required
                    placeholder="Preto Fosco"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="filament-hex" className={labelCls}>
                    Código HEX da Cor
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={hexPreview}
                      onChange={(e) => setHexPreview(e.target.value)}
                      aria-label="Seletor visual de cor"
                      className="w-10 h-10 rounded-xl bg-[#050811] border border-gray-800 cursor-pointer p-1 shrink-0"
                    />
                    <input
                      id="filament-hex"
                      type="text"
                      name="hexColor"
                      value={hexPreview}
                      onChange={(e) => setHexPreview(e.target.value)}
                      placeholder="#22d3ee"
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="filament-remaining" className={labelCls}>
                    Peso Atual (gramas) *
                  </label>
                  <input
                    id="filament-remaining"
                    type="number"
                    name="remainingGrams"
                    min="0"
                    required
                    defaultValue="1000"
                    className={`${inputCls} font-mono`}
                  />
                </div>

                <div>
                  <label htmlFor="filament-threshold" className={labelCls}>
                    Alerta Mínimo (gramas) *
                  </label>
                  <input
                    id="filament-threshold"
                    type="number"
                    name="minThresholdGrams"
                    min="0"
                    required
                    defaultValue="200"
                    className={`${inputCls} font-mono`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800/80">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-5 py-2.5 bg-transparent hover:bg-white/5 border border-gray-800 text-gray-300 hover:text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-[#050811] font-bold px-6 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-cyan-500/10 cursor-pointer"
                >
                  {isPending ? 'Salvando...' : 'Cadastrar Bobina'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL DE IMPORTAÇÃO DE DADOS (CSV / XLSX) */}
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
                    Importar Filamentos em Lote
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
                      Planilha Modelo de Filamentos
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
                  htmlFor="filament-csv-upload-input"
                  className="block text-xs font-medium text-gray-400"
                >
                  Arquivo de Importação (.csv, .xlsx)
                </label>
                <input
                  id="filament-csv-upload-input"
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
