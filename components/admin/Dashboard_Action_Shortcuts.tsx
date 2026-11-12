'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  MessageSquarePlus,
  FileText,
  Download,
  Boxes,
  CircleDot,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import {
  exportRecentSalesCSVAction,
  exportProductsCSVAction,
  exportFilamentsCSVAction,
} from '@/app/actions/dashboard_export_actions'

type ExportTarget = 'sales' | 'products' | 'filaments' | null

function triggerBrowserDownload(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function Dashboard_Action_Shortcuts() {
  const [loadingTarget, setLoadingTarget] = useState<ExportTarget>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleDirectExport = async (target: Exclude<ExportTarget, null>) => {
    if (loadingTarget) return
    setLoadingTarget(target)
    setErrorMessage(null)

    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

      const result =
        target === 'sales'
          ? await exportRecentSalesCSVAction({
              period: 'THIS_MONTH',
              startDate: startOfMonth.toISOString(),
              endDate: endOfMonth.toISOString(),
            })
          : target === 'products'
            ? await exportProductsCSVAction()
            : await exportFilamentsCSVAction()

      if (result.success && result.data) {
        triggerBrowserDownload(result.data.csv, result.data.filename)
      } else {
        setErrorMessage(result.error || 'Falha ao gerar arquivo CSV.')
      }
    } catch {
      setErrorMessage('Erro inesperado ao exportar CSV.')
    } finally {
      setLoadingTarget(null)
    }
  }

  return (
    <div className="bg-[#080d1e]/80 border border-slate-800/80 rounded-2xl p-6 space-y-4 flex flex-col justify-between shadow-lg shadow-black/40 backdrop-blur-md">
      <div>
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3.5 mb-4">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-slate-100">Atalhos Operacionais</h2>
        </div>

        <div className="space-y-2.5">
          {/* Botão 1: Nova Venda Assistida */}
          <Link
            href="/admin/assisted-sales?action=new"
            className="flex items-center justify-between px-4 py-3 bg-slate-900/50 hover:bg-slate-800/80 border border-slate-800/80 hover:border-cyan-900 rounded-xl text-sm font-medium text-slate-300 hover:text-cyan-400 transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <MessageSquarePlus className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Criar Venda Assistida</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-transform shrink-0" />
          </Link>

          {/* Botão 2: Relatório de Caixa (Mês Atual) */}
          <Link
            href="/admin/finance?period=THIS_MONTH&action=report"
            className="flex items-center justify-between px-4 py-3 bg-slate-900/50 hover:bg-slate-800/80 border border-slate-800/80 hover:border-cyan-900 rounded-xl text-sm font-medium text-slate-300 hover:text-cyan-400 transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Relatório de Caixa (Mês Atual)</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-transform shrink-0" />
          </Link>

          {/* Botão 3: Exportar Vendas Brutas (CSV) */}
          <button
            type="button"
            onClick={() => handleDirectExport('sales')}
            disabled={loadingTarget !== null}
            className="w-full cursor-pointer flex items-center justify-between px-4 py-3 bg-slate-900/50 hover:bg-slate-800/80 border border-slate-800/80 hover:border-cyan-900 rounded-xl text-sm font-medium text-slate-300 hover:text-cyan-400 transition-all group disabled:opacity-60"
          >
            <div className="flex items-center gap-2.5">
              {loadingTarget === 'sales' ? (
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
              ) : (
                <Download className="w-4 h-4 text-cyan-400 shrink-0" />
              )}
              <span>Exportar Vendas (Mês Atual)</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-transform shrink-0" />
          </button>

          {/* Botão 3: Exportar Produtos */}
          <button
            type="button"
            onClick={() => handleDirectExport('products')}
            disabled={loadingTarget !== null}
            className="w-full cursor-pointer flex items-center justify-between px-4 py-3 bg-slate-900/50 hover:bg-slate-800/80 border border-slate-800/80 hover:border-cyan-900 rounded-xl text-sm font-medium text-slate-300 hover:text-cyan-400 transition-all group disabled:opacity-60"
          >
            <div className="flex items-center gap-2.5">
              {loadingTarget === 'products' ? (
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
              ) : (
                <Boxes className="w-4 h-4 text-cyan-400 shrink-0" />
              )}
              <span>Exportar Produtos</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-transform shrink-0" />
          </button>

          {/* Botão 4: Exportar Filamentos */}
          <button
            type="button"
            onClick={() => handleDirectExport('filaments')}
            disabled={loadingTarget !== null}
            className="w-full cursor-pointer flex items-center justify-between px-4 py-3 bg-slate-900/50 hover:bg-slate-800/80 border border-slate-800/80 hover:border-cyan-900 rounded-xl text-sm font-medium text-slate-300 hover:text-cyan-400 transition-all group disabled:opacity-60"
          >
            <div className="flex items-center gap-2.5">
              {loadingTarget === 'filaments' ? (
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
              ) : (
                <CircleDot className="w-4 h-4 text-cyan-400 shrink-0" />
              )}
              <span>Exportar Filamentos</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-transform shrink-0" />
          </button>
        </div>
      </div>

      {errorMessage && (
        <p className="text-xs text-rose-400 font-mono bg-rose-950/30 border border-rose-800/50 rounded-xl px-3 py-2">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
