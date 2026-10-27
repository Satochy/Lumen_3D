'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { checkoutSchema, type CheckoutInput } from '@/lib/validations/checkout_schema'
import { getCurrentUser } from '@/lib/auth'
import { Prisma } from '@prisma/client'

type CheckoutResult = {
  success: boolean
  data?: string
  error?: string
}

function parseCheckoutPayload(raw: unknown): { error?: string; data?: CheckoutInput } {
  const result = checkoutSchema.safeParse(raw)
  if (!result.success) {
    return { error: 'Dados de checkout inválidos. Verifique o endereço e os itens.' }
  }
  return { data: result.data }
}

export async function processCheckout(payload: unknown): Promise<CheckoutResult> {
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Você precisa estar logado para finalizar o pedido.' }
  }

  const parsed = parseCheckoutPayload(payload)
  if (parsed.error || !parsed.data) {
    return { success: false, error: parsed.error }
  }
  const data = parsed.data

  interface ItemRecord {
    productId: string
    variantId: string | null
    quantity: number
    product: Prisma.ProductGetPayload<{
      select: { id: true; title: true; price: true; stock: true; archivedAt: true }
    }>
    variant: Prisma.VariantGetPayload<{
      select: { id: true; priceOverride: true; stock: true }
    }> | null
  }

  const items: ItemRecord[] = []
  for (const item of data.itens) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: {
        id: true,
        title: true,
        price: true,
        stock: true,
        archivedAt: true,
      },
    })

    if (!product) {
      return { success: false, error: 'Produto não encontrado.' }
    }

    if (product.archivedAt) {
      return { success: false, error: 'Este produto não está disponível.' }
    }

    let variant: Prisma.VariantGetPayload<{
      select: { id: true; priceOverride: true; stock: true }
    }> | null = null
    if (item.variantId) {
      const v = await prisma.variant.findUnique({
        where: { id: item.variantId },
        select: { id: true, priceOverride: true, stock: true },
      })
      if (!v) {
        return { success: false, error: 'Variante não encontrada.' }
      }
      variant = v
    }

    items.push({
      productId: item.productId,
      variantId: item.variantId ?? null,
      quantity: item.quantity,
      product,
      variant,
    })
  }

  for (const item of items) {
    const available = item.variant ? item.variant.stock : item.product.stock
    if (available < item.quantity) {
      return {
        success: false,
        error: `Estoque insuficiente para o produto "${item.product.title}".`,
      }
    }
  }

  const { Prisma: PrismaClient } = await import('@prisma/client')
  let totalAmount = new PrismaClient.Decimal(0)
  for (const item of items) {
    const unitPrice = item.variant?.priceOverride ? item.variant.priceOverride : item.product.price
    totalAmount = totalAmount.mul(unitPrice).mul(item.quantity)
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (item.variantId) {
          const result = await tx.variant.updateMany({
            where: {
              id: item.variantId,
              stock: { gte: item.quantity },
            },
            data: { stock: { decrement: item.quantity } },
          })
          if (result.count === 0) {
            throw new Error(`Estoque insuficiente para "${item.product.title}".`)
          }
        } else {
          const result = await tx.product.updateMany({
            where: {
              id: item.productId,
              archivedAt: null,
              stock: { gte: item.quantity },
            },
            data: { stock: { decrement: item.quantity } },
          })
          if (result.count === 0) {
            throw new Error(`Estoque insuficiente para "${item.product.title}".`)
          }
        }
      }

      const newOrder = await tx.order.create({
        data: {
          userId: user.id,
          paymentStatus: 'PENDING',
          logisticsStatus: 'PREPARING',
          totalAmount,
          shippingAddressSnapshot: data.endereco,
        },
      })

      for (const item of items) {
        const unitPrice = item.variant?.priceOverride
          ? item.variant.priceOverride
          : item.product.price

        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId,
            productTitle: item.product.title,
            quantity: item.quantity,
            priceUnit: unitPrice,
            variantId: item.variantId,
          },
        })
      }

      return newOrder
    })

    revalidatePath('/marketplace')
    revalidatePath('/marketplace/[slug]', 'page')
    revalidatePath('/')
    revalidatePath('/admin/orders')
    revalidatePath('/admin')

    return { success: true, data: order.id }
  } catch (error) {
    console.error('Erro ao processar checkout:', error)
    return { success: false, error: 'Falha ao processar o pedido. Tente novamente.' }
  }
}