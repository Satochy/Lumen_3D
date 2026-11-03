'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { activeProducts } from '@/lib/product_helpers'

export interface CatalogProductOption {
  id: string
  title: string
  slug: string
  price: number
  stock: number
  availableStock: number
  isMadeToOrder: boolean
  productionDays: number | null
  category: string
  images: string[]
}

const assistedSaleItemInputSchema = z.object({
  productId: z.string().uuid().nullable().optional(),
  productTitle: z.string().trim().optional(),
  title: z.string().trim().optional(),
  quantity: z.number().int('Quantidade deve ser inteira.').min(1, 'Quantidade mínima é 1 unidade.'),
  priceUnit: z.number().positive('Preço unitário deve ser estritamente maior que zero.').optional(),
  unitPrice: z.number().positive('Preço unitário deve ser estritamente maior que zero.').optional(),
  productionDays: z.number().int().min(1).nullable().optional(),
})

const createAssistedSaleDraftSchema = z.object({
  expectedEmail: z.string().trim().email('Informe um e-mail válido para o cliente.'),
  origin: z.enum(['WhatsApp', 'Instagram', 'Outro']).default('WhatsApp'),
  adminNotes: z.string().trim().nullable().optional(),
  items: z.array(assistedSaleItemInputSchema).min(1, 'Adicione pelo menos um item ao rascunho.'),
})

/**
 * Retorna os produtos ativos do catálogo para o formulário de venda assistida
 */
export async function getAvailableProductsForAssistedSaleAction(): Promise<{
  success: boolean
  data: CatalogProductOption[]
  error?: string
}> {
  try {
    await requireAdmin()

    const products = await prisma.product.findMany({
      where: activeProducts,
      orderBy: { title: 'asc' },
      select: {
        id: true,
        title: true,
        slug: true,
        price: true,
        stock: true,
        reservedStock: true,
        isMadeToOrder: true,
        productionDays: true,
        category: true,
        images: true,
      },
    })

    const serialized: CatalogProductOption[] = products.map((p) => {
      const reserved = p.reservedStock ?? 0
      const available = Math.max(0, p.stock - reserved)
      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        price: Number(p.price),
        stock: p.stock,
        availableStock: available,
        isMadeToOrder: p.isMadeToOrder,
        productionDays: p.productionDays,
        category: p.category,
        images: p.images,
      }
    })

    return { success: true, data: serialized }
  } catch (error) {
    console.error('Erro ao buscar produtos para venda assistida:', error)
    return { success: false, data: [], error: 'Falha ao buscar produtos.' }
  }
}

/**
 * Criação Administrativa de Rascunho de Pedido (Draft) sem usuário fictício
 */
export async function createAssistedSaleDraftAction(payload: unknown): Promise<{
  success: boolean
  orderId?: string
  checkoutUrl?: string
  error?: string
}> {
  try {
    const admin = await requireAdmin()

    const parsed = createAssistedSaleDraftSchema.safeParse(payload)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Dados inválidos fornecidos para o rascunho.',
      }
    }

    const { expectedEmail, origin, adminNotes, items } = parsed.data

    let totalAmountDecimal = new Prisma.Decimal(0)
    const orderItemsToCreate: Array<{
      productId: string | null
      productTitle: string
      quantity: number
      priceUnit: Prisma.Decimal
      isMadeToOrder: boolean
      productionDays: number | null
      productionStatus: 'QUEUED'
    }> = []

    for (const item of items) {
      const quantity = item.quantity
      let finalPrice = item.priceUnit ?? item.unitPrice ?? 0
      let finalTitle = (item.productTitle || item.title || '').trim()
      let isMadeToOrder = true
      let productionDays: number | null = item.productionDays || 3

      if (item.productId) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        })

        if (!product) {
          return { success: false, error: `Produto do catálogo não encontrado (ID: ${item.productId}).` }
        }

        finalTitle = finalTitle || product.title
        finalPrice = finalPrice > 0 ? finalPrice : Number(product.price)
        isMadeToOrder = product.isMadeToOrder
        productionDays = product.productionDays
      } else {
        if (!finalTitle) {
          return { success: false, error: 'O item personalizado precisa de um título/nome.' }
        }
      }

      // Validação estrita de valores financeiros impeditivos (preço zerado, negativo ou inválido)
      if (isNaN(finalPrice) || finalPrice <= 0) {
        return {
          success: false,
          error: `O preço do item "${finalTitle || 'Personalizado'}" deve ser maior que zero (R$ 0,00 não permitido).`,
        }
      }

      if (quantity <= 0) {
        return {
          success: false,
          error: `A quantidade do item "${finalTitle}" deve ser de no mínimo 1 unidade.`,
        }
      }

      const priceUnitDecimal = new Prisma.Decimal(finalPrice)
      const subtotal = priceUnitDecimal.times(quantity)
      totalAmountDecimal = totalAmountDecimal.plus(subtotal)

      orderItemsToCreate.push({
        productId: item.productId || null,
        productTitle: finalTitle,
        quantity,
        priceUnit: priceUnitDecimal,
        isMadeToOrder,
        productionDays,
        productionStatus: 'QUEUED',
      })
    }

    if (totalAmountDecimal.lte(0)) {
      return {
        success: false,
        error: 'O valor total do rascunho deve ser maior que zero (R$ 0,00 não permitido).',
      }
    }

    const now = new Date()
    const composedNotes = `[Origem: ${origin}] [Criado por ${admin.name || admin.username} em ${now.toLocaleString('pt-BR')}]${
      adminNotes ? ` - Observações: ${adminNotes}` : ''
    }`

    // Criação do pedido com userId nulo (sem usuário fictício)
    const order = await prisma.order.create({
      data: {
        isAssistedSale: true,
        paymentStatus: 'PENDING',
        logisticsStatus: 'PREPARING',
        assistedSaleExpectedEmail: expectedEmail.toLowerCase(),
        totalAmount: totalAmountDecimal,
        shippingCost: new Prisma.Decimal(0.0),
        adminNotes: composedNotes,
        items: {
          create: orderItemsToCreate,
        },
      },
      select: {
        id: true,
      },
    })

    revalidatePath('/admin/assisted-sales')
    revalidatePath('/admin/orders')
    revalidatePath('/admin')

    const baseUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000'
    ).replace(/\/$/, '')

    const checkoutUrl = `${baseUrl}/checkout/assisted/${order.id}`

    return {
      success: true,
      orderId: order.id,
      checkoutUrl,
    }
  } catch (error) {
    console.error('Erro ao criar rascunho de venda assistida:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Falha ao criar rascunho de venda assistida.',
    }
  }
}
