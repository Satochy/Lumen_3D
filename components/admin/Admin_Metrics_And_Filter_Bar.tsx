'use client'

import React from 'react'
import { Search, X } from 'lucide-react'

export interface AdminMetricCardItem {
  id: string
  label: string
  value: string | number
  valueColorClass: string
  icon: React.ReactNode
  showPulseDot?: boolean
  dotColorClass?: string
}

export interface AdminFilterTabItem<T extends string> {
  id: T
  label: string
  count: number
  icon: React.ReactNode
  activeColorClass?: string
}

export interface AdminMetricsAndFilterBarProps<T extends string> {
  metrics: AdminMetricCardItem[]
  searchQuery: string
  onSearchChange: (val: string) => void
  searchPlaceholder: string
  filters: AdminFilterTabItem<T>[]
  activeFilter?: T
  onFilterChange: (id: T) => void
  isMultiSelect?: boolean
  activeFilters?: string[]
  rightSlot?: React.ReactNode
}

export function AdminMetricsAndFilterBar<T extends string>({
  metrics,
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  filters,
  activeFilter,
  onFilterChange,
  isMultiSelect = false,
  activeFilters = [],
  rightSlot,
}: AdminMetricsAndFilterBarProps<T>) {
  return (
    <>
      {/* Bloco 1 (Grid de 4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {metrics.map((metric) => (
          <div
            key={metric.id}
            className="bg-[#0a0e1a] border border-gray-800/80 rounded-2xl px-5 py-4 flex items-center justify-between"
          >
            <div>
              <span className="text-xs text-gray-400 font-medium mb-1.5 block">
                {metric.label}
              </span>
              <span
                className={`text-2xl font-bold tracking-tight flex items-center gap-2 ${metric.valueColorClass}`}
              >
                {metric.value}
                {metric.showPulseDot && (
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      metric.dotColorClass || 'bg-amber-400'
                    }`}
                  />
                )}
              </span>
            </div>
            <div>{metric.icon}</div>
          </div>
        ))}
      </div>

      {/* Bloco 2 (Barra Unificada de Pesquisa e Filtros) */}
      <div className="bg-[#0a0e1a] border border-gray-800/80 rounded-2xl p-2 mb-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2">
        {/* Input de busca à esquerda */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full bg-[#050811]/60 border border-gray-800/80 rounded-xl pl-9 pr-8 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-800/70"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Agrupador de Filtros à direita */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="bg-[#050811]/60 border border-gray-800/80 rounded-xl p-1 flex items-center gap-1 flex-wrap">
            {filters.map((filter) => {
              const isActive = isMultiSelect
                ? activeFilters.includes(filter.id)
                : activeFilter === filter.id
              const activeClass =
                filter.activeColorClass ||
                'bg-cyan-950/50 border-cyan-500/40 text-cyan-300 shadow-sm'
              const inactiveClass =
                'bg-transparent border-transparent text-gray-300 hover:bg-white/5 hover:text-white'

              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => onFilterChange(filter.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border whitespace-nowrap cursor-pointer ${
                    isActive ? activeClass : inactiveClass
                  }`}
                >
                  {filter.icon}
                  <span>
                    {filter.label} ({filter.count})
                  </span>
                </button>
              )
            })}
          </div>

          {rightSlot && <div className="shrink-0">{rightSlot}</div>}
        </div>
      </div>
    </>
  )
}

export default AdminMetricsAndFilterBar
