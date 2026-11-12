'use server'

import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export interface ActionResponse<T> {
  success: boolean
  data?: T
  error?: string | null
}

const exportSalesFilterSchema = z
  .object({
    period: z.enum(['THIS_MONTH', 'ALL']).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .optional()

export type ExportSalesFilterInput = z.infer<typeof exportSalesFilterSchema>

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = String(value ?? '')
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function exportRecentSalesCSVAction(
  filterInput?: ExportSalesFilterInput
): Promise<ActionResponse<{ csv: string; filename: string }>> {
  try {
    await requireAdmin()

    const parsed = exportSalesFilterSchema.safeParse(filterInput)
    const validFilter = parsed.success ? parsed.data : undefined

    let createdAtFilter: { gte?: Date; lte?: Date } | undefined

    if (validFilter?.startDate || validFilter?.endDate) {
      const start = validFilter.startDate ? new Date(validFilter.startDate) : undefined
      const end = validFilter.endDate ? new Date(validFilter.endDate) : undefined
      createdAtFilter = {
        ...(start && !isNaN(start.getTime()) ? { gte: start } : {}),
        ...(end && !isNaN(end.getTime()) ? { lte: end } : {}),
      }
    } else if (validFilter?.period === 'THIS_MONTH') {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      createdAtFilter = { gte: startOfMonth, lte: endOfMonth }
    }

    const orders = await prisma.order.findMany({
      where: createdAtFilter ? { createdAt: createdAtFilter } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            username: true,
            email: true,
            addresses: {
              select: {
                city: true,
                state: true,
                zipCode: true,
                isDefault: true,
              },
            },
          },
        },
        items: {
          select: {
            productTitle: true,
            quantity: true,
            priceUnit: true,
            isMadeToOrder: true,
          },
        },
      },
    })

    const headers = [
      'ID_Pedido',
      'Data_Criacao',
      'Status_Pagamento',
      'Status_Logistica',
      'Cliente',
      'Email',
      'Canal_Origem',
      'Modalidade',
      'Qtd_Pecas',
      'Subtotal_Pecas_BRL',
      'Frete_BRL',
      'Total_BRL',
      'Itens_Resumo',
    ]

    const rows = orders.map((o) => {
      const totalAmount = Number(o.totalAmount)
      const shippingCost = Number(o.shippingCost)
      const itemsSubtotal = Math.max(0, totalAmount - shippingCost)
      const totalUnits = o.items.reduce((acc, i) => acc + i.quantity, 0)
      const hasMadeToOrder = o.items.some((i) => i.isMadeToOrder)
      const origin = o.isAssistedSale
        ? o.adminNotes?.includes('[Origem: Instagram]')
          ? 'Instagram'
          : o.adminNotes?.includes('[Origem: Outro]')
            ? 'Balcão / Outro'
            : 'WhatsApp'
        : 'Marketplace'

      const clientName = o.user?.name || o.user?.username || 'Cliente Externo'
      const clientEmail = o.user?.email || o.assistedSaleExpectedEmail || ''
      const itemsSummary = o.items.map((i) => `${i.quantity}x ${i.productTitle}`).join(' | ')

      return [
        o.id,
        o.createdAt.toLocaleString('pt-BR'),
        o.paymentStatus,
        o.logisticsStatus,
        clientName,
        clientEmail,
        origin,
        hasMadeToOrder ? 'Sob Encomenda' : 'Pronta Entrega',
        totalUnits,
        itemsSubtotal.toFixed(2).replace('.', ','),
        shippingCost.toFixed(2).replace('.', ','),
        totalAmount.toFixed(2).replace('.', ','),
        itemsSummary,
      ]
        .map(escapeCsvCell)
        .join(';')
    })

    const csv = '\uFEFF' + [headers.join(';'), ...rows].join('\n')
    const filename = `lumen3d-vendas-brutas-${new Date().toISOString().slice(0, 10)}.csv`

    return { success: true, data: { csv, filename } }
  } catch (error) {
    console.error('Erro ao exportar vendas brutas em CSV:', error)
    return {
      success: false,
      error: 'Não foi possível exportar as vendas em CSV no momento.',
    }
  }
}

export async function exportProductsCSVAction(): Promise<
  ActionResponse<{ csv: string; filename: string }>
> {
  try {
    await requireAdmin()

    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
    })

    const headers = [
      'ID',
      'Titulo',
      'Slug',
      'Categoria',
      'Preco_BRL',
      'Modalidade',
      'Estoque_Fisico',
      'Estoque_Reservado',
      'Prazo_Producao_Dias',
      'Peso_Gramas',
      'Dimensoes',
      'Destaque',
      'Status_Catalogo',
      'Criado_Em',
    ]

    const rows = products.map((p) =>
      [
        p.id,
        p.title,
        p.slug,
        p.category,
        Number(p.price).toFixed(2).replace('.', ','),
        p.isMadeToOrder ? 'Sob Encomenda' : 'Pronta Entrega',
        p.stock,
        p.reservedStock ?? 0,
        p.productionDays ?? 0,
        p.weightGrams ?? 0,
        p.dimensions ?? '',
        p.isFeatured ? 'Sim' : 'Não',
        p.archivedAt ? 'Arquivado' : 'Ativo',
        p.createdAt.toLocaleDateString('pt-BR'),
      ]
        .map(escapeCsvCell)
        .join(';')
    )

    const csv = '\uFEFF' + [headers.join(';'), ...rows].join('\n')
    const filename = `lumen3d-produtos-${new Date().toISOString().slice(0, 10)}.csv`

    return { success: true, data: { csv, filename } }
  } catch (error) {
    console.error('Erro ao exportar produtos em CSV:', error)
    return {
      success: false,
      error: 'Não foi possível exportar o catálogo de produtos em CSV.',
    }
  }
}

export async function exportFilamentsCSVAction(): Promise<
  ActionResponse<{ csv: string; filename: string }>
> {
  try {
    await requireAdmin()

    const filaments = await prisma.filamentStock.findMany({
      orderBy: { createdAt: 'desc' },
    })

    const headers = [
      'ID',
      'Material',
      'Cor',
      'Hex_Color',
      'Peso_Carretel_Kg',
      'Saldo_Restante_Gramas',
      'Alerta_Minimo_Gramas',
      'Situacao',
      'Criado_Em',
    ]

    const rows = filaments.map((f) =>
      [
        f.id,
        f.material,
        f.color,
        f.hexColor ?? '',
        f.spoolWeightKg.toFixed(2).replace('.', ','),
        Math.round(f.remainingGrams),
        Math.round(f.minThresholdGrams),
        f.remainingGrams <= f.minThresholdGrams ? 'ALERTA BAIXO' : 'NORMAL',
        f.createdAt.toLocaleDateString('pt-BR'),
      ]
        .map(escapeCsvCell)
        .join(';')
    )

    const csv = '\uFEFF' + [headers.join(';'), ...rows].join('\n')
    const filename = `lumen3d-filamentos-${new Date().toISOString().slice(0, 10)}.csv`

    return { success: true, data: { csv, filename } }
  } catch (error) {
    console.error('Erro ao exportar filamentos em CSV:', error)
    return {
      success: false,
      error: 'Não foi possível exportar o inventário de filamentos em CSV.',
    }
  }
}
