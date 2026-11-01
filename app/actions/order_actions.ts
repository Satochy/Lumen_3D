'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { calculateShippingAction, type ShippingOption } from './shipping_actions'
import { isLocalShippingRegion, isValidCEP, sanitizeCEP } from '@/lib/shipping/shipping_utils'

/** Dados de cada item enviados pelo cliente (preço e título do cliente são ignorados no servidor) */
export interface OrderItemInput {
  productId: string
  variantId?: string | null
  productTitle?: string
  title?: string
  quantity: number
  priceUnit?: number
  price?: number
}

/** Dados de frete enviados pelo cliente (revalidados no servidor) */
export interface SelectedShippingInput extends Partial<ShippingOption> {
  serviceId: string
  serviceName: string
  price: number
  isFree?: boolean
  cep?: string
}

/** Endereço explícito opcional (caso não informado, busca o endereço do usuário no banco) */
export interface ShippingAddressInput {
  street: string
  number: string
  complement?: string | null
  neighborhood: string
  city: string
  state: string
  zipCode: string
}

/** Payload da ação */
export interface OrderInput {
  items: OrderItemInput[]
  selectedShippingOption: SelectedShippingInput | null
  addressId?: string
  shippingAddress?: ShippingAddressInput
}

/** Resultado da criação de pedido */
export interface CreateOrderResult {
  success: boolean
  error?: string
  orderId?: string
  totalAmount?: number
  data?: {
    orderId: string
    totalAmount: number
  }
}

const orderItemSchema = z.object({
  productId: z.string().uuid('ID de produto inválido.'),
  variantId: z.string().uuid('ID de variante inválido.').optional().nullable(),
  quantity: z
    .number()
    .int('A quantidade deve ser um número inteiro.')
    .positive('A quantidade de cada item deve ser maior que zero.'),
})

const shippingOptionSchema = z.object({
  serviceId: z.string().trim().min(1, 'Selecione uma modalidade de frete válida.'),
  serviceName: z.string().trim().min(1, 'Nome do serviço de frete inválido.'),
  companyName: z.string().optional(),
  price: z.number().nonnegative('Valor de frete inválido.'),
  isFree: z.boolean().optional(),
  cep: z.string().optional(),
})

const shippingAddressSchema = z.object({
  street: z.string().trim().min(2, 'Informe a rua/logradouro.'),
  number: z.string().trim().min(1, 'Informe o número.'),
  complement: z.string().trim().optional().nullable(),
  neighborhood: z.string().trim().min(2, 'Informe o bairro.'),
  city: z.string().trim().min(2, 'Informe a cidade.'),
  state: z.string().trim().length(2, 'Informe a UF com 2 letras (ex: SP).'),
  zipCode: z
    .string()
    .transform((v) => sanitizeCEP(v))
    .refine((v) => isValidCEP(v), 'O CEP de entrega deve conter 8 dígitos.'),
})

const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'Seu carrinho está vazio.'),
  selectedShippingOption: shippingOptionSchema.nullable().refine((val) => val !== null, {
    message: 'Selecione uma opção de frete antes de finalizar o pedido.',
  }),
  addressId: z.string().uuid('ID de endereço inválido.').optional(),
  shippingAddress: shippingAddressSchema.optional(),
})

/**
 * Cria uma ordem de compra (PENDING) no banco de dados.
 *
 * Regras inegociáveis (Documento-Mestre):
 * - Autenticação obrigatória via getCurrentUser() (ignora userId enviado pelo cliente).
 * - Validação estrutural de entrada via Zod.
 * - Recálculo integral de preços e frete no servidor usando Prisma.Decimal.
 * - Verificação de disponibilidade de estoque (a baixa definitiva ocorre somente na confirmação do pagamento — D05).
 * - Preservação de snapshots (productTitle, priceUnit, shippingAddressSnapshot).
 */
export async function createOrderAction(input: OrderInput): Promise<CreateOrderResult> {
  // 1. Autenticação obrigatória
  const user = await getCurrentUser()
  if (!user) {
    return {
      success: false,
      error: 'Você precisa estar logado para finalizar o pedido.',
    }
  }

  // 2. Validação de entrada com Zod
  const parsed = createOrderSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Dados do pedido inválidos.',
    }
  }

  const { items, selectedShippingOption, addressId, shippingAddress } = parsed.data

  try {
    // 3. Resolver e validar endereço de entrega do comprador (proteção contra IDOR)
    let resolvedAddress: {
      id?: string
      street: string
      number: string
      complement: string | null
      neighborhood: string
      city: string
      state: string
      zipCode: string
    } | null = null

    if (shippingAddress) {
      resolvedAddress = {
        street: shippingAddress.street,
        number: shippingAddress.number,
        complement: shippingAddress.complement ?? null,
        neighborhood: shippingAddress.neighborhood,
        city: shippingAddress.city,
        state: shippingAddress.state.toUpperCase(),
        zipCode: shippingAddress.zipCode,
      }
    } else if (addressId) {
      const dbAddr = await prisma.address.findFirst({
        where: { id: addressId, userId: user.id },
      })
      if (!dbAddr) {
        return {
          success: false,
          error: 'Endereço de entrega não encontrado ou não pertence à sua conta.',
        }
      }
      resolvedAddress = dbAddr
    } else {
      const userAddresses = await prisma.address.findMany({
        where: { userId: user.id },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      })

      if (userAddresses.length > 0) {
        const optionCep = selectedShippingOption.cep
          ? sanitizeCEP(selectedShippingOption.cep)
          : ''
        const matchingByCep = optionCep
          ? userAddresses.find((a) => sanitizeCEP(a.zipCode) === optionCep)
          : undefined
        resolvedAddress = matchingByCep ?? userAddresses[0]
      }
    }

    const destinationCep = sanitizeCEP(
      selectedShippingOption.cep || resolvedAddress?.zipCode || ''
    )

    if (!isValidCEP(destinationCep)) {
      return {
        success: false,
        error: 'Informe um CEP válido ou cadastre um endereço de entrega em Meu Perfil.',
      }
    }

    // 4. Consolidar itens repetidos (evita burlar checagem de estoque com linhas duplicadas)
    const consolidatedMap = new Map<
      string,
      { productId: string; variantId: string | null; quantity: number }
    >()

    for (const item of items) {
      const key = `${item.productId}::${item.variantId ?? 'base'}`
      const existing = consolidatedMap.get(key)
      if (existing) {
        existing.quantity += item.quantity
      } else {
        consolidatedMap.set(key, {
          productId: item.productId,
          variantId: item.variantId ?? null,
          quantity: item.quantity,
        })
      }
    }

    const consolidatedItems = Array.from(consolidatedMap.values())
    const uniqueProductIds = Array.from(new Set(consolidatedItems.map((i) => i.productId)))

    // 5. Buscar produtos ativos no banco (fonte da verdade de preço, título, peso, dimensões e estoque)
    const productsFromDB = await prisma.product.findMany({
      where: {
        id: { in: uniqueProductIds },
        archivedAt: null,
      },
      select: {
        id: true,
        title: true,
        price: true,
        stock: true,
        weightGrams: true,
        dimensions: true,
        variants: {
          select: {
            id: true,
            stock: true,
            priceOverride: true,
          },
        },
      },
    })

    if (productsFromDB.length !== uniqueProductIds.length) {
      return {
        success: false,
        error: 'Um ou mais produtos do carrinho não estão mais disponíveis.',
      }
    }

    const productMap = new Map(productsFromDB.map((p) => [p.id, p]))

    // 6. Validar disponibilidade de estoque e preparar itens com Prisma.Decimal
    const verifiedOrderItems: {
      productId: string
      variantId: string | null
      productTitle: string
      quantity: number
      priceUnit: Prisma.Decimal
      weightGrams: number
      dimensions: string
    }[] = []

    let subtotalDecimal = new Prisma.Decimal(0)

    for (const item of consolidatedItems) {
      const product = productMap.get(item.productId)
      if (!product) {
        return {
          success: false,
          error: 'Produto não encontrado ou indisponível.',
        }
      }

      let unitPriceDecimal = product.price
      let availableStock = product.stock

      if (item.variantId) {
        const variant = product.variants.find((v) => v.id === item.variantId)
        if (!variant) {
          return {
            success: false,
            error: `Variante selecionada para "${product.title}" não foi encontrada.`,
          }
        }
        availableStock = variant.stock
        if (variant.priceOverride !== null) {
          unitPriceDecimal = variant.priceOverride
        }
      }

      if (availableStock < item.quantity) {
        return {
          success: false,
          error: `Estoque insuficiente para "${product.title}" (disponível: ${availableStock}).`,
        }
      }

      const lineTotal = unitPriceDecimal.mul(item.quantity)
      subtotalDecimal = subtotalDecimal.add(lineTotal)

      verifiedOrderItems.push({
        productId: product.id,
        variantId: item.variantId,
        productTitle: product.title,
        quantity: item.quantity,
        priceUnit: unitPriceDecimal,
        weightGrams: product.weightGrams ?? 200,
        dimensions: product.dimensions ?? '15x10x5',
      })
    }

    // 7. Revalidar frete e elegibilidade de Entrega Local Gratuita no servidor
    let verifiedShippingCost = new Prisma.Decimal(0)
    let isLocalDelivery = false
    let verifiedServiceName = selectedShippingOption.serviceName

    const isRequestingLocalFree =
      selectedShippingOption.serviceId === 'lumen-local-free' ||
      Boolean(selectedShippingOption.isFree)

    if (isRequestingLocalFree) {
      if (!isLocalShippingRegion(destinationCep)) {
        return {
          success: false,
          error: 'Entrega local gratuita não disponível para o CEP informado.',
        }
      }
      verifiedShippingCost = new Prisma.Decimal(0)
      isLocalDelivery = true
      verifiedServiceName = 'Entrega Local / Regional'
    } else {
      const shippingQuote = await calculateShippingAction(
        destinationCep,
        verifiedOrderItems.map((i) => ({
          weightGrams: i.weightGrams,
          dimensions: i.dimensions,
          quantity: i.quantity,
        }))
      )

      if (shippingQuote.error || shippingQuote.options.length === 0) {
        return {
          success: false,
          error:
            shippingQuote.error ||
            'Não foi possível validar o frete para o CEP informado. Recalcule o frete.',
        }
      }

      const matchedOption =
        shippingQuote.options.find((opt) => opt.serviceId === selectedShippingOption.serviceId) ??
        shippingQuote.options.find(
          (opt) => opt.serviceName.toLowerCase() === selectedShippingOption.serviceName.toLowerCase()
        )

      if (!matchedOption) {
        return {
          success: false,
          error: 'A opção de frete selecionada expirou ou mudou. Recalcule o frete no carrinho.',
        }
      }

      verifiedShippingCost = new Prisma.Decimal(matchedOption.price.toFixed(2))
      isLocalDelivery = Boolean(matchedOption.isFree)
      verifiedServiceName = matchedOption.serviceName
    }

    const finalTotalDecimal = subtotalDecimal.add(verifiedShippingCost)

    // 8. Construir snapshot imutável de entrega (endereço + opção de frete validada)
    const addressMatchesCep =
      resolvedAddress && sanitizeCEP(resolvedAddress.zipCode) === destinationCep

    const shippingAddressSnapshot: Prisma.InputJsonObject = {
      ...(addressMatchesCep && resolvedAddress
        ? {
            addressId: resolvedAddress.id ?? null,
            street: resolvedAddress.street,
            number: resolvedAddress.number,
            complement: resolvedAddress.complement ?? null,
            neighborhood: resolvedAddress.neighborhood,
            city: resolvedAddress.city,
            state: resolvedAddress.state,
          }
        : {}),
      zipCode: destinationCep,
      serviceId: selectedShippingOption.serviceId,
      serviceName: verifiedServiceName,
      isLocalDelivery,
      shippingCost: Number(verifiedShippingCost),
      subtotal: Number(subtotalDecimal),
    }

    // 9. Persistir Order (PENDING) + OrderItems numa única transação atômica
    // Regra D05: A baixa definitiva de estoque ocorre somente na confirmação do pagamento (webhook PAID).
    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          userId: user.id,
          paymentStatus: 'PENDING',
          logisticsStatus: 'PREPARING',
          totalAmount: finalTotalDecimal,
          shippingCost: verifiedShippingCost,
          isLocalDelivery,
          shippingAddressSnapshot,
        },
      })

      await tx.orderItem.createMany({
        data: verifiedOrderItems.map((item) => ({
          orderId: createdOrder.id,
          productId: item.productId,
          variantId: item.variantId,
          productTitle: item.productTitle,
          quantity: item.quantity,
          priceUnit: item.priceUnit,
        })),
      })

      return createdOrder
    })

    revalidatePath('/profile/orders')
    revalidatePath('/admin/orders')
    revalidatePath('/admin')

    const totalAmountNumber = Number(finalTotalDecimal)

    return {
      success: true,
      orderId: order.id,
      totalAmount: totalAmountNumber,
      data: {
        orderId: order.id,
        totalAmount: totalAmountNumber,
      },
    }
  } catch (err) {
    console.error('Erro na criação de pedido:', err)
    return {
      success: false,
      error: 'Erro interno ao processar seu pedido. Tente novamente em instantes.',
    }
  }
}
