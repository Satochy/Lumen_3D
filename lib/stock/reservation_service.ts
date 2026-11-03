import { Prisma, StockReservation, StockReservationStatus, StockMovementType } from '@prisma/client'
import { randomUUID } from 'crypto'

/**
 * Retorna o tempo de vida (TTL) em minutos para reservas de estoque de pronta entrega.
 * Padrão: 30 minutos (definido em ORDER_RESERVATION_TTL_MINUTES).
 */
export function getReservationTtlMinutes(): number {
  const envVal = process.env.ORDER_RESERVATION_TTL_MINUTES
  const parsed = envVal ? parseInt(envVal, 10) : 30
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30
}

export interface ReserveItemInput {
  orderItemId: string
  productId: string
  variantId?: string | null
  quantity: number
  isMadeToOrder?: boolean
}

export interface ReserveStockParams {
  orderId: string
  items: ReserveItemInput[]
  ttlMinutes?: number
  actorUserId?: string
}

export interface ConfirmReservationParams {
  orderId: string
  actorUserId?: string
}

export interface ReleaseReservationParams {
  orderId: string
  reason?: string
  actorUserId?: string
  status?: StockReservationStatus
}

/**
 * Cria a reserva atômica de estoque para itens de Pronta Entrega.
 *
 * Regras:
 * - Itens Sob Encomenda (isMadeToOrder === true) são IGNORADOS (não consomem saldo físico nem criam reserva).
 * - Utiliza raw SQL para atualizar `reservedStock` condicionalmente garantindo que:
 *   (stock - reservedStock) >= quantity
 * - Registra o registro em `StockReservation` (status: ACTIVE, expiresAt).
 * - Registra a movimentação em `StockMovement` (type: RESERVE).
 */
export async function reserveStockAtomically(
  tx: Prisma.TransactionClient,
  params: ReserveStockParams
): Promise<StockReservation[]> {
  const { orderId, items, actorUserId } = params
  const ttl = params.ttlMinutes && params.ttlMinutes > 0 ? params.ttlMinutes : getReservationTtlMinutes()
  const expiresAt = new Date(Date.now() + ttl * 60 * 1000)

  const createdReservations: StockReservation[] = []

  for (const item of items) {
    if (item.isMadeToOrder) {
      continue
    }

    if (!item.productId || item.quantity <= 0) {
      continue
    }

    if (item.variantId) {
      const affected = await tx.$executeRaw`
        UPDATE "variants"
        SET "reservedStock" = "reservedStock" + ${item.quantity}
        WHERE "id" = ${item.variantId}
          AND ("stock" - "reservedStock") >= ${item.quantity}
      `

      if (affected === 0) {
        throw new Error(
          `Estoque insuficiente para reservar a variante selecionada (ID: ${item.variantId}).`
        )
      }
    } else {
      const affected = await tx.$executeRaw`
        UPDATE "products"
        SET "reservedStock" = "reservedStock" + ${item.quantity}
        WHERE "id" = ${item.productId}
          AND "archivedAt" IS NULL
          AND ("stock" - "reservedStock") >= ${item.quantity}
      `

      if (affected === 0) {
        throw new Error(
          `Estoque insuficiente para reservar o produto selecionado (ID: ${item.productId}).`
        )
      }
    }

    const reservation = await tx.stockReservation.create({
      data: {
        orderId,
        orderItemId: item.orderItemId,
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        status: StockReservationStatus.ACTIVE,
        expiresAt,
      },
    })

    await tx.stockMovement.create({
      data: {
        idempotencyKey: `reserve-${item.orderItemId}-${randomUUID()}`,
        productId: item.productId,
        variantId: item.variantId ?? null,
        orderId,
        orderItemId: item.orderItemId,
        actorUserId: actorUserId ?? null,
        type: StockMovementType.RESERVE,
        quantity: item.quantity,
        reason: 'Reserva temporária de pronta entrega na criação do pedido',
      },
    })

    createdReservations.push(reservation)
  }

  return createdReservations
}

/**
 * Confirma atomicamente as reservas ativas de um pedido aprovado (PAID).
 *
 * Regras:
 * - Para cada reserva ACTIVE vinculada ao pedido:
 *   - Decrementa `stock` e `reservedStock` pelo saldo da reserva via raw SQL.
 *   - Atualiza `StockReservation` para `CONFIRMED`.
 *   - Registra `StockMovement` (type: CONSUME_RESERVE).
 * - Caso existam itens de pronta entrega sem reserva ativa prévia (ex: legado ou venda assistida),
 *   executa a baixa direta no `stock` e registra `CONSUME_RESERVE`.
 */
export async function confirmReservationAtomically(
  tx: Prisma.TransactionClient,
  params: ConfirmReservationParams
): Promise<void> {
  const { orderId, actorUserId } = params

  const activeReservations = await tx.stockReservation.findMany({
    where: {
      orderId,
      status: StockReservationStatus.ACTIVE,
    },
  })

  for (const res of activeReservations) {
    if (res.variantId) {
      const affected = await tx.$executeRaw`
        UPDATE "variants"
        SET "stock" = "stock" - ${res.quantity},
            "reservedStock" = "reservedStock" - ${res.quantity}
        WHERE "id" = ${res.variantId}
          AND "stock" >= ${res.quantity}
          AND "reservedStock" >= ${res.quantity}
      `
      if (affected === 0) {
        throw new Error(
          `Conflito ao confirmar reserva da variante ${res.variantId}: saldo ou reserva incompatível.`
        )
      }
    } else {
      const affected = await tx.$executeRaw`
        UPDATE "products"
        SET "stock" = "stock" - ${res.quantity},
            "reservedStock" = "reservedStock" - ${res.quantity}
        WHERE "id" = ${res.productId}
          AND "stock" >= ${res.quantity}
          AND "reservedStock" >= ${res.quantity}
      `
      if (affected === 0) {
        throw new Error(
          `Conflito ao confirmar reserva do produto ${res.productId}: saldo ou reserva incompatível.`
        )
      }
    }

    await tx.stockReservation.update({
      where: { id: res.id },
      data: {
        status: StockReservationStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
    })

    await tx.stockMovement.create({
      data: {
        idempotencyKey: `consume-res-${res.id}`,
        productId: res.productId,
        variantId: res.variantId,
        orderId,
        orderItemId: res.orderItemId,
        actorUserId: actorUserId ?? null,
        type: StockMovementType.CONSUME_RESERVE,
        quantity: res.quantity,
        reason: 'Baixa definitiva de pronta entrega por confirmação de pagamento (PAID)',
      },
    })
  }
}

/**
 * Libera atomicamente as reservas ativas de um pedido cancelado ou expirado.
 *
 * Regras:
 * - Decrementa `reservedStock` via raw SQL (o `stock` físico permanece intacto).
 * - Atualiza `StockReservation` para `RELEASED` ou `EXPIRED`.
 * - Registra `StockMovement` (type: RELEASE_RESERVE).
 */
export async function releaseReservationAtomically(
  tx: Prisma.TransactionClient,
  params: ReleaseReservationParams
): Promise<void> {
  const { orderId, reason = 'Cancelamento ou expiração do pedido', actorUserId, status = StockReservationStatus.RELEASED } = params

  const activeReservations = await tx.stockReservation.findMany({
    where: {
      orderId,
      status: StockReservationStatus.ACTIVE,
    },
  })

  for (const res of activeReservations) {
    if (res.variantId) {
      await tx.$executeRaw`
        UPDATE "variants"
        SET "reservedStock" = "reservedStock" - ${res.quantity}
        WHERE "id" = ${res.variantId}
          AND "reservedStock" >= ${res.quantity}
      `
    } else {
      await tx.$executeRaw`
        UPDATE "products"
        SET "reservedStock" = "reservedStock" - ${res.quantity}
        WHERE "id" = ${res.productId}
          AND "reservedStock" >= ${res.quantity}
      `
    }

    await tx.stockReservation.update({
      where: { id: res.id },
      data: {
        status,
        releasedAt: new Date(),
        releaseReason: reason,
      },
    })

    await tx.stockMovement.create({
      data: {
        idempotencyKey: `release-res-${res.id}-${randomUUID()}`,
        productId: res.productId,
        variantId: res.variantId,
        orderId,
        orderItemId: res.orderItemId,
        actorUserId: actorUserId ?? null,
        type: StockMovementType.RELEASE_RESERVE,
        quantity: res.quantity,
        reason,
      },
    })
  }
}
