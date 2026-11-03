'use server'

import { createHash, randomUUID } from 'crypto'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { Prisma, OrderOccurrenceType, PaymentAttemptStatus } from '@prisma/client'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { confirmApprovedPaymentInDb } from '@/lib/mercadopago_sync'
import { getReservationTtlMinutes, reserveStockAtomically } from '@/lib/stock/reservation_service'
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
      const defaultAddress = await prisma.address.findFirst({
        where: { userId: user.id },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      })

      if (defaultAddress) {
        resolvedAddress = defaultAddress
      }
    }

    if (resolvedAddress) {
      const addressCep = sanitizeCEP(resolvedAddress.zipCode)
      const optionCep = selectedShippingOption.cep
        ? sanitizeCEP(selectedShippingOption.cep)
        : ''

      if (optionCep && optionCep !== addressCep) {
        return {
          success: false,
          error:
            'O CEP calculado no frete diverge do CEP do endereço de entrega cadastrado. Recalcule o frete para o seu endereço.',
        }
      }
    }

    const destinationCep = resolvedAddress
      ? sanitizeCEP(resolvedAddress.zipCode)
      : sanitizeCEP(selectedShippingOption.cep || '')

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
        isMadeToOrder: true,
        productionDays: true,
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
      isMadeToOrder: boolean
      productionDays: number | null
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

      if (!product.isMadeToOrder && availableStock < item.quantity) {
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
        isMadeToOrder: product.isMadeToOrder,
        productionDays: product.productionDays ?? null,
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

    // 9. Persistir Order (PENDING), OrderItems e Reserva Temporária (TTL 30 min) numa única transação atômica
    // Regra D05: A baixa definitiva de estoque ocorre somente na confirmação do pagamento (webhook PAID).
    const ttlMinutes = getReservationTtlMinutes()
    const orderExpiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000)

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
          expiresAt: orderExpiresAt,
        },
      })

      const itemsWithIds = verifiedOrderItems.map((item) => ({
        id: randomUUID(),
        orderId: createdOrder.id,
        productId: item.productId,
        variantId: item.variantId,
        productTitle: item.productTitle,
        quantity: item.quantity,
        priceUnit: item.priceUnit,
        isMadeToOrder: item.isMadeToOrder,
        productionDays: item.productionDays,
      }))

      await tx.orderItem.createMany({
        data: itemsWithIds,
      })

      await reserveStockAtomically(tx, {
        orderId: createdOrder.id,
        items: itemsWithIds.map((i) => ({
          orderItemId: i.id,
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
          isMadeToOrder: i.isMadeToOrder,
        })),
        ttlMinutes,
        actorUserId: user.id,
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

export interface ProcessPaymentResult {
  success: boolean
  error?: string
  status?: 'approved' | 'pending' | 'in_process' | 'rejected' | string
  statusDetail?: string
  paymentId?: string
  qrCode?: string | null
  qrCodeBase64?: string | null
  ticketUrl?: string | null
}

const paymentFormDataSchema = z.object({
  payment_method_id: z.string().trim().min(1, 'Método de pagamento inválido.'),
  token: z.string().nullish(),
  issuer_id: z.union([z.string(), z.number()]).nullish(),
  installments: z.union([z.number(), z.string()]).nullish(),
  payer: z
    .object({
      email: z.string().nullish(),
      first_name: z.string().nullish(),
      last_name: z.string().nullish(),
      identification: z
        .object({
          type: z.string().nullish(),
          number: z.string().nullish(),
        })
        .nullish(),
    })
    .nullish(),
})

const processPaymentSchema = z.object({
  orderId: z.string().uuid('ID do pedido inválido.'),
  formData: paymentFormDataSchema,
})

/**
 * Processa o pagamento transparente (PIX ou Cartão) via Mercado Pago Checkout Bricks.
 *
 * Regras inegociáveis:
 * - Valida sessão (getCurrentUser) e propriedade do pedido (userId === user.id).
 * - Ignora transaction_amount do cliente; utiliza estritamente order.totalAmount do banco.
 * - Quando o pagamento é aprovado imediatamente (ex: cartão), registra idempotência em
 *   PaymentWebhookLog, marca o pedido como PAID e executa a baixa atômica do estoque (D05).
 * - Quando gera PIX (pending), retorna o QR Code Base64 e o código Copia e Cola para exibição.
 */
export async function processOrderPaymentAction(
  orderId: string,
  rawFormData: unknown
): Promise<ProcessPaymentResult> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      success: false,
      error: 'Sessão expirada. Faça login novamente para concluir o pagamento.',
    }
  }

  const parsed = processPaymentSchema.safeParse({
    orderId,
    formData: rawFormData,
  })

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Dados de pagamento inválidos.',
    }
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) {
    console.error('MERCADOPAGO_ACCESS_TOKEN não configurado no ambiente.')
    return {
      success: false,
      error: 'O serviço de pagamento está temporariamente indisponível.',
    }
  }

  const { formData } = parsed.data

  try {
    const order = await prisma.order.findFirst({
      where: {
        id: parsed.data.orderId,
        userId: user.id,
      },
      include: {
        items: true,
      },
    })

    if (!order) {
      return {
        success: false,
        error: 'Pedido não encontrado ou não pertence à sua conta.',
      }
    }

    if (order.logisticsStatus === 'CANCELLED') {
      return {
        success: false,
        error: 'Este pedido foi cancelado e não pode mais ser pago.',
      }
    }

    if (order.paymentStatus !== 'PENDING') {
      return {
        success: false,
        error:
          order.paymentStatus === 'PAID'
            ? 'Este pedido já consta como pago.'
            : 'Este pedido não está mais pendente para pagamento.',
      }
    }

    if (order.expiresAt && order.expiresAt < new Date()) {
      return {
        success: false,
        error: 'O prazo de pagamento deste pedido expirou. Por favor, refaça o pedido.',
      }
    }

    const transactionAmount = Number(order.totalAmount)
    if (transactionAmount <= 0) {
      return {
        success: false,
        error: 'Valor do pedido inválido para processamento.',
      }
    }

    const mpConfig = new MercadoPagoConfig({
      accessToken,
      options: { timeout: 15000 },
    })
    const paymentClient = new Payment(mpConfig)

    const issuerNumber =
      formData.issuer_id !== undefined &&
      formData.issuer_id !== null &&
      String(formData.issuer_id).trim() !== ''
        ? Number(formData.issuer_id)
        : undefined

    const installmentsNumber =
      formData.installments !== undefined &&
      formData.installments !== null &&
      Number(formData.installments) > 0
        ? Number(formData.installments)
        : 1

    const baseUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      ''
    ).replace(/\/$/, '')
    const isPublicUrl =
      baseUrl.startsWith('https://') &&
      !baseUrl.includes('localhost') &&
      !baseUrl.includes('127.0.0.1')

    const idempotencyKey = createHash('sha256')
      .update(
        [
          order.id,
          formData.payment_method_id,
          formData.token || 'no-token',
          String(installmentsNumber),
          order.totalAmount.toFixed(2),
        ].join(':')
      )
      .digest('hex')

    const paymentAttempt = await prisma.paymentAttempt.create({
      data: {
        orderId: order.id,
        provider: 'MERCADOPAGO',
        environment: process.env.MP_ENVIRONMENT || 'sandbox',
        method: formData.payment_method_id,
        idempotencyKey,
        expectedAmount: order.totalAmount,
        currency: 'BRL',
        installments: installmentsNumber,
        status: PaymentAttemptStatus.INITIATED,
        expiresAt: order.expiresAt,
      },
    })

    const paymentResponse = await paymentClient.create({
      body: {
        transaction_amount: transactionAmount,
        description: `Pedido Lúmen 3D #${order.id.slice(0, 8)}`,
        payment_method_id: formData.payment_method_id,
        token: formData.token || undefined,
        installments: installmentsNumber,
        issuer_id:
          issuerNumber !== undefined && !Number.isNaN(issuerNumber)
            ? issuerNumber
            : undefined,
        external_reference: order.id,
        ...(isPublicUrl
          ? { notification_url: `${baseUrl}/api/webhooks/mercadopago` }
          : {}),
        metadata: {
          order_id: order.id,
          user_id: user.id,
        },
        payer: {
          email:
            formData.payer?.email && formData.payer.email.includes('@')
              ? formData.payer.email
              : user.email,
          first_name:
            formData.payer?.first_name || user.name?.split(' ')[0] || undefined,
          last_name:
            formData.payer?.last_name ||
            user.name?.split(' ').slice(1).join(' ') ||
            undefined,
          identification:
            formData.payer?.identification?.type &&
            formData.payer?.identification?.number
              ? {
                  type: formData.payer.identification.type,
                  number: formData.payer.identification.number.replace(/\D/g, ''),
                }
              : undefined,
        },
      },
      requestOptions: {
        idempotencyKey,
      },
    })

    const mpStatus = paymentResponse.status || 'pending'
    const mpPaymentId = paymentResponse.id ? String(paymentResponse.id) : undefined

    await prisma.paymentAttempt.update({
      where: { id: paymentAttempt.id },
      data: {
        externalPaymentId: mpPaymentId,
        status:
          mpStatus === 'approved'
            ? PaymentAttemptStatus.APPROVED
            : mpStatus === 'rejected'
            ? PaymentAttemptStatus.REJECTED
            : mpStatus === 'cancelled'
            ? PaymentAttemptStatus.CANCELLED
            : PaymentAttemptStatus.PENDING,
        paidAmount:
          mpStatus === 'approved' && paymentResponse.transaction_amount
            ? new Prisma.Decimal(paymentResponse.transaction_amount)
            : null,
      },
    })

    if (mpStatus === 'approved' && mpPaymentId) {
      if (paymentResponse.currency_id !== 'BRL') {
        console.error(
          `[SEGURANÇA FINANCEIRA] Moeda inválida retornada no pagamento ${mpPaymentId}: ${String(paymentResponse.currency_id)}.`
        )
        await prisma.orderOccurrence.create({
          data: {
            orderId: order.id,
            attemptId: paymentAttempt.id,
            externalPaymentId: mpPaymentId,
            type: OrderOccurrenceType.AMOUNT_OR_CURRENCY_MISMATCH,
            description: `Moeda inválida recebida: ${String(paymentResponse.currency_id)} (esperado BRL).`,
            metadata: {
              currencyId: paymentResponse.currency_id,
              paymentId: mpPaymentId,
            },
          },
        })
        await prisma.order.update({
          where: { id: order.id },
          data: { hasOpenOccurrence: true },
        })
        return {
          success: false,
          error: 'Moeda de transação inválida para este pedido.',
        }
      }

      await confirmApprovedPaymentInDb({
        orderId: order.id,
        paymentId: mpPaymentId,
        externalReference: String(paymentResponse.external_reference || '').trim(),
        transactionAmount: paymentResponse.transaction_amount,
        currencyId: paymentResponse.currency_id,
      })

      revalidatePath(`/marketplace/checkout/${order.id}`)
      revalidatePath('/profile/orders')
      revalidatePath('/admin/orders')
      revalidatePath('/admin')
      revalidatePath('/marketplace')

      return {
        success: true,
        status: 'approved',
        statusDetail: paymentResponse.status_detail,
        paymentId: mpPaymentId,
      }
    }

    if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
      return {
        success: false,
        status: mpStatus,
        statusDetail: paymentResponse.status_detail,
        error:
          'O pagamento não foi autorizado pela operadora. Verifique os dados ou tente outro meio de pagamento.',
      }
    }

    const txData = paymentResponse.point_of_interaction?.transaction_data

    return {
      success: true,
      status: mpStatus,
      statusDetail: paymentResponse.status_detail,
      paymentId: mpPaymentId,
      qrCode: txData?.qr_code ?? null,
      qrCodeBase64: txData?.qr_code_base64 ?? null,
      ticketUrl: txData?.ticket_url ?? null,
    }
  } catch (err) {
    console.error('Erro ao processar pagamento no Mercado Pago:', err)
    return {
      success: false,
      error:
        'Não foi possível processar o pagamento no momento. Verifique os dados informados e tente novamente.',
    }
  }
}
