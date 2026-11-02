'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { MercadoPagoConfig, Preference } from 'mercadopago'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { syncOrderWithMercadoPago } from '@/lib/mercadopago_sync'

export interface CreatePreferenceResult {
  success: boolean
  preferenceId?: string
  data?: {
    preferenceId: string
  }
  error?: string
}

const orderIdSchema = z.string().uuid('ID do pedido inválido.')

/**
 * Cria uma Preference no Mercado Pago para inicializar o Checkout Bricks.
 *
 * Regras de segurança:
 * - Autenticação obrigatória via getCurrentUser().
 * - Verifica se o pedido pertence ao usuário logado (proteção contra IDOR).
 * - Utiliza preços e frete exclusivamente do banco de dados (Order / OrderItem).
 */
export async function createPreferenceAction(
  orderId: string
): Promise<CreatePreferenceResult> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      success: false,
      error: 'Você precisa estar logado para iniciar o pagamento.',
    }
  }

  const parsedId = orderIdSchema.safeParse(orderId)
  if (!parsedId.success) {
    return {
      success: false,
      error: parsedId.error.issues[0]?.message || 'ID do pedido inválido.',
    }
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) {
    console.error('MERCADOPAGO_ACCESS_TOKEN não configurado no ambiente.')
    return {
      success: false,
      error: 'Chave de acesso do Mercado Pago não configurada no servidor.',
    }
  }

  try {
    const order = await prisma.order.findFirst({
      where: {
        id: parsedId.data,
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

    const mpConfig = new MercadoPagoConfig({
      accessToken,
      options: { timeout: 15000 },
    })
    const preferenceClient = new Preference(mpConfig)

    const preferenceItems = order.items.map((item) => ({
      id: item.productId || item.id,
      title: item.productTitle,
      quantity: item.quantity,
      unit_price: Number(item.priceUnit),
      currency_id: 'BRL',
    }))

    const shippingCostNumber = Number(order.shippingCost)
    if (shippingCostNumber > 0) {
      preferenceItems.push({
        id: 'shipping-fee',
        title: 'Frete de Entrega',
        quantity: 1,
        unit_price: shippingCostNumber,
        currency_id: 'BRL',
      })
    }

    const baseUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000'
    ).replace(/\/$/, '')

    const isPublicUrl =
      baseUrl.startsWith('https://') &&
      !baseUrl.includes('localhost') &&
      !baseUrl.includes('127.0.0.1')

    const preferenceResponse = await preferenceClient.create({
      body: {
        items: preferenceItems,
        payer: {
          email: user.email,
          name: user.name?.split(' ')[0] || user.username,
          surname: user.name?.split(' ').slice(1).join(' ') || undefined,
        },
        external_reference: order.id,
        ...(isPublicUrl
          ? { notification_url: `${baseUrl}/api/webhooks/mercadopago` }
          : {}),
        back_urls: {
          success: `${baseUrl}/profile/orders?status=success&orderId=${order.id}`,
          pending: `${baseUrl}/profile/orders?status=pending&orderId=${order.id}`,
          failure: `${baseUrl}/marketplace/checkout/${order.id}?status=failure`,
        },
        statement_descriptor: 'LUMEN 3D',
        metadata: {
          order_id: order.id,
          user_id: user.id,
        },
      },
    })

    if (!preferenceResponse.id) {
      return {
        success: false,
        error: 'Não foi possível gerar a preferência de pagamento.',
      }
    }

    return {
      success: true,
      preferenceId: preferenceResponse.id,
      data: {
        preferenceId: preferenceResponse.id,
      },
    }
  } catch (error) {
    console.error('Erro ao criar Preference no Mercado Pago:', error)
    return {
      success: false,
      error: 'Falha ao inicializar a preferência de pagamento no Mercado Pago.',
    }
  }
}

/**
 * Verifica ativamente na API do Mercado Pago se o pedido do usuário logado já possui pagamento aprovado
 * e, em caso positivo, confirma o pedido como PAID e executa a baixa atômica do estoque.
 */
export async function verifyOrderPaymentStatusAction(
  orderId: string,
  paymentId?: string | null
): Promise<{ success: boolean; isPaid: boolean; status?: string; error?: string }> {
  const user = await getCurrentUser()
  if (!user) {
    return { success: false, isPaid: false, error: 'Sessão não autenticada.' }
  }

  const parsedId = orderIdSchema.safeParse(orderId)
  if (!parsedId.success) {
    return { success: false, isPaid: false, error: 'ID do pedido inválido.' }
  }

  const order = await prisma.order.findFirst({
    where: {
      id: parsedId.data,
      userId: user.id,
    },
    select: {
      id: true,
      paymentStatus: true,
    },
  })

  if (!order) {
    return { success: false, isPaid: false, error: 'Pedido não encontrado.' }
  }

  if (order.paymentStatus === 'PAID') {
    return { success: true, isPaid: true, status: 'approved' }
  }

  const syncResult = await syncOrderWithMercadoPago(order.id, paymentId)
  if (syncResult.isPaid) {
    revalidatePath(`/marketplace/checkout/${order.id}`)
    revalidatePath('/profile/orders')
    revalidatePath('/admin/orders')
    revalidatePath('/admin')
    revalidatePath('/marketplace')
  }

  return {
    success: true,
    isPaid: syncResult.isPaid,
    status: syncResult.status,
  }
}
