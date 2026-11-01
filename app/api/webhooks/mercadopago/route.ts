import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createHmac, timingSafeEqual } from 'crypto'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { prisma } from '@/lib/prisma'

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

export async function POST(request: NextRequest) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) {
    console.error('Webhook Mercado Pago: MERCADOPAGO_ACCESS_TOKEN ausente.')
    return NextResponse.json({ error: 'Configuração ausente.' }, { status: 500 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    body = {}
  }

  const searchParams = request.nextUrl.searchParams
  const type = String(body.type || body.topic || searchParams.get('type') || searchParams.get('topic') || '')
  const dataObj = (body.data as Record<string, unknown> | undefined) || {}
  const paymentId = String(
    dataObj.id || searchParams.get('data.id') || searchParams.get('id') || ''
  ).trim()

  if (!paymentId || (type && !type.includes('payment'))) {
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (webhookSecret && !verifyMercadoPagoSignature(request, paymentId, webhookSecret)) {
    console.error('Webhook Mercado Pago: assinatura x-signature inválida.')
    return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 })
  }

  try {
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

    const mpStatus = mpPayment.status || 'pending'

    if (mpStatus === 'approved') {
      const eventKey = `mp-approved-${paymentId}`

      await prisma.$transaction(async (tx) => {
        const existingLog = await tx.paymentWebhookLog.findUnique({
          where: { eventId: eventKey },
        })
        if (existingLog) return

        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { items: true },
        })
        if (!order || order.paymentStatus === 'PAID') return

        await tx.paymentWebhookLog.create({
          data: {
            eventId: eventKey,
            status: 'approved',
          },
        })

        for (const item of order.items) {
          if (item.variantId) {
            const updatedVariant = await tx.variant.updateMany({
              where: {
                id: item.variantId,
                stock: { gte: item.quantity },
              },
              data: {
                stock: { decrement: item.quantity },
              },
            })
            if (updatedVariant.count === 0) {
              throw new Error(`Estoque insuficiente na confirmação da variante ${item.variantId}.`)
            }
          } else {
            const updatedProduct = await tx.product.updateMany({
              where: {
                id: item.productId,
                archivedAt: null,
                stock: { gte: item.quantity },
              },
              data: {
                stock: { decrement: item.quantity },
              },
            })
            if (updatedProduct.count === 0) {
              throw new Error(`Estoque insuficiente na confirmação do produto ${item.productId}.`)
            }
          }
        }

        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
          },
        })
      })

      revalidatePath(`/marketplace/checkout/${orderId}`)
      revalidatePath('/profile/orders')
      revalidatePath('/admin/orders')
      revalidatePath('/admin')
      revalidatePath('/marketplace')
    } else if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
      const eventKey = `mp-${mpStatus}-${paymentId}`
      const existingLog = await prisma.paymentWebhookLog.findUnique({
        where: { eventId: eventKey },
      })

      if (!existingLog) {
        await prisma.$transaction([
          prisma.paymentWebhookLog.create({
            data: { eventId: eventKey, status: mpStatus },
          }),
          prisma.order.updateMany({
            where: { id: orderId, paymentStatus: 'PENDING' },
            data: { paymentStatus: 'FAILED' },
          }),
        ])
        revalidatePath(`/marketplace/checkout/${orderId}`)
        revalidatePath('/profile/orders')
        revalidatePath('/admin/orders')
      }
    } else if (mpStatus === 'refunded' || mpStatus === 'charged_back') {
      const eventKey = `mp-refunded-${paymentId}`
      const existingLog = await prisma.paymentWebhookLog.findUnique({
        where: { eventId: eventKey },
      })

      if (!existingLog) {
        await prisma.$transaction([
          prisma.paymentWebhookLog.create({
            data: { eventId: eventKey, status: mpStatus },
          }),
          prisma.order.update({
            where: { id: orderId },
            data: { paymentStatus: 'REFUNDED' },
          }),
        ])
        revalidatePath(`/marketplace/checkout/${orderId}`)
        revalidatePath('/profile/orders')
        revalidatePath('/admin/orders')
      }
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('Erro no processamento do webhook Mercado Pago:', error)
    return NextResponse.json({ error: 'Falha ao processar webhook.' }, { status: 500 })
  }
}
