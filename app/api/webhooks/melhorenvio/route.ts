import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createHmac, timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'

interface MelhorEnvioWebhookEvent {
  id?: string
  status?: string
  tracking?: string
  tracking_code?: string
  self_tracking?: string
  protocol?: string
  [key: string]: unknown
}

function verifyMelhorEnvioSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): boolean {
  try {
    const expected = createHmac('sha256', secret).update(rawBody).digest('base64')
    const expectedBuf = Buffer.from(expected)
    const receivedBuf = Buffer.from(signatureHeader.trim())
    if (expectedBuf.length !== receivedBuf.length) return false
    return timingSafeEqual(expectedBuf, receivedBuf)
  } catch {
    return false
  }
}

/**
 * Endpoint de Webhook do Melhor Envio (/api/webhooks/melhorenvio).
 *
 * Recebe notificações de rastreio e eventos de etiquetas (posted, delivered, undelivered, canceled).
 * Regras do Documento-Mestre (E10):
 * - Preserva o histórico em adminNotes sem apagar registros anteriores.
 * - Impede que pacotes já em DELIVERED regridam de status por eventos atrasados.
 * - Retorna sempre HTTP 200 OK para evitar reprocessamento em loop pelo provedor.
 */
export async function POST(request: NextRequest) {
  try {
    const userAgent = request.headers.get('user-agent') || ''
    const signature = request.headers.get('x-me-signature') || ''
    const webhookSecret = process.env.MELHOR_ENVIO_WEBHOOK_SECRET || process.env.MELHOR_ENVIO_SECRET

    const rawBody = await request.text()
    if (!rawBody || !rawBody.trim()) {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // Validação de segurança: X-ME-Signature (quando secret configurado) ou User-Agent contendo 'MelhorEnvio'
    if (webhookSecret && signature) {
      if (!verifyMelhorEnvioSignature(rawBody, signature, webhookSecret)) {
        console.error('[Webhook Melhor Envio] Assinatura X-ME-Signature inválida.')
        return NextResponse.json({ received: true }, { status: 200 })
      }
    } else if (
      process.env.NODE_ENV === 'production' &&
      !userAgent.toLowerCase().includes('melhorenvio') &&
      !signature
    ) {
      console.warn('[Webhook Melhor Envio] Requisição ignorada: User-Agent não reconhecido.')
      return NextResponse.json({ received: true }, { status: 200 })
    }

    let parsedBody: unknown
    try {
      parsedBody = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // O Melhor Envio pode enviar um array de objetos ou um objeto único/envelope { data: [...] }
    const events: MelhorEnvioWebhookEvent[] = Array.isArray(parsedBody)
      ? (parsedBody as MelhorEnvioWebhookEvent[])
      : parsedBody && typeof parsedBody === 'object'
      ? Array.isArray((parsedBody as Record<string, unknown>).data)
        ? ((parsedBody as Record<string, unknown>).data as MelhorEnvioWebhookEvent[])
        : [parsedBody as MelhorEnvioWebhookEvent]
      : []

    if (events.length === 0) {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    let shouldRevalidate = false

    for (const rawEvent of events) {
      if (!rawEvent || typeof rawEvent !== 'object') continue

      // Suporta formato direto { id, status, tracking } ou envelope { event, data: { id, status, tracking } }
      const nestedData =
        rawEvent.data && typeof rawEvent.data === 'object'
          ? (rawEvent.data as Record<string, unknown>)
          : null

      const externalId = String(nestedData?.id ?? rawEvent.id ?? '').trim()
      if (!externalId) continue

      const rawStatus = String(
        nestedData?.status ?? rawEvent.status ?? rawEvent.event ?? ''
      )
        .trim()
        .toLowerCase()

      const normalizedStatus = rawStatus.replace(/^order\./, '')

      const incomingTracking = String(
        nestedData?.tracking ??
          nestedData?.tracking_code ??
          nestedData?.self_tracking ??
          rawEvent.tracking ??
          rawEvent.tracking_code ??
          rawEvent.self_tracking ??
          ''
      ).trim()

      const order = await prisma.order.findFirst({
        where: { externalShipmentId: externalId },
        select: {
          id: true,
          logisticsStatus: true,
          trackingCode: true,
          adminNotes: true,
          shippedAt: true,
          deliveredAt: true,
        },
      })

      if (!order) {
        continue
      }

      const timestamp = new Date().toLocaleString('pt-BR')

      // REGRA DE ESTADO: Se a Order já estiver DELIVERED, nunca regredir o logisticsStatus
      if (order.logisticsStatus === 'DELIVERED') {
        if (normalizedStatus === 'delivered') {
          continue
        }

        // Caso chegue um alerta tardio de cancelamento, apenas registra em adminNotes sem regredir status
        if (normalizedStatus === 'canceled' || normalizedStatus === 'cancelled') {
          const cancelNote = `[Webhook Melhor Envio (${timestamp}): Alerta de cancelamento da etiqueta ${externalId} recebido após pedido já constar como ENTREGUE]`
          if (!order.adminNotes?.includes(cancelNote)) {
            await prisma.order.update({
              where: { id: order.id },
              data: {
                adminNotes: order.adminNotes ? `${order.adminNotes}\n${cancelNote}` : cancelNote,
              },
            })
            shouldRevalidate = true
          }
        }
        continue
      }

      if (normalizedStatus === 'posted' || normalizedStatus === 'shipped') {
        const nextTracking = incomingTracking || order.trackingCode || null
        const postedNote = `[Webhook Melhor Envio (${timestamp}): Objeto postado${nextTracking ? ` — Rastreio: ${nextTracking}` : ''}]`

        await prisma.order.update({
          where: { id: order.id },
          data: {
            logisticsStatus: 'SHIPPED',
            trackingCode: nextTracking,
            shippedAt: order.shippedAt || new Date(),
            adminNotes: order.adminNotes ? `${order.adminNotes}\n${postedNote}` : postedNote,
          },
        })
        shouldRevalidate = true
      } else if (normalizedStatus === 'delivered') {
        const nextTracking = incomingTracking || order.trackingCode || null
        const deliveredNote = `[Webhook Melhor Envio (${timestamp}): Pacote entregue ao destinatário]`

        await prisma.order.update({
          where: { id: order.id },
          data: {
            logisticsStatus: 'DELIVERED',
            trackingCode: nextTracking,
            deliveredAt: order.deliveredAt || new Date(),
            adminNotes: order.adminNotes
              ? `${order.adminNotes}\n${deliveredNote}`
              : deliveredNote,
          },
        })
        shouldRevalidate = true
      } else if (normalizedStatus === 'canceled' || normalizedStatus === 'cancelled') {
        const canceledNote = `[ALERTA Webhook Melhor Envio (${timestamp}): Etiqueta ${externalId} foi CANCELADA no Melhor Envio. Status financeiro mantido.]`

        await prisma.order.update({
          where: { id: order.id },
          data: {
            adminNotes: order.adminNotes
              ? `${order.adminNotes}\n${canceledNote}`
              : canceledNote,
          },
        })
        shouldRevalidate = true
      } else if (normalizedStatus === 'undelivered') {
        const undeliveredNote = `[ALERTA Webhook Melhor Envio (${timestamp}): Tentativa de entrega não realizada (undelivered) para a etiqueta ${externalId}.]`

        await prisma.order.update({
          where: { id: order.id },
          data: {
            adminNotes: order.adminNotes
              ? `${order.adminNotes}\n${undeliveredNote}`
              : undeliveredNote,
          },
        })
        shouldRevalidate = true
      }
    }

    if (shouldRevalidate) {
      revalidatePath('/admin/orders')
      revalidatePath('/admin')
      revalidatePath('/profile/orders')
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('[Webhook Melhor Envio] Erro ao processar notificação:', error)
    // Retorna 200 OK para evitar loop infinito de retentativas indevidas em payloads malformados
    return NextResponse.json({ received: true }, { status: 200 })
  }
}
