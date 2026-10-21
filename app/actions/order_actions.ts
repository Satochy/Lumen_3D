'use server'

import { prisma } from '@/lib/prisma'
import type { ShippingOption } from './shipping_actions'
import { Prisma } from '@prisma/client'

/** Dados de cada item enviados pelo cliente */
interface OrderItemInput {
  productId: string
  productTitle: string
  quantity: number
  priceUnit: number
}

/** Payload da ação */
interface OrderInput {
  items: OrderItemInput[]
  selectedShippingOption: ShippingOption | null
  userId?: string
}

/** Resultado da criação de pedido */
export interface CreateOrderResult {
  success: boolean
  error?: string
  orderId?: string
  totalAmount?: number
}

/**
 * Cria uma ordem de compra no banco de dados.
 *
 * Regras de segurança:
 * - Recalcular preço e estoque no servidor a partir do Prisma (evita manipulação do cliente).
 * - Usar transação Prisma para garantir atomicidade (estoque, Order, OrderItem).
 * - Produto arquivado ou estoque insuficiente → rejeita.
 */
export async function createOrderAction(input: OrderInput): Promise<CreateOrderResult> {
  const { items, selectedShippingOption, userId } = input

  // Validações básicas
  if (!items || items.length === 0) {
    return { success: false, error: 'Carrinho vazio.' }
  }
  if (!selectedShippingOption) {
    return { success: false, error: 'Selecione uma opção de frete.' }
  }

  const buyerId = userId ?? '1' // Mock: usuário padrão até implementar auth

  try {
    // 1️⃣ Buscar produtos no banco para garantir integridade
    const productIds = items.map(i => i.productId)
    const productsFromDB = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        archivedAt: null,
      },
      select: {
        id: true,
        stock: true,
        title: true,
        price: true,
      },
    })

    if (productsFromDB.length !== productIds.length) {
      return { success: false, error: 'Um ou mais produtos não estão disponíveis.' }
    }

    // 2️⃣ Validar estoque e montar itens de ordem seguros (usar preço do DB)
    const safeItems: OrderItemInput[] = []
    for (const item of items) {
      const prod = productsFromDB.find(p => p.id === item.productId)!
      if (prod.stock < item.quantity) {
        return { success: false, error: `Estoque insuficiente para ${prod.title}.` }
      }
      safeItems.push({
        productId: prod.id,
        productTitle: prod.title,
        quantity: item.quantity,
        // Convert Decimal para number
        priceUnit: Number(prod.price),
      })
    }

    // 3️⃣ Calcular subtotal e total (inclui frete)
    const subtotal = safeItems.reduce((acc, i) => acc + i.priceUnit * i.quantity, 0)
    const shippingCost = selectedShippingOption.price
    const finalTotal = subtotal + shippingCost

    // 4️⃣ Persistir Order + OrderItem numa única transação
    const { order, itemResults } = await prisma.$transaction(async tx => {
      const order = await tx.order.create({
        data: {
          userId: buyerId,
          status: 'PENDING',
          totalAmount: new Prisma.Decimal(subtotal),
          shippingCost: new Prisma.Decimal(shippingCost),
        },
      })

      const itemResults = await Promise.all(
        safeItems.map(async i => {
          // Decrementar estoque (condição extra de segurança)
          const updateResult = await tx.product.updateMany({
            where: {
              id: i.productId,
              archivedAt: null,
              stock: { gte: i.quantity },
            },
            data: { stock: { decrement: i.quantity } },
          })

          const orderItem = await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: i.productId,
              productTitle: i.productTitle,
              quantity: i.quantity,
              priceUnit: new Prisma.Decimal(i.priceUnit),
            },
          })

          return { updateResult, orderItem }
        })
      )

      return { order, itemResults }
    })

    // 5️⃣ Garantir que todas as alterações de estoque sucederam
    const allStockOk = itemResults.every(r => r.updateResult.count > 0)
    if (!allStockOk) {
      throw new Error('Falha ao atualizar estoque em pelo menos um item.')
    }

    return { success: true, orderId: order.id, totalAmount: finalTotal }
  } catch (err) {
    console.error('Erro na criação de pedido:', err)
    return { success: false, error: 'Erro interno ao criar pedido.' }
  }
}
