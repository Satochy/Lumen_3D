/**
 * Suite de Verificação Estática e de Integridade de Domínio
 * Lúmen 3D — Cenários V27, V48, V74, V76 e V80
 *
 * Execução: npx tsx scripts/verify_core_integrity.ts
 */

import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { Prisma, StockReservationStatus, StockMovementType, OrderOccurrenceType } from '@prisma/client'
import { reserveStockAtomically, confirmReservationAtomically, getReservationTtlMinutes } from '../lib/stock/reservation_service'

interface TestResult {
  scenario: string
  title: string
  passed: boolean
  details: string
}

const results: TestResult[] = []

function logPass(scenario: string, title: string, details: string) {
  results.push({ scenario, title, passed: true, details })
  console.log(`\x1b[32m✔ [${scenario}] ${title}\x1b[0m\n   ${details}`)
}

function logFail(scenario: string, title: string, error: unknown) {
  results.push({ scenario, title, passed: false, details: String(error) })
  console.error(`\x1b[31m✖ [${scenario}] ${title}\x1b[0m\n   ${error}`)
}

async function runIntegritySuite() {
  console.log('\n============================================================')
  console.log('  LÚMEN 3D — VERIFICAÇÃO DE INTEGRIDADE FINANCEIRA E ESTOQUE')
  console.log('============================================================\n')

  // ------------------------------------------------------------------------
  // Cenário V27: Reserva atômica de pronta entrega
  // ------------------------------------------------------------------------
  try {
    const executedSql: string[] = []
    const createdReservations: any[] = []
    const createdMovements: any[] = []

    const mockTx = {
      $executeRaw: async (query: any, ...values: any[]) => {
        const sql = typeof query === 'string' ? query : query?.strings?.join('?') ?? JSON.stringify(query)
        executedSql.push(sql)
        return 1 // 1 row updated
      },
      stockReservation: {
        create: async ({ data }: any) => {
          createdReservations.push(data)
          return { id: 'mock-res-1', ...data }
        },
      },
      stockMovement: {
        create: async ({ data }: any) => {
          createdMovements.push(data)
          return { id: 'mock-mov-1', ...data }
        },
      },
    } as unknown as Prisma.TransactionClient

    const orderId = '00000000-0000-0000-0000-000000000001'
    const orderItemId = '11111111-1111-1111-1111-111111111111'
    const productId = '22222222-2222-2222-2222-222222222222'

    const reserved = await reserveStockAtomically(mockTx, {
      orderId,
      items: [
        {
          orderItemId,
          productId,
          quantity: 2,
          isMadeToOrder: false,
        },
      ],
      ttlMinutes: 30,
    })

    assert.strictEqual(reserved.length, 1, 'Deveria ter gerado 1 reserva')
    assert.strictEqual(createdReservations.length, 1, 'Deveria ter persistido 1 StockReservation')
    assert.strictEqual(createdReservations[0].status, StockReservationStatus.ACTIVE)
    assert.strictEqual(createdReservations[0].quantity, 2)
    assert.strictEqual(createdMovements.length, 1, 'Deveria ter registrado 1 StockMovement')
    assert.strictEqual(createdMovements[0].type, StockMovementType.RESERVE)
    assert.strictEqual(createdMovements[0].quantity, 2)

    // Validar contrato de SQL atômico condicional
    const hasReservedStockIncrement = executedSql.some(
      (sql) => sql.includes('reservedStock') && sql.includes('products')
    )
    assert.ok(hasReservedStockIncrement, 'O SQL executado deve atualizar reservedStock em products')

    logPass(
      'V27',
      'Criação de pedido com reserva atômica de pronta entrega',
      'Incrementa reservedStock via raw SQL, gera StockReservation (ACTIVE) e StockMovement (RESERVE).'
    )
  } catch (err) {
    logFail('V27', 'Criação de pedido com reserva atômica de pronta entrega', err)
  }

  // ------------------------------------------------------------------------
  // Cenário V48: Itens sob encomenda (isMadeToOrder === true) NÃO reservam estoque físico
  // ------------------------------------------------------------------------
  try {
    let sqlExecuted = false
    const createdReservations: any[] = []

    const mockTx = {
      $executeRaw: async () => {
        sqlExecuted = true
        return 1
      },
      stockReservation: {
        create: async ({ data }: any) => {
          createdReservations.push(data)
          return data
        },
      },
      stockMovement: {
        create: async () => {},
      },
    } as unknown as Prisma.TransactionClient

    const reserved = await reserveStockAtomically(mockTx, {
      orderId: '00000000-0000-0000-0000-000000000002',
      items: [
        {
          orderItemId: '33333333-3333-3333-3333-333333333333',
          productId: '44444444-4444-4444-4444-444444444444',
          quantity: 5,
          isMadeToOrder: true, // SOB ENCOMENDA
        },
      ],
    })

    assert.strictEqual(reserved.length, 0, 'Itens sob encomenda não devem retornar reservas')
    assert.strictEqual(createdReservations.length, 0, 'Nenhuma StockReservation deve ser criada')
    assert.strictEqual(sqlExecuted, false, 'Nenhum SQL de reserva física deve ser executado para sob encomenda')

    logPass(
      'V48',
      'Isenção de reserva para itens Sob Encomenda',
      'Itens com isMadeToOrder=true não alteram reservedStock físico nem criam movimentação de reserva.'
    )
  } catch (err) {
    logFail('V48', 'Isenção de reserva para itens Sob Encomenda', err)
  }

  // ------------------------------------------------------------------------
  // Cenário V74: Confirmação atômica de pagamento (PAID) consome reserva
  // ------------------------------------------------------------------------
  try {
    const executedSql: string[] = []
    const updatedReservations: any[] = []
    const createdMovements: any[] = []

    const mockTx = {
      stockReservation: {
        findMany: async () => [
          {
            id: 'res-abc',
            orderId: 'ord-123',
            orderItemId: 'item-123',
            productId: 'prod-123',
            variantId: null,
            quantity: 3,
            status: StockReservationStatus.ACTIVE,
          },
        ],
        update: async ({ where, data }: any) => {
          updatedReservations.push({ where, data })
          return { id: where.id, ...data }
        },
      },
      $executeRaw: async (query: any) => {
        const sql = typeof query === 'string' ? query : query?.strings?.join('?') ?? JSON.stringify(query)
        executedSql.push(sql)
        return 1
      },
      stockMovement: {
        create: async ({ data }: any) => {
          createdMovements.push(data)
          return data
        },
      },
    } as unknown as Prisma.TransactionClient

    await confirmReservationAtomically(mockTx, { orderId: 'ord-123' })

    assert.strictEqual(updatedReservations.length, 1)
    assert.strictEqual(updatedReservations[0].data.status, StockReservationStatus.CONFIRMED)
    assert.strictEqual(createdMovements.length, 1)
    assert.strictEqual(createdMovements[0].type, StockMovementType.CONSUME_RESERVE)
    assert.strictEqual(createdMovements[0].quantity, 3)

    const hasStockAndReservedDecrement = executedSql.some(
      (sql) => sql.includes('stock') && sql.includes('reservedStock') && (sql.includes('-') || sql.includes('decrement'))
    )
    if (!hasStockAndReservedDecrement) {
      console.log('DEBUG executedSql in V74:', executedSql)
    }
    assert.ok(hasStockAndReservedDecrement, 'SQL deve decrementar simultaneamente stock e reservedStock')

    logPass(
      'V74',
      'Confirmação atômica de pagamento consome reserva',
      'Transiciona StockReservation para CONFIRMED, decrementa stock e reservedStock e gera CONSUME_RESERVE.'
    )
  } catch (err) {
    logFail('V74', 'Confirmação atômica de pagamento consome reserva', err)
  }

  // ------------------------------------------------------------------------
  // Cenário V76: Cancelamento administrativo de pedido PAID estorna estoque com RESTOCK_RETURN
  // ------------------------------------------------------------------------
  try {
    const ordersFilePath = path.join(process.cwd(), 'app', 'actions', 'orders.ts')
    const ordersCode = fs.readFileSync(ordersFilePath, 'utf8')

    assert.ok(
      ordersCode.includes("StockMovementType.RESTOCK_RETURN"),
      'orders.ts deve registrar StockMovementType.RESTOCK_RETURN no cancelamento administrativo de pedido pago'
    )
    assert.ok(
      ordersCode.includes("isMadeToOrder") && ordersCode.includes("continue"),
      'orders.ts deve ignorar itens sob encomenda na devolução de estoque'
    )
    assert.ok(
      ordersCode.includes("cancelledAt: new Date()"),
      'orders.ts deve preencher cancelledAt no cancelamento'
    )

    logPass(
      'V76',
      'Cancelamento administrativo de pedido pago com RESTOCK_RETURN',
      'Devolve saldo físico exclusivamente para itens de pronta entrega e audita com StockMovementType.RESTOCK_RETURN.'
    )
  } catch (err) {
    logFail('V76', 'Cancelamento administrativo de pedido pago com RESTOCK_RETURN', err)
  }

  // ------------------------------------------------------------------------
  // Cenário V80: Auditoria estrita e geração de OrderOccurrence em divergências financeiras
  // ------------------------------------------------------------------------
  try {
    const syncFilePath = path.join(process.cwd(), 'lib', 'mercadopago_sync.ts')
    const syncCode = fs.readFileSync(syncFilePath, 'utf8')

    assert.ok(
      syncCode.includes("OrderOccurrenceType.AMOUNT_OR_CURRENCY_MISMATCH"),
      'mercadopago_sync.ts deve gerar ocorrência de AMOUNT_OR_CURRENCY_MISMATCH em caso de divergência de valor ou moeda'
    )
    assert.ok(
      syncCode.includes("OrderOccurrenceType.LATE_PAYMENT_AFTER_CANCEL"),
      'mercadopago_sync.ts deve gerar ocorrência de LATE_PAYMENT_AFTER_CANCEL caso pagamento chegue para pedido cancelado'
    )
    assert.ok(
      syncCode.includes("OrderOccurrenceType.COLLECTOR_OR_ENV_MISMATCH"),
      'mercadopago_sync.ts deve gerar ocorrência de COLLECTOR_OR_ENV_MISMATCH em external_reference divergente'
    )
    assert.ok(
      syncCode.includes("hasOpenOccurrence: true"),
      'mercadopago_sync.ts deve marcar hasOpenOccurrence no pedido'
    )
    assert.ok(
      syncCode.includes("paymentStatus: { not: 'PAID' }"),
      'mercadopago_sync.ts deve aplicar a trava atômica paymentStatus: { not: PAID }'
    )

    logPass(
      'V80',
      'Auditoria e criação de OrderOccurrence para divergências financeiras',
      'Trava atômica paymentStatus: { not: PAID } aplicada e ocorrências estruturadas registradas para auditoria.'
    )
  } catch (err) {
    logFail('V80', 'Auditoria e criação de OrderOccurrence para divergências financeiras', err)
  }

  // ------------------------------------------------------------------------
  // Resumo
  // ------------------------------------------------------------------------
  console.log('\n------------------------------------------------------------')
  const total = results.length
  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  console.log(`TOTAL: ${total} | PASSOU: ${passed} | FALHOU: ${failed}`)
  console.log('------------------------------------------------------------\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runIntegritySuite().catch((e) => {
  console.error('Erro fatal na suíte de integridade:', e)
  process.exit(1)
})
