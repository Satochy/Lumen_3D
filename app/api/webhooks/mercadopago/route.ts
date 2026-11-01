import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createHmac, timingSafeEqual } from 'crypto'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { prisma } from '@/lib/prisma'
import { confirmApprovedPaymentInDb } from '@/lib/mercadopago_sync'

function verifyMercadoPagoSignature(
  request: NextRequest,
  dataId: string,
  webhookSecret: string
): boolean {
  const xSignature = request.headers.get('x-signature')
  const xRequestId = request.headers.get('x-request-id')

  if (!xSignature || !xRequestId) {
    return false
  }

  const parts = xSignature.split(',')
  let ts = ''
  let v1 = ''

  for (const part of parts) {
    const [key, value] = part.split('=')
    if (key?.trim() === 'ts') ts = value?.trim() || ''
    if (key?.trim() === 'v1') v1 = value?.trim() || ''
  }

  if (!ts || !v1) {
    return false
  }

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const expected = createHmac('sha256', webhookSecret).update(manifest).digest('hex')

  try {
    const expectedBuf = Buffer.from(expected, 'hex')
    const receivedBuf = Buffer.from(v1, 'hex')
    if (expectedBuf.length !== receivedBuf.length) return false
    return timingSafeEqual(expectedBuf, receivedBuf)
  } catch {
    return false
  }
}

/**
 * Endpoint de Webhook do Mercado Pago (/api/webhooks/mercadopago).
 *
 * Fluxo (Regras D02 a D07 do Documento-Mestre):
 * 1. Valida o payload recebido e extrai o ID do pagamento.
 * 2. Verifica idempotência em PaymentWebhookLog pelo ID do pagamento; se já processado, retorna 200 OK.
 * 3. Consulta a API oficial do Mercado Pago (MERCADOPAGO_ACCESS_TOKEN) para confirmar se status === 'approved'.
 * 4. Em prisma.$transaction: registra o PaymentWebhookLog, atualiza a Order para PAID e baixa o stock
 *    dos itens de Pronta Entrega (mantendo itens Sob Encomenda sem baixa para a fila de produção).
 * 5. Retorna HTTP 200 OK ao Mercado Pago.
 */
export async function POST(request: NextRequest) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) {
    console.error('Webhook Mercado Pago: MERCADOPAGO_ACCESS_TOKEN não configurado.')
    return NextResponse.json({ error: 'Configuração ausente.' }, { status: 500 })
  }

  // 1. Extrair e validar o ID do pagamento no payload ou query params
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    body = {}
  }

  const searchParams = request.nextUrl.searchParams
  const type = String(
    body.type ||
      body.topic ||
      searchParams.get('type') ||
      searchParams.get('topic') ||
      ''
  ).toLowerCase()

  const dataObj = (body.data as Record<string, unknown> | undefined) || {}
  const paymentId = String(
    dataObj.id || searchParams.get('data.id') || searchParams.get('id') || body.id || ''
  ).trim()

  if (!paymentId || (type && !type.includes('payment'))) {
    return NextResponse.json({ received: true }, { status: 200 })
  }

  // Validação opcional de assinatura caso MERCADOPAGO_WEBHOOK_SECRET esteja definido
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (webhookSecret && !verifyMercadoPagoSignature(request, paymentId, webhookSecret)) {
    console.error('Webhook Mercado Pago: assinatura x-signature inválida.')
    return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 })
  }

  try {
    // 2. Checagem rápida de idempotência antes da chamada externa
    const alreadyLogged = await prisma.paymentWebhookLog.findFirst({
      where: {
        OR: [
          { eventId: paymentId },
          { eventId: `mp-approved-${paymentId}` },
        ],
      },
    })

    if (alreadyLogged) {
      return NextResponse.json({ received: true, idempotent: true }, { status: 200 })
    }

    // 3. Consultar o status real do pagamento na API do Mercado Pago
    const mpConfig = new MercadoPagoConfig({
      accessToken,
      options: { timeout: 15000 },
    })
    const paymentClient = new Payment(mpConfig)
    const mpPayment = await paymentClient.get({ id: paymentId })

    const orderId = String(
      mpPayment.external_reference ||
        (mpPayment.metadata as Record<string, unknown> | undefined)?.order_id ||
        ''
    ).trim()

    if (!orderId) {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // 4. Atualização transacional (Order -> PAID + baixa de estoque Pronta Entrega + PaymentWebhookLog)
    if (mpPayment.status === 'approved') {
      await confirmApprovedPaymentInDb({
        orderId,
        paymentId,
      })

      revalidatePath(`/marketplace/checkout/${orderId}`)
      revalidatePath('/profile/orders')
      revalidatePath('/admin/orders')
      revalidatePath('/admin')
      revalidatePath('/marketplace')
    }

    // 5. Retornar HTTP 200 ao Mercado Pago
    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('Erro no processamento do webhook Mercado Pago:', error)
    return NextResponse.json({ error: 'Falha ao processar webhook.' }, { status: 500 })
  }
}
