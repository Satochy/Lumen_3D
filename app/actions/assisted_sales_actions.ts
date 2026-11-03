'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, requireAdmin } from '@/lib/auth'
import { activeProducts } from '@/lib/product_helpers'
import { sanitizeCEP, isValidCEP, isLocalShippingRegion } from '@/lib/shipping/shipping_utils'
import { calculateShippingAction, type ShippingOption } from './shipping_actions'

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

    // Criação do pedido com userId nulo (sem usuário fictício) e sem endereço fantasma
    const order = await prisma.order.create({
      data: {
        isAssistedSale: true,
        paymentStatus: 'PENDING',
        logisticsStatus: 'PREPARING',
        assistedSaleExpectedEmail: expectedEmail.toLowerCase(),
        totalAmount: totalAmountDecimal,
        shippingCost: new Prisma.Decimal(0.0),
        shippingAddressSnapshot: Prisma.JsonNull,
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

/**
 * Cotação de frete para o link de venda assistida
 */
export async function calculateAssistedSaleShippingAction(
  orderId: string,
  destinationCep: string
): Promise<{
  success: boolean
  options: ShippingOption[]
  error?: string
}> {
  try {
    const cleanCep = sanitizeCEP(destinationCep)
    if (!isValidCEP(cleanCep)) {
      return { success: false, options: [], error: 'CEP de entrega inválido.' }
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: {
                weightGrams: true,
                dimensions: true,
              },
            },
          },
        },
      },
    })

    if (!order || !order.isAssistedSale) {
      return { success: false, options: [], error: 'Pedido de venda assistida não encontrado.' }
    }

    const shippingItems = order.items.map((item) => ({
      weightGrams: item.product?.weightGrams ?? 200,
      dimensions: item.product?.dimensions || '15x10x5',
      quantity: item.quantity,
    }))

    const quote = await calculateShippingAction(cleanCep, shippingItems)
    if (quote.error) {
      return { success: false, options: [], error: quote.error }
    }

    return { success: true, options: quote.options }
  } catch (error) {
    console.error('Erro ao calcular frete para venda assistida:', error)
    return {
      success: false,
      options: [],
      error: 'Não foi possível calcular as opções de frete no momento.',
    }
  }
}

const unlockAssistedSaleEmailSchema = z.object({
  orderId: z.string().uuid('ID de pedido inválido.'),
  email: z.string().trim().email('Informe um e-mail válido.'),
})

/**
 * Validação e desbloqueio de venda assistida:
 * Valida o e-mail, vincula se a conta existir (ou mantém null), e define cookie HttpOnly para liberar o checkout sem forçar login.
 */
export async function unlockAssistedSaleAction(
  orderId: string,
  email: string
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const parsed = unlockAssistedSaleEmailSchema.safeParse({ orderId, email })
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'E-mail ou ID do pedido inválido.',
      }
    }

    const cleanEmail = parsed.data.email.toLowerCase()

    const order = await prisma.order.findUnique({
      where: { id: parsed.data.orderId },
      select: {
        id: true,
        isAssistedSale: true,
        assistedSaleExpectedEmail: true,
        paymentStatus: true,
        logisticsStatus: true,
        cancelledAt: true,
      },
    })

    if (!order || !order.isAssistedSale) {
      return {
        success: false,
        error: 'Orçamento de venda assistida não encontrado.',
      }
    }

    if (order.cancelledAt || order.logisticsStatus === 'CANCELLED') {
      return {
        success: false,
        error: 'Este orçamento foi cancelado ou expirou.',
      }
    }

    const expected = order.assistedSaleExpectedEmail?.trim().toLowerCase()
    if (!expected || expected !== cleanEmail) {
      return {
        success: false,
        error: 'O e-mail informado não corresponde a este orçamento.',
      }
    }

    // Busca se já existe um usuário com esse e-mail
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true },
    })

    // Vincula silenciosamente se a conta existir, ou mantém anônimo (null) se não
    await prisma.order.update({
      where: { id: order.id },
      data: { userId: user ? user.id : null },
    })

    // Define cookie HttpOnly para liberar o checkout diretamente sem login
    const cookieStore = await cookies()
    cookieStore.set(`unlocked_order_${order.id}`, 'true', {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    })

    return {
      success: true,
    }
  } catch (error) {
    console.error('Erro ao desbloquear venda assistida:', error)
    return {
      success: false,
      error: 'Ocorreu um erro ao verificar o orçamento. Tente novamente.',
    }
  }
}

const saveAssistedShippingSchema = z.object({
  orderId: z.string().uuid(),
  shippingAddress: z.object({
    street: z.string().trim().min(2, 'Informe o logradouro.'),
    number: z.string().trim().min(1, 'Informe o número.'),
    complement: z.string().trim().optional().nullable(),
    neighborhood: z.string().trim().min(2, 'Informe o bairro.'),
    city: z.string().trim().min(2, 'Informe a cidade.'),
    state: z.string().trim().length(2, 'Informe a UF.'),
    zipCode: z.string().transform((v) => sanitizeCEP(v)),
  }),
  selectedShippingOption: z.object({
    serviceId: z.string().trim().min(1),
    serviceName: z.string().trim().min(1),
    price: z.number().nonnegative(),
    isFree: z.boolean().optional(),
    cep: z.string().optional(),
  }),
})

/**
 * Salva endereço e frete para um pedido de venda assistida destrancado por cookie
 */
export async function saveAssistedOrderShippingAction(payload: unknown) {
  try {
    const parsed = saveAssistedShippingSchema.safeParse(payload)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Dados inválidos.' }
    }

    const { orderId, shippingAddress, selectedShippingOption } = parsed.data
    const cookieStore = await cookies()
    const isUnlocked = cookieStore.get(`unlocked_order_${orderId}`)?.value === 'true'
    const currentUser = await getCurrentUser()

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!order || !order.isAssistedSale) {
      return { success: false, error: 'Pedido não encontrado.' }
    }

    const isAuthorized =
      isUnlocked ||
      (currentUser && currentUser.email.toLowerCase() === order.assistedSaleExpectedEmail?.toLowerCase()) ||
      currentUser?.role === 'ADMIN'

    if (!isAuthorized) {
      return { success: false, error: 'Acesso negado a este pedido.' }
    }

    const destinationCep = sanitizeCEP(shippingAddress.zipCode)
    if (!isValidCEP(destinationCep)) {
      return { success: false, error: 'CEP de entrega inválido.' }
    }

    let verifiedShippingCost = new Prisma.Decimal(0)
    let isLocalDelivery = false
    let verifiedServiceName = selectedShippingOption.serviceName

    if (selectedShippingOption.serviceId === 'lumen-local-free' || selectedShippingOption.isFree) {
      if (!isLocalShippingRegion(destinationCep)) {
        return { success: false, error: 'Entrega local grátis indisponível para este CEP.' }
      }
      verifiedShippingCost = new Prisma.Decimal(0)
      isLocalDelivery = true
      verifiedServiceName = 'Entrega Local / Regional (Grátis)'
    } else {
      const shippingItems = order.items.map((i) => ({
        weightGrams: i.product?.weightGrams ?? 200,
        dimensions: i.product?.dimensions || '15x10x5',
        quantity: i.quantity,
      }))
      const quote = await calculateShippingAction(destinationCep, shippingItems)
      const matched = quote.options.find((o) => o.serviceId === selectedShippingOption.serviceId)
      if (!matched) {
        return { success: false, error: 'A opção de frete expirou. Selecione novamente.' }
      }
      verifiedShippingCost = new Prisma.Decimal(matched.price.toFixed(2))
      isLocalDelivery = Boolean(matched.isFree)
      verifiedServiceName = matched.serviceName
    }

    const subtotalDecimal = order.items.reduce(
      (acc, item) => acc.add(item.priceUnit.mul(item.quantity)),
      new Prisma.Decimal(0)
    )
    const finalTotal = subtotalDecimal.add(verifiedShippingCost)

    const shippingAddressSnapshot: Prisma.InputJsonObject = {
      street: shippingAddress.street,
      number: shippingAddress.number,
      complement: shippingAddress.complement || null,
      neighborhood: shippingAddress.neighborhood,
      city: shippingAddress.city,
      state: shippingAddress.state.toUpperCase(),
      zipCode: destinationCep,
      serviceId: selectedShippingOption.serviceId,
      serviceName: verifiedServiceName,
      isLocalDelivery,
      shippingCost: Number(verifiedShippingCost),
      subtotal: Number(subtotalDecimal),
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        shippingCost: verifiedShippingCost,
        isLocalDelivery,
        shippingAddressSnapshot,
        totalAmount: finalTotal,
      },
    })

    revalidatePath(`/marketplace/checkout/${order.id}`)
    return { success: true }
  } catch (error) {
    console.error('Erro ao salvar frete da venda assistida:', error)
    return { success: false, error: 'Erro ao salvar dados de entrega.' }
  }
}
