'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
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
  const cookieStore = await cookies()
  const isUnlocked = cookieStore.get(`unlocked_order_${orderId}`)?.value === 'true'

  if (!user && !isUnlocked) {
    return {
      success: false,
      error: 'Você precisa estar logado ou possuir acesso autorizado a este orçamento.',
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
    const normalizedUserEmail = user?.email?.trim().toLowerCase()

    const order = await prisma.order.findFirst({
      where: {
        id: parsedId.data,
        OR: [
          // Pedidos regulares do comprador
          ...(user ? [{ userId: user.id, isAssistedSale: false }] : []),
          // Venda assistida: EXCLUSIVAMENTE para o e-mail esperado do comprador (Regra V21)
          ...(user && normalizedUserEmail
            ? [
                {
                  isAssistedSale: true,
                  assistedSaleExpectedEmail: { equals: normalizedUserEmail, mode: 'insensitive' as const },
                },
              ]
            : []),
          // Pedido assistido destrancado via cookie
          ...(isUnlocked ? [{ isAssistedSale: true }] : []),
          // Administradores da loja
          ...(user?.role === 'ADMIN' ? [{ isAssistedSale: true }] : []),
        ],
      },
      include: {
        items: true,
        user: true,
      },
    })

    if (!order) {
      return {
        success: false,
        error: 'Pedido não encontrado ou não pertence à sua conta.',
      }
    }

    // Bloquear criação de preferência se o link/reserva já expirou
    if (
      order.expiresAt &&
      new Date(order.expiresAt) < new Date() &&
      order.paymentStatus === 'PENDING'
    ) {
      return {
        success: false,
        error: 'Este link de checkout expirou. Entre em contato com a Lúmen 3D para gerar uma nova cotação.',
      }
    }

    // Regra V21: Para venda assistida, valida a titularidade do e-mail antes de qualquer vínculo
    if (order.isAssistedSale) {
      const expected = order.assistedSaleExpectedEmail?.trim().toLowerCase()

      if (user && normalizedUserEmail) {
        const isOwner = Boolean(expected && normalizedUserEmail === expected)
        if (!isOwner && user.role !== 'ADMIN' && !isUnlocked) {
          return {
            success: false,
            error: 'Acesso negado: este orçamento pertence a outro comprador.',
          }
        }

        if (isOwner && order.userId !== user.id) {
          await prisma.order.update({
            where: { id: order.id },
            data: { userId: user.id },
          })
        }
      } else if (!isUnlocked) {
        return {
          success: false,
          error: 'Acesso negado a este orçamento.',
        }
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

    const payerEmail = user?.email || order.assistedSaleExpectedEmail || 'cliente@lumen3d.com.br'
    const payerName =
      user?.name?.split(' ')[0] ||
      user?.username ||
      order.assistedSaleExpectedEmail?.split('@')[0] ||
      'Cliente'
    const payerSurname =
      user?.name ? user.name.split(' ').slice(1).join(' ') || undefined : undefined

    const successUrl = user
      ? `${baseUrl}/profile/orders?status=success&orderId=${order.id}`
      : `${baseUrl}/marketplace/checkout/${order.id}?status=success`
    const pendingUrl = user
      ? `${baseUrl}/profile/orders?status=pending&orderId=${order.id}`
      : `${baseUrl}/marketplace/checkout/${order.id}?status=pending`

    const preferenceResponse = await preferenceClient.create({
      body: {
        items: preferenceItems,
        payer: {
          email: payerEmail,
          name: payerName,
          surname: payerSurname,
        },
        external_reference: order.id,
        ...(isPublicUrl
          ? { notification_url: `${baseUrl}/api/webhooks/mercadopago` }
          : {}),
        back_urls: {
          success: successUrl,
          pending: pendingUrl,
          failure: `${baseUrl}/marketplace/checkout/${order.id}?status=failure`,
        },
        statement_descriptor: 'LUMEN 3D',
        metadata: {
          order_id: order.id,
          user_id: user ? user.id : (order.userId || 'assisted_anonymous'),
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
  const cookieStore = await cookies()
  const isUnlocked = cookieStore.get(`unlocked_order_${orderId}`)?.value === 'true'

  if (!user && !isUnlocked) {
    return { success: false, isPaid: false, error: 'Sessão não autenticada.' }
  }

  const parsedId = orderIdSchema.safeParse(orderId)
  if (!parsedId.success) {
    return { success: false, isPaid: false, error: 'ID do pedido inválido.' }
  }

  const order = await prisma.order.findFirst({
    where: {
      id: parsedId.data,
      OR: [
        ...(user ? [{ userId: user.id }] : []),
        ...(isUnlocked ? [{ isAssistedSale: true }] : []),
        ...(user?.role === 'ADMIN' ? [{ isAssistedSale: true }] : []),
      ],
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
