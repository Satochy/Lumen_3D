'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  BarChart3,
  Calendar,
  Download,
  FileCode2,
  FileText,
  Printer,
  Search,
  X,
  TrendingUp,
  ShoppingBag,
  Layers,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  MapPin,
  Package,
  Sparkles,
  Store,
  MessageSquare,
  Award,
  PieChart,
} from 'lucide-react'
import { formatCurrency } from '@/lib/format_currency'
import type { PaymentStatus, LogisticsStatus } from '@prisma/client'
import Admin_Orders_Table from '@/components/admin/Admin_Orders_Table'
import {
  normalizeAdminOrder,
  resolveOrderLocation,
  resolveOrderOrigin,
} from '@/lib/order_presenter'

export interface SerializedFinanceOrderItem {
  id: string
  productId: string | null
  productTitle: string
  quantity: number
  priceUnit: number
  isMadeToOrder: boolean
  productionDays: number | null
  product: {
    id: string
    title: string
    slug: string
    category: string
    isMadeToOrder: boolean
  } | null
}

export interface SerializedFinanceAddress {
  city?: string
  state?: string
  zipCode?: string
  neighborhood?: string
  isDefault?: boolean
}

export interface SerializedFinanceOrder {
  id: string
  userId: string | null
  paymentStatus: PaymentStatus
  logisticsStatus: LogisticsStatus
  totalAmount: number
  shippingCost: number
  isLocalDelivery: boolean
  isAssistedSale: boolean
  assistedSaleExpectedEmail: string | null
  adminNotes: string | null
  paymentMethod: string | null
  createdAt: string
  paidAt: string | null
  cancelledAt: string | null
  deliveredAt: string | null
  shippingAddressSnapshot: {
    city?: string
    state?: string
    zipCode?: string
    neighborhood?: string
    serviceName?: string
    isLocalDelivery?: boolean
    [key: string]: unknown
  } | null
  user: {
    id: string
    name: string | null
    username: string
    email: string
    phone: string | null
    addresses: SerializedFinanceAddress[]
  } | null
  items: SerializedFinanceOrderItem[]
}

export interface FinanceAnalyticsClientProps {
  orders: SerializedFinanceOrder[]
}

export type TimePeriodFilter =
  | 'TODAY'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'SPECIFIC_MONTH'
  | 'LAST_N_MONTHS'
  | 'THIS_YEAR'
  | 'SPECIFIC_YEAR'
  | 'LAST_3_YEARS'

type LedgerStatusFilter = 'ALL' | 'PAID' | 'PENDING' | 'CANCELLED'

const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const MONTHS_SHORT_PT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

function extractAssistedOrigin(order: SerializedFinanceOrder): 'Marketplace' | 'WhatsApp' | 'Instagram' | 'Balcão / Outro' {
  const origin = resolveOrderOrigin(order)
  if (origin === 'Balcão') return 'Balcão / Outro'
  return origin
}

function extractOrderLocation(order: SerializedFinanceOrder): {
  city: string
  state: string
  zipCode: string
  label: string
  isLocal: boolean
} {
  return resolveOrderLocation(order)
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '')
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export default function Finance_Analytics_Client({
  orders,
}: FinanceAnalyticsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const now = useMemo(() => new Date(), [])
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  // Estados de filtro temporal
  const [period, setPeriod] = useState<TimePeriodFilter>('THIS_MONTH')
  const [specificMonth, setSpecificMonth] = useState<number>(currentMonth)
  const [specificMonthYear, setSpecificMonthYear] = useState<number>(currentYear)
  const [lastNMonths, setLastNMonths] = useState<number>(6)
  const [specificYear, setSpecificYear] = useState<number>(currentYear)

  // Estados do Livro-Razão (Extrato)
  const [ledgerSearch, setLedgerSearch] = useState<string>('')
  const [ledgerStatus, setLedgerStatus] = useState<LedgerStatusFilter>('ALL')

  // Estado do Modal de Relatório Executivo
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false)

  // Leitura de parâmetros de atalho vindos da Dashboard (?period=THIS_MONTH&action=report)
  useEffect(() => {
    const periodParam = searchParams.get('period')
    const actionParam = searchParams.get('action')

    if (!periodParam && !actionParam) return

    if (periodParam === 'THIS_MONTH') {
      setPeriod('THIS_MONTH')
    }

    if (actionParam === 'report') {
      setIsReportModalOpen(true)
    }

    router.replace('/admin/finance', { scroll: false })
  }, [searchParams, router])

  // Lista de anos disponíveis com base nos pedidos + últimos 5 anos
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>([
      currentYear,
      currentYear - 1,
      currentYear - 2,
      currentYear - 3,
    ])
    orders.forEach((o) => {
      const y = new Date(o.createdAt).getFullYear()
      if (!isNaN(y)) yearsSet.add(y)
    })
    return Array.from(yearsSet).sort((a, b) => b - a)
  }, [orders, currentYear])

  // Intervalo de datas calculado para o filtro temporal
  const dateRange = useMemo(() => {
    const refNow = new Date()
    let start = new Date(refNow)
    let end = new Date(refNow)
    let label = ''
    let granularity: 'HOUR' | 'DAY' | 'MONTH' = 'DAY'

    if (period === 'TODAY') {
      start = new Date(refNow.getFullYear(), refNow.getMonth(), refNow.getDate(), 0, 0, 0, 0)
      end = new Date(refNow.getFullYear(), refNow.getMonth(), refNow.getDate(), 23, 59, 59, 999)
      label = `Hoje (${start.toLocaleDateString('pt-BR')})`
      granularity = 'HOUR'
    } else if (period === 'THIS_WEEK') {
      const dayOfWeek = refNow.getDay() // 0 (Dom) a 6 (Sáb)
      start = new Date(refNow.getFullYear(), refNow.getMonth(), refNow.getDate() - dayOfWeek, 0, 0, 0, 0)
      end = new Date(refNow.getFullYear(), refNow.getMonth(), refNow.getDate(), 23, 59, 59, 999)
      label = `Esta Semana (${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')})`
      granularity = 'DAY'
    } else if (period === 'THIS_MONTH') {
      start = new Date(refNow.getFullYear(), refNow.getMonth(), 1, 0, 0, 0, 0)
      end = new Date(refNow.getFullYear(), refNow.getMonth() + 1, 0, 23, 59, 59, 999)
      label = `Este Mês (${MONTHS_PT[refNow.getMonth()]} / ${refNow.getFullYear()})`
      granularity = 'DAY'
    } else if (period === 'SPECIFIC_MONTH') {
      start = new Date(specificMonthYear, specificMonth, 1, 0, 0, 0, 0)
      end = new Date(specificMonthYear, specificMonth + 1, 0, 23, 59, 59, 999)
      label = `${MONTHS_PT[specificMonth]} de ${specificMonthYear}`
      granularity = 'DAY'
    } else if (period === 'LAST_N_MONTHS') {
      const n = Math.max(1, Math.min(60, lastNMonths || 6))
      start = new Date(refNow.getFullYear(), refNow.getMonth() - (n - 1), 1, 0, 0, 0, 0)
      end = new Date(refNow.getFullYear(), refNow.getMonth() + 1, 0, 23, 59, 59, 999)
      label = `Últimos ${n} ${n === 1 ? 'Mês' : 'Meses'}`
      granularity = n === 1 ? 'DAY' : 'MONTH'
    } else if (period === 'THIS_YEAR') {
      start = new Date(refNow.getFullYear(), 0, 1, 0, 0, 0, 0)
      end = new Date(refNow.getFullYear(), 11, 31, 23, 59, 59, 999)
      label = `Ano de ${refNow.getFullYear()}`
      granularity = 'MONTH'
    } else if (period === 'SPECIFIC_YEAR') {
      start = new Date(specificYear, 0, 1, 0, 0, 0, 0)
      end = new Date(specificYear, 11, 31, 23, 59, 59, 999)
      label = `Ano de ${specificYear}`
      granularity = 'MONTH'
    } else if (period === 'LAST_3_YEARS') {
      start = new Date(refNow.getFullYear() - 2, 0, 1, 0, 0, 0, 0)
      end = new Date(refNow.getFullYear(), 11, 31, 23, 59, 59, 999)
      label = `Últimos 3 Anos (${refNow.getFullYear() - 2} – ${refNow.getFullYear()})`
      granularity = 'MONTH'
    }

    return { start, end, label, granularity }
  }, [period, specificMonth, specificMonthYear, lastNMonths, specificYear])

  // Pedidos filtrados pelo período selecionado
  const periodOrders = useMemo(() => {
    const startMs = dateRange.start.getTime()
    const endMs = dateRange.end.getTime()
    return orders.filter((order) => {
      const refDate = new Date(order.createdAt).getTime()
      return refDate >= startMs && refDate <= endMs
    })
  }, [orders, dateRange])

  // Cálculos analíticos consolidados do período
  const analytics = useMemo(() => {
    const paidOrders = periodOrders.filter((o) => o.paymentStatus === 'PAID')
    const pendingOrders = periodOrders.filter(
      (o) => o.paymentStatus === 'PENDING' && o.logisticsStatus !== 'CANCELLED'
    )
    const cancelledOrRefundedOrders = periodOrders.filter(
      (o) =>
        o.logisticsStatus === 'CANCELLED' ||
        o.paymentStatus === 'REFUNDED' ||
        o.paymentStatus === 'FAILED'
    )

    // 1. Faturamento Bruto, Peças vs Frete
    let grossRevenue = 0
    let shippingRevenue = 0
    let itemsRevenue = 0
    let totalUnitsSold = 0

    // Canais e Origens (sobre pedidos PAGOS)
    let marketplaceRevenue = 0
    let marketplaceOrdersCount = 0
    let assistedRevenue = 0
    let assistedOrdersCount = 0

    const assistedSubChannels: Record<'WhatsApp' | 'Instagram' | 'Balcão / Outro', { revenue: number; count: number }> = {
      WhatsApp: { revenue: 0, count: 0 },
      Instagram: { revenue: 0, count: 0 },
      'Balcão / Outro': { revenue: 0, count: 0 },
    }

    // Catálogo vs Personalizado
    let catalogRevenue = 0
    let catalogUnits = 0
    let customRevenue = 0
    let customUnits = 0

    // Pronta Entrega vs Sob Encomenda
    let readyStockRevenue = 0
    let readyStockUnits = 0
    let madeToOrderRevenue = 0
    let madeToOrderUnits = 0

    // Rankings: Produtos, Categorias e Regiões
    const productMap = new Map<
      string,
      { title: string; units: number; revenue: number; isMadeToOrder: boolean }
    >()
    const categoryMap = new Map<string, { category: string; units: number; revenue: number }>()
    const regionMap = new Map<
      string,
      { label: string; state: string; ordersCount: number; revenue: number; isLocal: boolean }
    >()

    for (const order of paidOrders) {
      grossRevenue += order.totalAmount
      shippingRevenue += order.shippingCost

      const origin = extractAssistedOrigin(order)
      if (origin === 'Marketplace') {
        marketplaceRevenue += order.totalAmount
        marketplaceOrdersCount += 1
      } else {
        assistedRevenue += order.totalAmount
        assistedOrdersCount += 1
        assistedSubChannels[origin].revenue += order.totalAmount
        assistedSubChannels[origin].count += 1
      }

      // Região geográfica
      const loc = extractOrderLocation(order)
      const existingReg = regionMap.get(loc.label) || {
        label: loc.label,
        state: loc.state,
        ordersCount: 0,
        revenue: 0,
        isLocal: loc.isLocal,
      }
      existingReg.ordersCount += 1
      existingReg.revenue += order.totalAmount
      regionMap.set(loc.label, existingReg)

      for (const item of order.items) {
        const lineTotal = item.priceUnit * item.quantity
        itemsRevenue += lineTotal
        totalUnitsSold += item.quantity

        // Catálogo vs Personalizado (sem productId = item personalizado em venda assistida)
        if (item.productId) {
          catalogRevenue += lineTotal
          catalogUnits += item.quantity
        } else {
          customRevenue += lineTotal
          customUnits += item.quantity
        }

        // Pronta Entrega vs Sob Encomenda
        if (item.isMadeToOrder) {
          madeToOrderRevenue += lineTotal
          madeToOrderUnits += item.quantity
        } else {
          readyStockRevenue += lineTotal
          readyStockUnits += item.quantity
        }

        // Ranking de Produtos
        const prodKey = item.productId || `custom:${item.productTitle}`
        const existingProd = productMap.get(prodKey) || {
          title: item.productTitle,
          units: 0,
          revenue: 0,
          isMadeToOrder: item.isMadeToOrder,
        }
        existingProd.units += item.quantity
        existingProd.revenue += lineTotal
        productMap.set(prodKey, existingProd)

        // Ranking de Categorias
        const catName = item.product?.category?.trim() || (item.productId ? 'Geral 3D' : 'Personalizados / Sob Medida')
        const existingCat = categoryMap.get(catName) || {
          category: catName,
          units: 0,
          revenue: 0,
        }
        existingCat.units += item.quantity
        existingCat.revenue += lineTotal
        categoryMap.set(catName, existingCat)
      }
    }

    const averageTicket = paidOrders.length > 0 ? grossRevenue / paidOrders.length : 0
    const pendingAmount = pendingOrders.reduce((acc, o) => acc + o.totalAmount, 0)
    const cancelledAmount = cancelledOrRefundedOrders.reduce((acc, o) => acc + o.totalAmount, 0)

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)

    const topCategories = Array.from(categoryMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)

    const topRegions = Array.from(regionMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)

    return {
      paidOrdersCount: paidOrders.length,
      pendingOrdersCount: pendingOrders.length,
      cancelledOrdersCount: cancelledOrRefundedOrders.length,
      grossRevenue,
      itemsRevenue,
      shippingRevenue,
      totalUnitsSold,
      averageTicket,
      pendingAmount,
      cancelledAmount,
      marketplaceRevenue,
      marketplaceOrdersCount,
      assistedRevenue,
      assistedOrdersCount,
      assistedSubChannels,
      catalogRevenue,
      catalogUnits,
      customRevenue,
      customUnits,
      readyStockRevenue,
      readyStockUnits,
      madeToOrderRevenue,
      madeToOrderUnits,
      topProducts,
      topCategories,
      topRegions,
    }
  }, [periodOrders])

  // Séries temporais para o Gráfico SVG Nativo de Evolução
  const chartSeries = useMemo(() => {
    const buckets: Array<{
      key: string
      label: string
      revenue: number
      ordersCount: number
    }> = []

    const paidOrders = periodOrders.filter((o) => o.paymentStatus === 'PAID')

    if (dateRange.granularity === 'HOUR') {
      for (let h = 0; h < 24; h += 2) {
        const label = `${String(h).padStart(2, '0')}h`
        buckets.push({ key: `${h}`, label, revenue: 0, ordersCount: 0 })
      }
      for (const o of paidOrders) {
        const d = new Date(o.createdAt)
        const bucketIdx = Math.floor(d.getHours() / 2)
        if (buckets[bucketIdx]) {
          buckets[bucketIdx].revenue += o.totalAmount
          buckets[bucketIdx].ordersCount += 1
        }
      }
    } else if (dateRange.granularity === 'DAY') {
      const cursor = new Date(dateRange.start)
      const endMs = dateRange.end.getTime()
      const mapIdx = new Map<string, number>()

      while (cursor.getTime() <= endMs && buckets.length < 35) {
        const y = cursor.getFullYear()
        const m = String(cursor.getMonth() + 1).padStart(2, '0')
        const day = String(cursor.getDate()).padStart(2, '0')
        const key = `${y}-${m}-${day}`
        const label = `${day}/${m}`
        mapIdx.set(key, buckets.length)
        buckets.push({ key, label, revenue: 0, ordersCount: 0 })
        cursor.setDate(cursor.getDate() + 1)
      }

      for (const o of paidOrders) {
        const d = new Date(o.createdAt)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate()
        ).padStart(2, '0')}`
        const idx = mapIdx.get(key)
        if (idx !== undefined && buckets[idx]) {
          buckets[idx].revenue += o.totalAmount
          buckets[idx].ordersCount += 1
        }
      }
    } else {
      // MONTH granularity
      const cursor = new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), 1)
      const endYear = dateRange.end.getFullYear()
      const endMonth = dateRange.end.getMonth()
      const mapIdx = new Map<string, number>()

      while (
        (cursor.getFullYear() < endYear ||
          (cursor.getFullYear() === endYear && cursor.getMonth() <= endMonth)) &&
        buckets.length < 36
      ) {
        const y = cursor.getFullYear()
        const m = cursor.getMonth()
        const key = `${y}-${String(m + 1).padStart(2, '0')}`
        const label = `${MONTHS_SHORT_PT[m]}/${String(y).slice(-2)}`
        mapIdx.set(key, buckets.length)
        buckets.push({ key, label, revenue: 0, ordersCount: 0 })
        cursor.setMonth(cursor.getMonth() + 1)
      }

      for (const o of paidOrders) {
        const d = new Date(o.createdAt)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const idx = mapIdx.get(key)
        if (idx !== undefined && buckets[idx]) {
          buckets[idx].revenue += o.totalAmount
          buckets[idx].ordersCount += 1
        }
      }
    }

    const maxRevenue = Math.max(...buckets.map((b) => b.revenue), 100)
    return { buckets, maxRevenue }
  }, [periodOrders, dateRange])

  // Filtragem do Livro-Razão (Extrato)
  const filteredLedgerOrders = useMemo(() => {
    return periodOrders.filter((order) => {
      if (ledgerStatus === 'PAID' && order.paymentStatus !== 'PAID') return false
      if (
        ledgerStatus === 'PENDING' &&
        (order.paymentStatus !== 'PENDING' || order.logisticsStatus === 'CANCELLED')
      ) {
        return false
      }
      if (
        ledgerStatus === 'CANCELLED' &&
        order.logisticsStatus !== 'CANCELLED' &&
        order.paymentStatus !== 'REFUNDED' &&
        order.paymentStatus !== 'FAILED'
      ) {
        return false
      }

      if (ledgerSearch.trim()) {
        const q = ledgerSearch.toLowerCase().trim()
        const normalized = normalizeAdminOrder(order)
        const matchId = order.id.toLowerCase().includes(q)
        const matchClient =
          normalized.clientName.toLowerCase().includes(q) ||
          normalized.clientEmail.toLowerCase().includes(q)
        const matchCity = normalized.location.label.toLowerCase().includes(q)
        const matchOrigin = normalized.origin.toLowerCase().includes(q)
        const matchItem = order.items.some((i) => i.productTitle.toLowerCase().includes(q))

        if (!matchId && !matchClient && !matchCity && !matchOrigin && !matchItem) {
          return false
        }
      }

      return true
    })
  }, [periodOrders, ledgerStatus, ledgerSearch])

  // Exportação CSV Nativa
  const handleExportCSV = () => {
    const headers = [
      'ID_Pedido',
      'Data_Criacao',
      'Status_Pagamento',
      'Status_Logistica',
      'Cliente',
      'Email',
      'Cidade_UF',
      'CEP',
      'Canal_Origem',
      'Modalidade_Producao',
      'Qtd_Pecas',
      'Valor_Pecas_BRL',
      'Valor_Frete_BRL',
      'Valor_Total_BRL',
      'Itens_Resumo',
    ]

    const rows = periodOrders.map((o) => {
      const normalized = normalizeAdminOrder(o)
      const itemsSummary = o.items.map((i) => `${i.quantity}x ${i.productTitle}`).join(' | ')

      return [
        o.id,
        new Date(o.createdAt).toLocaleString('pt-BR'),
        o.paymentStatus,
        o.logisticsStatus,
        normalized.clientName,
        normalized.clientEmail,
        normalized.location.label,
        normalized.location.zipCode,
        normalized.origin,
        normalized.modality,
        normalized.totalUnits,
        normalized.itemsTotal.toFixed(2).replace('.', ','),
        normalized.shippingCost.toFixed(2).replace('.', ','),
        normalized.grandTotal.toFixed(2).replace('.', ','),
        itemsSummary,
      ]
        .map(escapeCsvCell)
        .join(';')
    })

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lumen3d-financeiro-${period.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Exportação XML Estruturado Nativa
  const handleExportXML = () => {
    const xmlOrders = periodOrders
      .map((o) => {
        const normalized = normalizeAdminOrder(o)
        const loc = normalized.location
        const origin = normalized.origin
        const itemsSubtotal = normalized.itemsTotal
        const clientName = normalized.clientName
        const clientEmail = normalized.clientEmail

        const itemsXml = o.items
          .map(
            (i) => `      <Item>
        <ProdutoId>${escapeXml(i.productId || 'PERSONALIZADO')}</ProdutoId>
        <Titulo>${escapeXml(i.productTitle)}</Titulo>
        <Categoria>${escapeXml(i.product?.category || 'Personalizado')}</Categoria>
        <Modalidade>${i.isMadeToOrder ? 'SOB_ENCOMENDA' : 'PRONTA_ENTREGA'}</Modalidade>
        <Quantidade>${i.quantity}</Quantidade>
        <PrecoUnitario>${i.priceUnit.toFixed(2)}</PrecoUnitario>
      </Item>`
          )
          .join('\n')

        return `  <Pedido id="${escapeXml(o.id)}">
    <DataCriacao>${escapeXml(o.createdAt)}</DataCriacao>
    <StatusPagamento>${escapeXml(o.paymentStatus)}</StatusPagamento>
    <StatusLogistica>${escapeXml(o.logisticsStatus)}</StatusLogistica>
    <CanalOrigem>${escapeXml(origin)}</CanalOrigem>
    <Cliente>
      <Nome>${escapeXml(clientName)}</Nome>
      <Email>${escapeXml(clientEmail)}</Email>
      <CidadeUF>${escapeXml(loc.label)}</CidadeUF>
      <CEP>${escapeXml(loc.zipCode)}</CEP>
    </Cliente>
    <Valores moeda="BRL">
      <SubtotalPecas>${itemsSubtotal.toFixed(2)}</SubtotalPecas>
      <Frete>${o.shippingCost.toFixed(2)}</Frete>
      <Total>${o.totalAmount.toFixed(2)}</Total>
    </Valores>
    <Itens>
${itemsXml}
    </Itens>
  </Pedido>`
      })
      .join('\n')

    const xmlDoc = `<?xml version="1.0" encoding="UTF-8"?>
<RelatorioFinanceiroLumen3D geradoEm="${new Date().toISOString()}" periodo="${escapeXml(dateRange.label)}">
  <ResumoConsolidado>
    <FaturamentoBrutoPago>${analytics.grossRevenue.toFixed(2)}</FaturamentoBrutoPago>
    <ReceitaPecas>${analytics.itemsRevenue.toFixed(2)}</ReceitaPecas>
    <ReceitaFrete>${analytics.shippingRevenue.toFixed(2)}</ReceitaFrete>
    <TicketMedio>${analytics.averageTicket.toFixed(2)}</TicketMedio>
    <PedidosPagos>${analytics.paidOrdersCount}</PedidosPagos>
    <UnidadesVendidas>${analytics.totalUnitsSold}</UnidadesVendidas>
    <TotalPendente>${analytics.pendingAmount.toFixed(2)}</TotalPendente>
    <TotalCanceladoEstornado>${analytics.cancelledAmount.toFixed(2)}</TotalCanceladoEstornado>
  </ResumoConsolidado>
  <Pedidos>
${xmlOrders}
  </Pedidos>
</RelatorioFinanceiroLumen3D>`

    const blob = new Blob([xmlDoc], { type: 'application/xml;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lumen3d-financeiro-${period.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xml`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Cálculo do Canal Dominante para o KPI 3
  const dominantChannel = useMemo(() => {
    const total = analytics.grossRevenue
    if (total <= 0) {
      return {
        name: 'Sem vendas pagas',
        amount: 0,
        percent: 0,
        subLabel: 'Marketplace (0%) • Assistida (0%)',
      }
    }
    const mktPct = Math.round((analytics.marketplaceRevenue / total) * 100)
    const assPct = 100 - mktPct
    if (analytics.marketplaceRevenue >= analytics.assistedRevenue) {
      return {
        name: 'Marketplace (Site)',
        amount: analytics.marketplaceRevenue,
        percent: mktPct,
        subLabel: `Site ${mktPct}% vs. Assistida ${assPct}%`,
      }
    }
    return {
      name: 'Venda Assistida',
      amount: analytics.assistedRevenue,
      percent: assPct,
      subLabel: `Assistida ${assPct}% vs. Site ${mktPct}%`,
    }
  }, [analytics])

  // Percentuais para o Donut SVG de Origem dos Ganhos
  const originDonutData = useMemo(() => {
    const total = Math.max(analytics.grossRevenue, 0.01)
    const mktPct = analytics.grossRevenue > 0 ? (analytics.marketplaceRevenue / total) * 100 : 50
    const assPct = analytics.grossRevenue > 0 ? (analytics.assistedRevenue / total) * 100 : 50
    return { mktPct, assPct }
  }, [analytics])

  const periodOptions: Array<{ id: TimePeriodFilter; label: string }> = [
    { id: 'TODAY', label: 'Hoje' },
    { id: 'THIS_WEEK', label: 'Esta Semana' },
    { id: 'THIS_MONTH', label: 'Este Mês' },
    { id: 'SPECIFIC_MONTH', label: 'Mês Específico' },
    { id: 'LAST_N_MONTHS', label: 'Últimos X Meses' },
    { id: 'THIS_YEAR', label: 'Este Ano' },
    { id: 'SPECIFIC_YEAR', label: 'Ano Específico' },
    { id: 'LAST_3_YEARS', label: 'Últimos 3 Anos' },
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-6 print:max-w-none print:w-full print:bg-white print:text-black print:m-0 print:p-0 print:space-y-0">
      {/* Regras globais de isolamento @media print para ocultar Sidebar, Header do Admin e fundos escuros */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          html, body, main {
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
            min-height: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          aside[aria-label="Navegação administrativa"],
          main > div > header {
            display: none !important;
          }
          main > div {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* A. BARRA SUPERIOR DE FILTRO TEMPORAL E EXPORTAÇÃO (OCULTA NA IMPRESSÃO) */}
      <div className="bg-[#0a0e1a] border border-gray-800/80 rounded-2xl p-3 flex flex-col gap-3 print:hidden">
        {/* Linha 1: Pílulas de período + seletores condicionais */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
          <div className="bg-[#050811]/60 border border-gray-800/80 rounded-xl p-1 flex items-center gap-1 flex-wrap">
            {periodOptions.map((opt) => {
              const isActive = period === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPeriod(opt.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-cyan-950/50 border-cyan-500/40 text-cyan-300 shadow-sm'
                      : 'bg-transparent border-transparent text-gray-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{opt.label}</span>
                </button>
              )
            })}
          </div>

          {/* Controles condicionais quando Mês Específico, Últimos X Meses ou Ano Específico está ativo */}
          <div className="flex items-center gap-2 flex-wrap">
            {period === 'SPECIFIC_MONTH' && (
              <div className="flex items-center gap-2 bg-[#050811]/80 border border-cyan-500/30 rounded-xl px-2.5 py-1">
                <span className="text-[11px] text-cyan-300 font-mono font-semibold">Mês/Ano:</span>
                <select
                  aria-label="Selecionar mês específico"
                  value={specificMonth}
                  onChange={(e) => setSpecificMonth(Number(e.target.value))}
                  className="bg-[#0a0e1a] border border-gray-800 rounded-lg px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-cyan-500"
                >
                  {MONTHS_PT.map((m, idx) => (
                    <option key={m} value={idx}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Selecionar ano do mês específico"
                  value={specificMonthYear}
                  onChange={(e) => setSpecificMonthYear(Number(e.target.value))}
                  className="bg-[#0a0e1a] border border-gray-800 rounded-lg px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-cyan-500 font-mono"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {period === 'LAST_N_MONTHS' && (
              <div className="flex items-center gap-2 bg-[#050811]/80 border border-cyan-500/30 rounded-xl px-2.5 py-1">
                <span className="text-[11px] text-cyan-300 font-mono font-semibold">
                  Quantidade de meses:
                </span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  aria-label="Quantidade de meses"
                  value={lastNMonths}
                  onChange={(e) => setLastNMonths(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
                  className="w-16 bg-[#0a0e1a] border border-gray-800 rounded-lg px-2 py-1 text-xs text-cyan-300 font-mono font-bold text-center focus:outline-none focus:border-cyan-500"
                />
                <span className="text-[11px] text-gray-400">meses</span>
              </div>
            )}

            {period === 'SPECIFIC_YEAR' && (
              <div className="flex items-center gap-2 bg-[#050811]/80 border border-cyan-500/30 rounded-xl px-2.5 py-1">
                <span className="text-[11px] text-cyan-300 font-mono font-semibold">Ano:</span>
                <select
                  aria-label="Selecionar ano específico"
                  value={specificYear}
                  onChange={(e) => setSpecificYear(Number(e.target.value))}
                  className="bg-[#0a0e1a] border border-gray-800 rounded-lg px-2.5 py-1 text-xs text-gray-200 focus:outline-none focus:border-cyan-500 font-mono"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Linha 2: Resumo do Período Ativo + Botões de Exportação e Relatório */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-gray-800/60">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Período em análise:</span>
            <span className="text-cyan-300 font-semibold font-mono">{dateRange.label}</span>
            <span className="text-gray-600">•</span>
            <span className="text-gray-300 font-mono">{periodOrders.length} registros</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#050811] hover:bg-gray-900 text-gray-200 border border-gray-800 hover:border-cyan-500/40 text-xs font-semibold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Exportar CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportXML}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#050811] hover:bg-gray-900 text-gray-200 border border-gray-800 hover:border-cyan-500/40 text-xs font-semibold transition cursor-pointer"
            >
              <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Exportar XML</span>
            </button>

            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/70 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>Gerar Relatório</span>
            </button>
          </div>
        </div>
      </div>

      {/* B. GRID DE 4 CARDS DE KPIs NO TOPO (OCULTO NA IMPRESSÃO) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        {/* KPI 1: Faturamento Bruto (Pagos) */}
        <div className="bg-[#0a0e1a] border border-gray-800/80 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-xs text-gray-400 font-medium mb-1.5 block">
              Faturamento Bruto (Pagos)
            </span>
            <span className="text-2xl font-bold tracking-tight text-emerald-400 flex items-center gap-2 font-mono">
              {formatCurrency(analytics.grossRevenue)}
            </span>
            <span className="text-[11px] text-gray-500 font-mono mt-1.5 block truncate">
              Peças: {formatCurrency(analytics.itemsRevenue)} • Frete:{' '}
              {formatCurrency(analytics.shippingRevenue)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Ticket Médio & Volume */}
        <div className="bg-[#0a0e1a] border border-gray-800/80 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-xs text-gray-400 font-medium mb-1.5 block">
              Ticket Médio &amp; Volume
            </span>
            <span className="text-2xl font-bold tracking-tight text-cyan-300 flex items-center gap-2 font-mono">
              {formatCurrency(analytics.averageTicket)}
            </span>
            <span className="text-[11px] text-gray-500 font-mono mt-1.5 block truncate">
              {analytics.paidOrdersCount} pedidos pagos • {analytics.totalUnitsSold} peças vendidas
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Receita por Canal Principal */}
        <div className="bg-[#0a0e1a] border border-gray-800/80 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-xs text-gray-400 font-medium mb-1.5 block">
              Canal Principal ({dominantChannel.name})
            </span>
            <span className="text-2xl font-bold tracking-tight text-indigo-300 flex items-center gap-2 font-mono">
              {formatCurrency(dominantChannel.amount)}
              <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {dominantChannel.percent}%
              </span>
            </span>
            <span className="text-[11px] text-gray-500 font-mono mt-1.5 block truncate">
              {dominantChannel.subLabel}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: Pendentes & Cancelados */}
        <div className="bg-[#0a0e1a] border border-gray-800/80 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-xs text-gray-400 font-medium mb-1.5 block">
              Pendentes &amp; Cancelados
            </span>
            <span className="text-2xl font-bold tracking-tight text-amber-400 flex items-center gap-2 font-mono">
              {formatCurrency(analytics.pendingAmount)}
              {analytics.pendingOrdersCount > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              )}
            </span>
            <span className="text-[11px] text-rose-400/90 font-mono mt-1.5 block truncate">
              Perdido/Estornado: {formatCurrency(analytics.cancelledAmount)} (
              {analytics.cancelledOrdersCount})
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* C. GRÁFICOS E INTELIGÊNCIA COMERCIAL (100% NATIVOS EM SVG + TAILWIND) */}

      {/* PARTE SUPERIOR DO DOCUMENTO A4 PARA IMPRESSÃO / PDF (1. Cabeçalho, 2. KPIs, 3. Tabelas Resumo) */}
      <div className="hidden print:block print:w-full print:bg-white print:text-black print:m-0 print:p-0 print:shadow-none print:rounded-none">
        {/* 1. Cabeçalho do Relatório Contábil A4 */}
        <div className="border-b-2 border-gray-800 pb-4 mb-6 flex items-start justify-between print:break-inside-avoid">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-wider uppercase text-black">
                LÚMEN 3D
              </span>
              <span className="text-xs font-mono uppercase text-gray-600 border border-gray-400 px-1.5 py-0.5">
                Manufatura Aditiva &amp; E-Commerce
              </span>
            </div>
            <h1 className="text-xl font-bold text-black mt-1">
              Relatório Contábil e Gerencial de Caixa
            </h1>
            <p className="text-xs text-gray-700 mt-0.5">
              Período Filtrado: <strong className="text-black">{dateRange.label}</strong>
            </p>
          </div>

          <div className="text-right text-xs text-gray-700 font-mono">
            <p>
              <strong className="text-black">Emissão:</strong>{' '}
              {new Date().toLocaleDateString('pt-BR')} às{' '}
              {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="mt-0.5">
              <strong className="text-black">Registros no Período:</strong> {periodOrders.length}{' '}
              pedido(s)
            </p>
            <p className="mt-0.5">
              <strong className="text-black">Moeda:</strong> BRL (R$)
            </p>
          </div>
        </div>

        {/* 2. Bloco de KPIs (Grade Limpa sem fundo escuro, bordas cinza claro) */}
        <div className="mb-6 print:break-inside-avoid print:shadow-none print:rounded-none">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800 mb-2 font-mono">
            1. Indicadores Consolidados de Caixa (Pedidos Confirmados)
          </h2>
          <table className="w-full border-collapse border border-gray-300 print:border-gray-300 text-left text-xs">
            <thead>
              <tr className="border-b border-gray-300 print:border-gray-300 text-[11px] uppercase text-gray-700 font-mono">
                <th className="p-2.5 border-r border-gray-300 print:border-gray-300">
                  Receita Bruta (Pagos)
                </th>
                <th className="p-2.5 border-r border-gray-300 print:border-gray-300">
                  Receita Peças
                </th>
                <th className="p-2.5 border-r border-gray-300 print:border-gray-300">
                  Frete Arrecadado
                </th>
                <th className="p-2.5">Ticket Médio</th>
              </tr>
            </thead>
            <tbody>
              <tr className="print:break-inside-avoid">
                <td className="p-2.5 border-r border-gray-300 print:border-gray-300 font-mono">
                  <span className="text-base font-bold text-black block">
                    {formatCurrency(analytics.grossRevenue)}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {analytics.paidOrdersCount} pedido(s) pago(s)
                  </span>
                </td>
                <td className="p-2.5 border-r border-gray-300 print:border-gray-300 font-mono">
                  <span className="text-base font-bold text-black block">
                    {formatCurrency(analytics.itemsRevenue)}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {analytics.totalUnitsSold} unidade(s) vendida(s)
                  </span>
                </td>
                <td className="p-2.5 border-r border-gray-300 print:border-gray-300 font-mono">
                  <span className="text-base font-bold text-black block">
                    {formatCurrency(analytics.shippingRevenue)}
                  </span>
                  <span className="text-[10px] text-gray-600">Logística / Entregas</span>
                </td>
                <td className="p-2.5 font-mono">
                  <span className="text-base font-bold text-black block">
                    {formatCurrency(analytics.averageTicket)}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    Pendente: {formatCurrency(analytics.pendingAmount)} | Cancelado:{' '}
                    {formatCurrency(analytics.cancelledAmount)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 3. Tabelas de Inteligência (2 Colunas: Canais e Modalidades) */}
        <div className="grid grid-cols-2 gap-4 mb-6 print:grid-cols-2 print:gap-4 print:break-inside-avoid">
          {/* Coluna 1: Tabela de Receita por Canal */}
          <div className="print:break-inside-avoid">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800 mb-2 font-mono">
              2. Receita por Canal de Venda (Pagos)
            </h2>
            <table className="w-full border-collapse border border-gray-300 print:border-gray-300 text-xs">
              <thead>
                <tr className="border-b border-gray-300 print:border-gray-300 text-[10px] uppercase text-gray-700 font-mono">
                  <th className="p-2 text-left border-r border-gray-300 print:border-gray-300">
                    Canal
                  </th>
                  <th className="p-2 text-center border-r border-gray-300 print:border-gray-300">
                    Pedidos
                  </th>
                  <th className="p-2 text-right">Receita (R$)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200 print:border-gray-200 print:break-inside-avoid">
                  <td className="p-2 border-r border-gray-300 print:border-gray-300 font-medium text-black">
                    Marketplace (Site Oficial)
                  </td>
                  <td className="p-2 text-center border-r border-gray-300 print:border-gray-300 font-mono text-gray-800">
                    {analytics.marketplaceOrdersCount}
                  </td>
                  <td className="p-2 text-right font-mono font-semibold text-black">
                    {formatCurrency(analytics.marketplaceRevenue)}
                  </td>
                </tr>
                <tr className="border-b border-gray-200 print:border-gray-200 print:break-inside-avoid">
                  <td className="p-2 border-r border-gray-300 print:border-gray-300 text-gray-800">
                    WhatsApp (Venda Assistida)
                  </td>
                  <td className="p-2 text-center border-r border-gray-300 print:border-gray-300 font-mono text-gray-800">
                    {analytics.assistedSubChannels.WhatsApp.count}
                  </td>
                  <td className="p-2 text-right font-mono text-black">
                    {formatCurrency(analytics.assistedSubChannels.WhatsApp.revenue)}
                  </td>
                </tr>
                <tr className="border-b border-gray-200 print:border-gray-200 print:break-inside-avoid">
                  <td className="p-2 border-r border-gray-300 print:border-gray-300 text-gray-800">
                    Instagram (Venda Assistida)
                  </td>
                  <td className="p-2 text-center border-r border-gray-300 print:border-gray-300 font-mono text-gray-800">
                    {analytics.assistedSubChannels.Instagram.count}
                  </td>
                  <td className="p-2 text-right font-mono text-black">
                    {formatCurrency(analytics.assistedSubChannels.Instagram.revenue)}
                  </td>
                </tr>
                <tr className="border-b border-gray-300 print:border-gray-300 print:break-inside-avoid">
                  <td className="p-2 border-r border-gray-300 print:border-gray-300 text-gray-800">
                    Balcão / Outro (Assistida)
                  </td>
                  <td className="p-2 text-center border-r border-gray-300 print:border-gray-300 font-mono text-gray-800">
                    {analytics.assistedSubChannels['Balcão / Outro'].count}
                  </td>
                  <td className="p-2 text-right font-mono text-black">
                    {formatCurrency(analytics.assistedSubChannels['Balcão / Outro'].revenue)}
                  </td>
                </tr>
                <tr className="font-bold text-black print:break-inside-avoid">
                  <td className="p-2 border-r border-gray-300 print:border-gray-300">
                    Total Confirmado
                  </td>
                  <td className="p-2 text-center border-r border-gray-300 print:border-gray-300 font-mono">
                    {analytics.paidOrdersCount}
                  </td>
                  <td className="p-2 text-right font-mono">
                    {formatCurrency(analytics.grossRevenue)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Coluna 2: Tabela de Modalidades (Pronta Entrega vs. Sob Encomenda) */}
          <div className="print:break-inside-avoid">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800 mb-2 font-mono">
              3. Modalidades de Produção &amp; Situação
            </h2>
            <table className="w-full border-collapse border border-gray-300 print:border-gray-300 text-xs">
              <thead>
                <tr className="border-b border-gray-300 print:border-gray-300 text-[10px] uppercase text-gray-700 font-mono">
                  <th className="p-2 text-left border-r border-gray-300 print:border-gray-300">
                    Modalidade / Status
                  </th>
                  <th className="p-2 text-center border-r border-gray-300 print:border-gray-300">
                    Volume
                  </th>
                  <th className="p-2 text-right">Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200 print:border-gray-200 print:break-inside-avoid">
                  <td className="p-2 border-r border-gray-300 print:border-gray-300 font-medium text-black">
                    Pronta Entrega (Estoque Físico)
                  </td>
                  <td className="p-2 text-center border-r border-gray-300 print:border-gray-300 font-mono text-gray-800">
                    {analytics.readyStockUnits} un.
                  </td>
                  <td className="p-2 text-right font-mono font-semibold text-black">
                    {formatCurrency(analytics.readyStockRevenue)}
                  </td>
                </tr>
                <tr className="border-b border-gray-200 print:border-gray-200 print:break-inside-avoid">
                  <td className="p-2 border-r border-gray-300 print:border-gray-300 font-medium text-black">
                    Sob Encomenda (Fila de Produção)
                  </td>
                  <td className="p-2 text-center border-r border-gray-300 print:border-gray-300 font-mono text-gray-800">
                    {analytics.madeToOrderUnits} un.
                  </td>
                  <td className="p-2 text-right font-mono font-semibold text-black">
                    {formatCurrency(analytics.madeToOrderRevenue)}
                  </td>
                </tr>
                <tr className="border-b border-gray-200 print:border-gray-200 print:break-inside-avoid">
                  <td className="p-2 border-r border-gray-300 print:border-gray-300 text-gray-800">
                    Catálogo vs. Personalizados
                  </td>
                  <td className="p-2 text-center border-r border-gray-300 print:border-gray-300 font-mono text-gray-800">
                    {analytics.catalogUnits} / {analytics.customUnits} un.
                  </td>
                  <td className="p-2 text-right font-mono text-gray-800">
                    {formatCurrency(analytics.catalogRevenue)} /{' '}
                    {formatCurrency(analytics.customRevenue)}
                  </td>
                </tr>
                <tr className="border-b border-gray-200 print:border-gray-200 print:break-inside-avoid">
                  <td className="p-2 border-r border-gray-300 print:border-gray-300 text-gray-700">
                    Pedidos Pendentes (Aguardando)
                  </td>
                  <td className="p-2 text-center border-r border-gray-300 print:border-gray-300 font-mono text-gray-700">
                    {analytics.pendingOrdersCount} ped.
                  </td>
                  <td className="p-2 text-right font-mono text-gray-700">
                    {formatCurrency(analytics.pendingAmount)}
                  </td>
                </tr>
                <tr className="print:break-inside-avoid">
                  <td className="p-2 border-r border-gray-300 print:border-gray-300 text-gray-700">
                    Cancelados / Estornados / Falhos
                  </td>
                  <td className="p-2 text-center border-r border-gray-300 print:border-gray-300 font-mono text-gray-700">
                    {analytics.cancelledOrdersCount} ped.
                  </td>
                  <td className="p-2 text-right font-mono text-gray-700">
                    {formatCurrency(analytics.cancelledAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. Bloco 1: Evolução de Faturamento no Período (Gráfico SVG Nativo - Visível na UI e no PDF A4) */}
      <div className="bg-[#0a0e1a] border border-gray-800/80 rounded-2xl p-6 print:block print:w-full print:mb-8 print:bg-white print:border-gray-300 print:shadow-none print:rounded-none print:p-4 print:break-inside-avoid">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 print:mb-3">
          <div>
            <h2 className="text-base font-bold text-gray-100 print:text-black print:text-xs print:uppercase print:font-mono flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400 print:text-black" />
              <span>Evolução de Faturamento Confirmado</span>
            </h2>
            <p className="text-xs text-gray-400 print:text-gray-800 mt-0.5">
              Curva de receita paga e volume de pedidos agrupados por{' '}
              {dateRange.granularity === 'HOUR'
                ? 'faixa horária'
                : dateRange.granularity === 'DAY'
                  ? 'dia'
                  : 'mês'}{' '}
              no período selecionado
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm bg-gradient-to-t from-cyan-600 to-emerald-400 inline-block print:color-adjust-exact"
                style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
              />
              <span className="text-gray-300 print:text-black">Receita Paga (R$)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full bg-cyan-300 print:bg-cyan-600 inline-block print:color-adjust-exact"
                style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
              />
              <span className="text-gray-400 print:text-gray-800">
                Pico: {formatCurrency(chartSeries.maxRevenue)}
              </span>
            </div>
          </div>
        </div>

        {/* SVG Chart Responsivo */}
        <div className="w-full overflow-x-auto print:overflow-visible">
          <div className="min-w-[640px] print:min-w-0 print:w-full">
            <svg
              viewBox="0 0 900 260"
              className="w-full h-64 print:h-52 overflow-visible print:overflow-visible print:color-adjust-exact"
              style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
              role="img"
              aria-label="Gráfico de evolução de faturamento no período"
            >
              <defs>
                <linearGradient id="financeBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#0891b2" stopOpacity="0.55" />
                </linearGradient>
                <linearGradient id="financeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Linhas horizontais de grade */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = 20 + ratio * 190
                const val = chartSeries.maxRevenue * (1 - ratio)
                return (
                  <g key={idx}>
                    <line
                      x1={65}
                      y1={y}
                      x2={885}
                      y2={y}
                      stroke="#94a3b8"
                      strokeOpacity="0.35"
                      strokeDasharray={ratio === 1 ? undefined : '4 4'}
                      strokeWidth="1"
                    />
                    <text
                      x={58}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-gray-400 print:fill-gray-800 print:text-gray-800 text-[10px] font-mono"
                    >
                      {val >= 1000 ? `R$${(val / 1000).toFixed(1)}k` : `R$${Math.round(val)}`}
                    </text>
                  </g>
                )
              })}

              {/* Área e Linha Suave + Barras */}
              {(() => {
                const count = Math.max(chartSeries.buckets.length, 1)
                const chartWidth = 810
                const startX = 70
                const baseY = 210
                const chartHeight = 190
                const stepX = chartWidth / count
                const barWidth = Math.max(6, Math.min(28, stepX * 0.58))

                const points = chartSeries.buckets.map((b, i) => {
                  const cx = startX + i * stepX + stepX / 2
                  const ratio = chartSeries.maxRevenue > 0 ? b.revenue / chartSeries.maxRevenue : 0
                  const cy = baseY - ratio * chartHeight
                  return { cx, cy, bucket: b }
                })

                const polylinePoints = points.map((p) => `${p.cx},${p.cy}`).join(' ')
                const areaPath =
                  points.length > 1
                    ? `M ${points[0].cx},${baseY} L ${points
                        .map((p) => `${p.cx},${p.cy}`)
                        .join(' L ')} L ${points[points.length - 1].cx},${baseY} Z`
                    : ''

                const labelStride = count > 20 ? 3 : count > 12 ? 2 : 1

                return (
                  <>
                    {areaPath && <path d={areaPath} fill="url(#financeAreaGrad)" />}
                    {points.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#0891b2"
                        strokeWidth="2.2"
                        points={polylinePoints}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {points.map(({ cx, cy, bucket }, idx) => {
                      const barH = Math.max(baseY - cy, bucket.revenue > 0 ? 4 : 1)
                      const barY = baseY - barH
                      const showLabel = idx % labelStride === 0 || idx === count - 1

                      return (
                        <g key={bucket.key} className="group">
                          <rect
                            x={cx - barWidth / 2}
                            y={barY}
                            width={barWidth}
                            height={barH}
                            rx={3}
                            fill={bucket.revenue > 0 ? 'url(#financeBarGrad)' : '#cbd5e1'}
                            fillOpacity={bucket.revenue > 0 ? 0.95 : 0.35}
                            className="transition-opacity duration-200 group-hover:opacity-100"
                          >
                            <title>
                              {`${bucket.label}: ${formatCurrency(bucket.revenue)} (${bucket.ordersCount} pedido(s) pago(s))`}
                            </title>
                          </rect>

                          {bucket.revenue > 0 && (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={3.5}
                              className="fill-emerald-400 print:fill-emerald-600 stroke-[#0a0e1a] print:stroke-white stroke-2"
                            >
                              <title>
                                {`${bucket.label}: ${formatCurrency(bucket.revenue)} (${bucket.ordersCount} pedido(s))`}
                              </title>
                            </circle>
                          )}

                          {showLabel && (
                            <text
                              x={cx}
                              y={232}
                              textAnchor="middle"
                              className="fill-gray-400 print:fill-black print:text-black text-[10px] font-mono"
                            >
                              {bucket.label}
                            </text>
                          )}
                        </g>
                      )
                    })}
                  </>
                )
              })()}
            </svg>
          </div>
        </div>
      </div>

      {/* Bloco 2: Origem dos Ganhos & Modalidade de Produção (Grid de 2 Colunas) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
        {/* Card Origem dos Ganhos */}
        <div className="bg-[#0a0e1a] border border-gray-800/80 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-gray-800/80 pb-3.5">
            <div>
              <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-cyan-400" />
                <span>Origem dos Ganhos &amp; Canais</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Marketplace (Site) vs. Clientes Externos (Venda Assistida) e Catálogo vs. Personalizados
              </p>
            </div>
          </div>

          {/* Donut SVG + Resumo Lateral */}
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative w-36 h-36 shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle
                  cx="18"
                  cy="18"
                  r="15.9155"
                  fill="transparent"
                  stroke="#1e293b"
                  strokeWidth="3.8"
                />
                {/* Arco Marketplace */}
                <circle
                  cx="18"
                  cy="18"
                  r="15.9155"
                  fill="transparent"
                  stroke="#22d3ee"
                  strokeWidth="3.8"
                  strokeDasharray={`${originDonutData.mktPct} ${100 - originDonutData.mktPct}`}
                  strokeDashoffset="0"
                />
                {/* Arco Venda Assistida */}
                <circle
                  cx="18"
                  cy="18"
                  r="15.9155"
                  fill="transparent"
                  stroke="#818cf8"
                  strokeWidth="3.8"
                  strokeDasharray={`${originDonutData.assPct} ${100 - originDonutData.assPct}`}
                  strokeDashoffset={`-${originDonutData.mktPct}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] text-gray-400 uppercase font-mono">Pagos</span>
                <span className="text-xs font-bold text-gray-100 font-mono">
                  {analytics.paidOrdersCount} ped.
                </span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-3">
              {/* Barra Marketplace */}
              <div className="p-3 rounded-xl bg-[#050811]/70 border border-gray-800/80">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5" />
                    Marketplace (Site)
                  </span>
                  <span className="font-mono font-bold text-gray-100">
                    {formatCurrency(analytics.marketplaceRevenue)} (
                    {Math.round(originDonutData.mktPct)}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 rounded-full"
                    style={{ width: `${Math.min(100, originDonutData.mktPct)}%` }}
                  />
                </div>
              </div>

              {/* Barra Venda Assistida + Subcanais */}
              <div className="p-3 rounded-xl bg-[#050811]/70 border border-gray-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Venda Assistida (Externo)
                  </span>
                  <span className="font-mono font-bold text-gray-100">
                    {formatCurrency(analytics.assistedRevenue)} (
                    {Math.round(originDonutData.assPct)}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-400 rounded-full"
                    style={{ width: `${Math.min(100, originDonutData.assPct)}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-1.5 pt-1 text-[10px] font-mono text-gray-400">
                  <div className="bg-[#0a0e1a] px-2 py-1 rounded border border-gray-800/70">
                    <span className="block text-emerald-400 font-bold">WhatsApp</span>
                    <span>{formatCurrency(analytics.assistedSubChannels.WhatsApp.revenue)}</span>
                  </div>
                  <div className="bg-[#0a0e1a] px-2 py-1 rounded border border-gray-800/70">
                    <span className="block text-pink-400 font-bold">Instagram</span>
                    <span>{formatCurrency(analytics.assistedSubChannels.Instagram.revenue)}</span>
                  </div>
                  <div className="bg-[#0a0e1a] px-2 py-1 rounded border border-gray-800/70">
                    <span className="block text-amber-300 font-bold">Balcão/Outro</span>
                    <span>
                      {formatCurrency(analytics.assistedSubChannels['Balcão / Outro'].revenue)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Comparativo Itens de Catálogo vs. Personalizados */}
          <div className="pt-3 border-t border-gray-800/80 grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-[#050811]/60 border border-gray-800/80">
              <span className="text-[11px] text-gray-400 font-mono block">Itens de Catálogo</span>
              <span className="text-sm font-bold text-cyan-300 font-mono mt-0.5 block">
                {formatCurrency(analytics.catalogRevenue)}
              </span>
              <span className="text-[10px] text-gray-500 font-mono">
                {analytics.catalogUnits} un. vendidas
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#050811]/60 border border-gray-800/80">
              <span className="text-[11px] text-gray-400 font-mono block">
                Projetos Personalizados
              </span>
              <span className="text-sm font-bold text-purple-300 font-mono mt-0.5 block">
                {formatCurrency(analytics.customRevenue)}
              </span>
              <span className="text-[10px] text-gray-500 font-mono">
                {analytics.customUnits} un. sob medida
              </span>
            </div>
          </div>
        </div>

        {/* Card Pronta Entrega vs. Sob Encomenda */}
        <div className="bg-[#0a0e1a] border border-gray-800/80 rounded-2xl p-6 space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-gray-800/80 pb-3.5 mb-5">
              <div>
                <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-400" />
                  <span>Pronta Entrega vs. Sob Encomenda</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Proporção de faturamento de peças e volume de fabricação (un. e %)
                </p>
              </div>
            </div>

            {(() => {
              const totalModRevenue = Math.max(
                analytics.readyStockRevenue + analytics.madeToOrderRevenue,
                0.01
              )
              const hasSales = analytics.readyStockRevenue + analytics.madeToOrderRevenue > 0
              const readyRevPct = hasSales
                ? Math.round((analytics.readyStockRevenue / totalModRevenue) * 100)
                : 50
              const mtoRevPct = hasSales ? 100 - readyRevPct : 50

              const totalModUnits = Math.max(
                analytics.readyStockUnits + analytics.madeToOrderUnits,
                1
              )
              const hasUnits = analytics.readyStockUnits + analytics.madeToOrderUnits > 0
              const readyUnitsPct = hasUnits
                ? Math.round((analytics.readyStockUnits / totalModUnits) * 100)
                : 50
              const mtoUnitsPct = hasUnits ? 100 - readyUnitsPct : 50

              return (
                <div className="space-y-5">
                  {/* Cards Lado a Lado */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-[#050811]/70 border border-emerald-900/40">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-400 uppercase font-mono">
                          Pronta Entrega
                        </span>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          {hasSales ? `${readyRevPct}%` : '0%'}
                        </span>
                      </div>
                      <p className="text-xl font-bold text-gray-100 font-mono mt-2">
                        {formatCurrency(analytics.readyStockRevenue)}
                      </p>
                      <p className="text-xs text-gray-400 font-mono mt-1">
                        {analytics.readyStockUnits} peças ({hasUnits ? `${readyUnitsPct}%` : '0%'}{' '}
                        do volume)
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-[#050811]/70 border border-amber-900/40">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-400 uppercase font-mono">
                          Sob Encomenda
                        </span>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          {hasSales ? `${mtoRevPct}%` : '0%'}
                        </span>
                      </div>
                      <p className="text-xl font-bold text-gray-100 font-mono mt-2">
                        {formatCurrency(analytics.madeToOrderRevenue)}
                      </p>
                      <p className="text-xs text-gray-400 font-mono mt-1">
                        {analytics.madeToOrderUnits} peças ({hasUnits ? `${mtoUnitsPct}%` : '0%'}{' '}
                        do volume)
                      </p>
                    </div>
                  </div>

                  {/* Barra Comparativa de Receita */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-emerald-400">
                        Receita Pronta Entrega ({hasSales ? readyRevPct : 0}%)
                      </span>
                      <span className="text-amber-400">
                        Receita Sob Encomenda ({hasSales ? mtoRevPct : 0}%)
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-gray-800 overflow-hidden flex">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${readyRevPct}%` }}
                      />
                      <div
                        className="h-full bg-amber-500 transition-all duration-300"
                        style={{ width: `${mtoRevPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Barra Comparativa de Unidades */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-teal-300">
                        Volume Físico: {analytics.readyStockUnits} un. ({hasUnits ? readyUnitsPct : 0}%)
                      </span>
                      <span className="text-orange-300">
                        Fila 3D: {analytics.madeToOrderUnits} un. ({hasUnits ? mtoUnitsPct : 0}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-gray-800 overflow-hidden flex">
                      <div
                        className="h-full bg-teal-400 transition-all duration-300"
                        style={{ width: `${readyUnitsPct}%` }}
                      />
                      <div
                        className="h-full bg-orange-400 transition-all duration-300"
                        style={{ width: `${mtoUnitsPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>

          <div className="p-3 rounded-xl bg-[#050811]/60 border border-gray-800/80 text-[11px] text-gray-400 flex items-center justify-between">
            <span>Frete arrecadado no período:</span>
            <span className="font-mono font-bold text-cyan-300">
              {formatCurrency(analytics.shippingRevenue)}
            </span>
          </div>
        </div>
      </div>

      {/* Bloco 3: Produtos Mais Vendidos, Categorias e Consumo Geográfico (Grid de 3 Colunas) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        {/* Card Top Produtos Mais Vendidos */}
        <div className="bg-[#0a0e1a] border border-gray-800/80 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
            <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
              <Award className="w-4 h-4 text-cyan-400" />
              <span>Top Produtos Mais Vendidos</span>
            </h3>
            <span className="text-[10px] font-mono text-gray-400 uppercase">Por Receita</span>
          </div>

          {analytics.topProducts.length === 0 ? (
            <div className="py-10 text-center text-xs text-gray-500">
              Nenhum produto pago registrado neste período.
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.topProducts.map((prod, idx) => {
                const maxProdRev = Math.max(analytics.topProducts[0]?.revenue || 1, 1)
                const pct = Math.round((prod.revenue / maxProdRev) * 100)
                return (
                  <div key={prod.title + idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                          #{idx + 1}
                        </span>
                        <span className="text-gray-200 font-medium truncate" title={prod.title}>
                          {prod.title}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-emerald-400 shrink-0">
                        {formatCurrency(prod.revenue)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-gray-400 shrink-0 w-14 text-right">
                        {prod.units} un.
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Card Preferência por Categoria */}
        <div className="bg-[#0a0e1a] border border-gray-800/80 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
            <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Preferência por Categoria</span>
            </h3>
            <span className="text-[10px] font-mono text-gray-400 uppercase">Volume &amp; R$</span>
          </div>

          {analytics.topCategories.length === 0 ? (
            <div className="py-10 text-center text-xs text-gray-500">
              Nenhuma categoria movimentada neste período.
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.topCategories.map((cat, idx) => {
                const maxCatRev = Math.max(analytics.topCategories[0]?.revenue || 1, 1)
                const pct = Math.round((cat.revenue / maxCatRev) * 100)
                return (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-gray-200 font-semibold truncate">
                        {idx + 1}. {cat.category}
                      </span>
                      <span className="font-mono font-bold text-indigo-300 shrink-0">
                        {formatCurrency(cat.revenue)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-gray-400 shrink-0 w-14 text-right">
                        {cat.units} pç(s)
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Card Regiões que Mais Consomem */}
        <div className="bg-[#0a0e1a] border border-gray-800/80 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
            <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-400" />
              <span>Regiões que Mais Consomem</span>
            </h3>
            <span className="text-[10px] font-mono text-gray-400 uppercase">Cidade / UF</span>
          </div>

          {analytics.topRegions.length === 0 ? (
            <div className="py-10 text-center text-xs text-gray-500">
              Sem dados geográficos de vendas pagas no período.
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.topRegions.map((reg) => {
                const maxRegRev = Math.max(analytics.topRegions[0]?.revenue || 1, 1)
                const pct = Math.round((reg.revenue / maxRegRev) * 100)
                return (
                  <div key={reg.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-gray-200 font-medium truncate" title={reg.label}>
                          {reg.label}
                        </span>
                        {reg.isLocal && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-teal-500/15 text-teal-300 border border-teal-500/30 shrink-0">
                            Local
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-teal-300 shrink-0">
                        {formatCurrency(reg.revenue)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-gray-400 shrink-0 w-16 text-right">
                        {reg.ordersCount} ped.
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* D. LIVRO-RAZÃO / EXTRATO AUDITÁVEL DE VENDAS (OCULTO NA IMPRESSÃO) */}
      <div className="space-y-4 print:hidden">
        {/* Barra de Pesquisa e Filtro Rápido de Status */}
        <div className="bg-[#0a0e1a] border border-gray-800/80 rounded-2xl p-2 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={ledgerSearch}
              onChange={(e) => setLedgerSearch(e.target.value)}
              placeholder="Buscar no extrato por ID, cliente, e-mail, cidade, canal ou produto..."
              aria-label="Buscar no livro-razão financeiro"
              className="w-full bg-[#050811]/60 border border-gray-800/80 rounded-xl pl-9 pr-8 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-800/70"
            />
            {ledgerSearch && (
              <button
                type="button"
                onClick={() => setLedgerSearch('')}
                aria-label="Limpar pesquisa do extrato"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="bg-[#050811]/60 border border-gray-800/80 rounded-xl p-1 flex items-center gap-1 flex-wrap">
            {(
              [
                {
                  id: 'ALL',
                  label: 'Todos',
                  count: periodOrders.length,
                  icon: <Layers className="w-3.5 h-3.5" />,
                },
                {
                  id: 'PAID',
                  label: 'Pagos',
                  count: analytics.paidOrdersCount,
                  icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
                },
                {
                  id: 'PENDING',
                  label: 'Aguardando',
                  count: analytics.pendingOrdersCount,
                  icon: <Clock className="w-3.5 h-3.5 text-amber-400" />,
                },
                {
                  id: 'CANCELLED',
                  label: 'Cancelados',
                  count: analytics.cancelledOrdersCount,
                  icon: <XCircle className="w-3.5 h-3.5 text-rose-400" />,
                },
              ] as const
            ).map((tab) => {
              const active = ledgerStatus === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLedgerStatus(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-cyan-950/50 border-cyan-500/40 text-cyan-300 shadow-sm'
                      : 'bg-transparent border-transparent text-gray-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {tab.icon}
                  <span>
                    {tab.label} ({tab.count})
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Tabela do Livro-Razão Unificada */}
        <div className="space-y-3">
          <div className="px-1 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-100">
                Livro-Razão / Extrato Auditável de Vendas
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Exibindo {filteredLedgerOrders.length} lançamento(s) do período selecionado
              </p>
            </div>
          </div>

          <Admin_Orders_Table
            orders={filteredLedgerOrders}
            mode="finance"
            emptyTitle="Nenhum lançamento financeiro encontrado para os filtros aplicados neste período."
            emptySubtitle=""
          />
        </div>
      </div>

      {/* MODAL EXECUTIVO DE FECHAMENTO DE CAIXA (TELA - OCULTO NA IMPRESSÃO) */}
      {isReportModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="executive-report-title"
        >
          <div className="bg-[#0a0e1a] border border-gray-800 rounded-2xl max-w-4xl w-full p-6 sm:p-8 space-y-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-gray-800 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold">
                  Lúmen 3D • Fechamento Contábil e Gerencial
                </span>
                <h2 id="executive-report-title" className="text-xl font-black text-gray-100 mt-1">
                  Relatório Contábil e Gerencial de Caixa
                </h2>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  Período: {dateRange.label} • {periodOrders.length} pedido(s) incluído(s) no PDF
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                aria-label="Fechar relatório"
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/80 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumo Executivo de Métricas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-[#050811] border border-gray-800">
                <span className="text-[10px] text-gray-400 uppercase font-mono block">
                  Receita Bruta Paga
                </span>
                <span className="text-lg font-bold text-emerald-400 font-mono mt-1 block">
                  {formatCurrency(analytics.grossRevenue)}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#050811] border border-gray-800">
                <span className="text-[10px] text-gray-400 uppercase font-mono block">
                  Receita Líquida Peças
                </span>
                <span className="text-lg font-bold text-cyan-300 font-mono mt-1 block">
                  {formatCurrency(analytics.itemsRevenue)}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#050811] border border-gray-800">
                <span className="text-[10px] text-gray-400 uppercase font-mono block">
                  Frete Total
                </span>
                <span className="text-lg font-bold text-gray-200 font-mono mt-1 block">
                  {formatCurrency(analytics.shippingRevenue)}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#050811] border border-gray-800">
                <span className="text-[10px] text-gray-400 uppercase font-mono block">
                  Ticket Médio
                </span>
                <span className="text-lg font-bold text-indigo-300 font-mono mt-1 block">
                  {formatCurrency(analytics.averageTicket)}
                </span>
              </div>
            </div>

            {/* Quebra por Canal e Modalidade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#050811]/90 border border-gray-800 space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
                  Quebra por Canal de Venda
                </h3>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-300">Marketplace (Site Oficial):</span>
                  <span className="font-mono font-bold text-gray-100">
                    {formatCurrency(analytics.marketplaceRevenue)} (
                    {analytics.marketplaceOrdersCount} ped.)
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-300">Venda Assistida (Total):</span>
                  <span className="font-mono font-bold text-gray-100">
                    {formatCurrency(analytics.assistedRevenue)} ({analytics.assistedOrdersCount}{' '}
                    ped.)
                  </span>
                </div>
                <div className="pl-3 border-l border-gray-800 space-y-1 text-[11px] text-gray-400 font-mono">
                  <div className="flex justify-between">
                    <span>• WhatsApp:</span>
                    <span>{formatCurrency(analytics.assistedSubChannels.WhatsApp.revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Instagram:</span>
                    <span>{formatCurrency(analytics.assistedSubChannels.Instagram.revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Balcão / Outro:</span>
                    <span>
                      {formatCurrency(analytics.assistedSubChannels['Balcão / Outro'].revenue)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#050811]/90 border border-gray-800 space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
                  Quebra por Modalidade &amp; Status
                </h3>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-300">Pronta Entrega ({analytics.readyStockUnits} un.):</span>
                  <span className="font-mono font-bold text-emerald-300">
                    {formatCurrency(analytics.readyStockRevenue)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-300">
                    Sob Encomenda ({analytics.madeToOrderUnits} un.):
                  </span>
                  <span className="font-mono font-bold text-amber-300">
                    {formatCurrency(analytics.madeToOrderRevenue)}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-800/80 flex justify-between text-xs">
                  <span className="text-amber-400">Em Aberto (Aguardando):</span>
                  <span className="font-mono font-bold text-amber-300">
                    {formatCurrency(analytics.pendingAmount)} ({analytics.pendingOrdersCount} ped.)
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-rose-400">Cancelados / Estornados:</span>
                  <span className="font-mono font-bold text-rose-300">
                    {formatCurrency(analytics.cancelledAmount)} ({analytics.cancelledOrdersCount}{' '}
                    ped.)
                  </span>
                </div>
              </div>
            </div>
            
            {/* Ações do Modal */}
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-800 text-xs font-semibold transition cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-cyan-950/50 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir / Salvar PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PARTE INFERIOR DO DOCUMENTO A4 PARA IMPRESSÃO / PDF (5. Livro-Razão Completo + Rodapé) */}
      <div className="hidden print:block print:w-full print:bg-white print:text-black print:m-0 print:p-0 print:shadow-none print:rounded-none">
        {/* 5. Listagem Completa (Livro-Razão Contábil de Todos os Pedidos do Período) */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800 mb-2 font-mono">
            5. Livro-Razão Completo de Lançamentos ({periodOrders.length} pedidos no período)
          </h2>

          {periodOrders.length === 0 ? (
            <div className="p-4 border border-gray-300 text-center text-xs text-gray-600">
              Nenhum pedido registrado no período selecionado.
            </div>
          ) : (
            <table className="w-full border-collapse border border-gray-200 print:border print:border-gray-200 print:text-xs text-xs">
              <thead>
                <tr className="border-b-2 border-gray-400 text-[10px] uppercase font-mono text-black">
                  <th className="p-1.5 text-left border border-gray-200 print:border print:border-gray-200">
                    Data
                  </th>
                  <th className="p-1.5 text-left border border-gray-200 print:border print:border-gray-200">
                    ID
                  </th>
                  <th className="p-1.5 text-left border border-gray-200 print:border print:border-gray-200">
                    Cliente / Local
                  </th>
                  <th className="p-1.5 text-left border border-gray-200 print:border print:border-gray-200">
                    Canal
                  </th>
                  <th className="p-1.5 text-left border border-gray-200 print:border print:border-gray-200">
                    Produtos / Qtd
                  </th>
                  <th className="p-1.5 text-right border border-gray-200 print:border print:border-gray-200">
                    Valor
                  </th>
                  <th className="p-1.5 text-center border border-gray-200 print:border print:border-gray-200">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {periodOrders.map((order) => {
                  const normalized = normalizeAdminOrder(order)
                  const loc = normalized.location
                  const origin = normalized.origin
                  const isCancelled = normalized.isCancelled
                  const statusLabel = isCancelled
                    ? 'CANCELADO'
                    : order.paymentStatus === 'PAID'
                      ? 'PAGO'
                      : order.paymentStatus === 'PENDING'
                        ? 'AGUARDANDO'
                        : order.paymentStatus === 'REFUNDED'
                          ? 'ESTORNADO'
                          : 'RECUSADO'

                  return (
                    <tr
                      key={order.id}
                      className="border-b border-gray-200 print:border print:border-gray-200 print:break-inside-avoid align-top"
                    >
                      <td className="p-1.5 border border-gray-200 print:border print:border-gray-200 font-mono text-[11px] text-black whitespace-nowrap">
                        {normalized.dateFormatted}
                        <span className="block text-[10px] text-gray-600">
                          {normalized.timeFormatted}
                        </span>
                      </td>
                      <td className="p-1.5 border border-gray-200 print:border print:border-gray-200 font-mono font-bold text-[11px] text-black whitespace-nowrap">
                        #{normalized.shortId}
                      </td>
                      <td className="p-1.5 border border-gray-200 print:border print:border-gray-200 text-[11px] text-black">
                        <span className="font-semibold block">
                          {normalized.clientName}
                        </span>
                        <span className="text-[10px] text-gray-600 block">
                          {normalized.clientEmail}
                        </span>
                        <span className="text-[10px] text-gray-700 font-mono block">
                          {loc.label}
                        </span>
                      </td>
                      <td className="p-1.5 border border-gray-200 print:border print:border-gray-200 text-[11px] text-black whitespace-nowrap">
                        {origin}
                      </td>
                      <td className="p-1.5 border border-gray-200 print:border print:border-gray-200 text-[11px] text-black">
                        {order.items.map((item) => (
                          <div key={item.id} className="leading-snug mb-0.5 last:mb-0">
                            <span className="font-mono font-semibold">{item.quantity}x</span>{' '}
                            <span>{item.productTitle}</span>{' '}
                            <span className="text-[10px] text-gray-600 font-mono">
                              ({item.isMadeToOrder ? 'Encomenda' : 'Pronta'} •{' '}
                              {formatCurrency(item.priceUnit)})
                            </span>
                          </div>
                        ))}
                      </td>
                      <td className="p-1.5 border border-gray-200 print:border print:border-gray-200 text-right font-mono text-[11px] text-black whitespace-nowrap">
                        <span className="font-bold block">{formatCurrency(normalized.grandTotal)}</span>
                        {normalized.shippingCost > 0 && (
                          <span className="text-[10px] text-gray-600 block">
                            (Frete: {formatCurrency(normalized.shippingCost)})
                          </span>
                        )}
                      </td>
                      <td className="p-1.5 border border-gray-200 print:border print:border-gray-200 text-center font-mono text-[10px] font-bold text-black whitespace-nowrap">
                        {statusLabel}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-800 font-mono text-xs font-bold text-black print:break-inside-avoid">
                  <td
                    colSpan={5}
                    className="p-2 text-right border border-gray-200 print:border print:border-gray-200 uppercase"
                  >
                    Total Confirmado (Pedidos Pagos no Período):
                  </td>
                  <td className="p-2 text-right border border-gray-200 print:border print:border-gray-200">
                    {formatCurrency(analytics.grossRevenue)}
                  </td>
                  <td className="p-2 text-center border border-gray-200 print:border print:border-gray-200 text-[10px]">
                    {analytics.paidOrdersCount} PAGOS
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Rodapé de Autenticação Contábil */}
        <div className="mt-8 pt-4 border-t border-gray-300 flex items-center justify-between text-[10px] text-gray-600 font-mono print:break-inside-avoid">
          <span>Lúmen 3D • Sistema Interno de Gestão e Auditoria Financeira</span>
          <span>Documento gerado eletronicamente • Uso interno e contábil</span>
        </div>
      </div>
    </div>
  )
}
