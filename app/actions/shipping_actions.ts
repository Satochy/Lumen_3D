'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sanitizeCEP, isValidCEP, isLocalShippingRegion } from '@/lib/shipping/shipping_utils'

/** CEP de origem da loja (remessa). Vem do ambiente, nunca do cliente. */
const STORE_CEP = sanitizeCEP(process.env.STORE_CEP || process.env.ORIGIN_CEP || '18200000')

export interface ShippingItem {
  weightGrams: number
  dimensions: string
  quantity: number
}

export interface ShippingOption {
  serviceId: string
  serviceName: string
  companyName: string
  price: number
  formattedPrice: string
  deliveryTime: number
  icon: string
  isFree?: boolean
}

export interface ShippingResponse {
  options: ShippingOption[]
  error?: string
}

/**
 * Server Action para calcular frete híbrido (Frete Grátis Local + Melhor Envio)
 * Recebe CEP de destino e itens do carrinho
 */
export async function calculateShippingAction(
  cepDestino: string,
  items: ShippingItem[]
): Promise<ShippingResponse> {
  // 1. Sanitizar e Validar CEP
  const cepSanitizado = sanitizeCEP(cepDestino)

  if (!isValidCEP(cepSanitizado)) {
    return { options: [], error: 'CEP inválido. Digite um CEP com 8 dígitos.' }
  }

  // 2. Validar Itens e quantidades inteiras seguras
  if (!items || items.length === 0) {
    return { options: [], error: 'Carrinho vazio.' }
  }

  for (const item of items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      return {
        options: [],
        error: 'Quantidade inválida para cálculo de frete.',
      }
    }
    if (
      item.weightGrams === undefined ||
      item.weightGrams === null ||
      !Number.isFinite(item.weightGrams) ||
      item.weightGrams <= 0
    ) {
      return {
        options: [],
        error:
          'Um ou mais produtos estão sem peso físico válido configurado para cálculo de frete.',
      }
    }
    if (!item.dimensions || typeof item.dimensions !== 'string' || !item.dimensions.trim()) {
      return {
        options: [],
        error:
          'Um ou mais produtos estão sem dimensões físicas configuradas para cálculo de frete.',
      }
    }
  }

  const options: ShippingOption[] = []

  // 3. Interceptor Regional (Itapetininga e Cidades Vizinhas)
  if (isLocalShippingRegion(cepSanitizado)) {
    options.push({
      serviceId: 'lumen-local-free',
      serviceName: 'Entrega Local / Regional',
      companyName: 'Lúmen 3D',
      price: 0,
      formattedPrice: 'R$ 0,00',
      deliveryTime: 1,
      icon: '🟢',
      isFree: true,
    })
  }

  // 4. Cotação de Transportadoras Externas (Melhor Envio)
  const token = process.env.MELHOR_ENVIO_TOKEN

  // Sem token configurado no .env: bloqueia mock em produção; utiliza opções simuladas apenas em desenvolvimento
  if (!token) {
    if (process.env.NODE_ENV === 'production') {
      console.error('MELHOR_ENVIO_TOKEN ausente em ambiente de produção.')
      if (options.length > 0) return { options }
      return {
        options: [],
        error: 'Frete temporariamente indisponível. Tente novamente mais tarde.',
      }
    }
    const mockOptions = generateMockShippingOptions(items)
    return { options: [...options, ...mockOptions] }
  }

  if (!isValidCEP(STORE_CEP)) {
    console.error('STORE_CEP ausente ou inválido no ambiente')
    if (options.length > 0) return { options }
    return {
      options: [],
      error: 'Frete temporariamente indisponível. Tente novamente mais tarde.',
    }
  }

  const payload = buildMelhorEnvioPayload(cepSanitizado, items)
  const calculateUrl = getMelhorEnvioCalculateUrl()

  try {
    const response = await fetch(calculateUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Lumen3D (suporte@lumen3d.com.br)',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Erro Melhor Envio:', errorData)
      if (options.length > 0) return { options }
      return {
        options: [],
        error: 'Erro ao calcular frete. Tente novamente mais tarde.',
      }
    }

    const data = await response.json()
    const externalOptions = parseMelhorEnvioResponse(data)

    return { options: [...options, ...externalOptions] }
  } catch (error) {
    console.error('Erro na requisição de frete:', error)
    if (options.length > 0) return { options }
    return {
      options: [],
      error: 'Erro de conexão. Verifique sua internet e tente novamente.',
    }
  }
}

/**
 * Resolve a URL do endpoint de cotação do Melhor Envio a partir do ambiente.
 * Usa process.env.MELHOR_ENVIO_API_URL quando configurado; caso contrário,
 * utiliza produção em NODE_ENV === 'production' e sandbox nos demais ambientes.
 */
function getMelhorEnvioCalculateUrl(): string {
  const configuredUrl = process.env.MELHOR_ENVIO_API_URL?.trim()
  if (configuredUrl) {
    const cleanUrl = configuredUrl.replace(/\/$/, '')
    if (cleanUrl.endsWith('/shipment/calculate')) {
      return cleanUrl
    }
    if (cleanUrl.endsWith('/api/v2/me')) {
      return `${cleanUrl}/shipment/calculate`
    }
    return `${cleanUrl}/api/v2/me/shipment/calculate`
  }

  return process.env.NODE_ENV === 'production'
    ? 'https://www.melhorenvio.com.br/api/v2/me/shipment/calculate'
    : 'https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate'
}

/**
 * Constrói o payload para a API do Melhor Envio
 * Envia cada item com peso unitário em kg, dimensões unitárias e sua respectiva quantity
 */
function buildMelhorEnvioPayload(cepDestino: string, items: ShippingItem[]) {
  const products = items.map((item, index) => {
    const dims = getVolumeFromDimensions(item.dimensions)
    const unitWeightKg = Math.max((item.weightGrams || 0) / 1000, 0.001)

    return {
      id: `item-${index + 1}`,
      weight: unitWeightKg,
      width: dims.width,
      height: dims.height,
      length: dims.length,
      quantity: item.quantity,
    }
  })

  return {
    from: {
      postal_code: STORE_CEP,
    },
    to: {
      postal_code: cepDestino,
    },
    products,
    options: {
      insurance_value: 0,
      receipt: false,
      own_hand: false,
    },
  }
}

/**
 * Extrai dimensões da string de dimensões (ex: "15x10x10 cm")
 */
function getVolumeFromDimensions(dimensions: string): {
  width: number
  height: number
  length: number
} {
  const numbers = dimensions.match(/[\d.]+/g)?.map(Number) || [10, 10, 10]
  const [width, height, length] =
    numbers.length >= 3
      ? numbers
      : numbers.length === 2
      ? [...numbers, 5]
      : numbers.length === 1
      ? [numbers[0], numbers[0], 5]
      : [10, 10, 10]

  return { width, height, length }
}

/**
 * Processa a resposta da API do Melhor Envio (suporta Array e Objeto)
 */
function parseMelhorEnvioResponse(data: unknown): ShippingOption[] {
  const options: ShippingOption[] = []

  if (Array.isArray(data)) {
    data.forEach((rawItem: unknown) => {
      if (!rawItem || typeof rawItem !== 'object') return
      const item = rawItem as Record<string, unknown>
      const company = item.company as Record<string, unknown> | undefined
      if (!item.error && item.price) {
        const price = Number(item.price || 0)
        options.push({
          serviceId: `me-${String(item.id)}`,
          serviceName: String(item.name || 'Envio'),
          companyName: String(company?.name || 'Transportadora'),
          price,
          formattedPrice: formatCurrencyBR(price),
          deliveryTime: Number(item.delivery_time || 0),
          icon: getServiceIcon(String(item.name || '')),
          isFree: false,
        })
      }
    })
  } else if (data && typeof data === 'object') {
    for (const [serviceId, serviceData] of Object.entries(data)) {
      const service = serviceData as Record<string, unknown>
      if (!service || service.error) continue

      const price = Number(service.price || 0)
      if (!price) continue

      const company = service.company as Record<string, unknown> | undefined

      options.push({
        serviceId,
        serviceName: String(service.name || serviceId),
        companyName: String(company?.name || 'Transportadora'),
        price,
        formattedPrice: formatCurrencyBR(price),
        deliveryTime: Number(service.delivery_time || 0),
        icon: getServiceIcon(serviceId),
        isFree: false,
      })
    }
  }

  return options.sort((a, b) => a.price - b.price)
}

/**
 * Gera opções simuladas para desenvolvimento (sem token)
 */
function generateMockShippingOptions(items: ShippingItem[]): ShippingOption[] {
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0)
  const basePrice = Math.max(itemCount * 5, 15)

  return [
    {
      serviceId: 'pac',
      serviceName: 'PAC',
      companyName: 'Correios',
      price: basePrice,
      formattedPrice: formatCurrencyBR(basePrice),
      deliveryTime: 7,
      icon: '📦',
      isFree: false,
    },
    {
      serviceId: 'sedex',
      serviceName: 'SEDEX',
      companyName: 'Correios',
      price: basePrice * 1.8,
      formattedPrice: formatCurrencyBR(basePrice * 1.8),
      deliveryTime: 3,
      icon: '🚀',
      isFree: false,
    },
    {
      serviceId: 'jadlog',
      serviceName: 'Jadlog Package',
      companyName: 'Jadlog',
      price: basePrice * 1.4,
      formattedPrice: formatCurrencyBR(basePrice * 1.4),
      deliveryTime: 4,
      icon: '🚚',
      isFree: false,
    },
  ]
}

function formatCurrencyBR(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function getServiceIcon(serviceId: string): string {
  const name = serviceId.toLowerCase()
  if (name.includes('sedex')) return '🚀'
  if (name.includes('pac')) return '📦'
  if (name.includes('jadlog')) return '🚚'
  if (name.includes('azul') || name.includes('latam')) return '✈️'
  return '📦'
}

export interface GenerateLabelResponse {
  success: boolean
  error?: string
  shippingLabelUrl?: string
  externalShipmentId?: string
}

/**
 * Confirma a saída física de pedido com Entrega Local (frota própria).
 * Isento de emissão de etiqueta no Melhor Envio.
 * Atualiza logisticsStatus para SHIPPED e registra o admin responsável.
 */
export async function confirmLocalDeliveryAction(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin()

    if (!orderId || typeof orderId !== 'string') {
      return { success: false, error: 'ID do pedido inválido.' }
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        paymentStatus: true,
        logisticsStatus: true,
        isLocalDelivery: true,
        adminNotes: true,
        shippingAddressSnapshot: true,
      },
    })

    if (!order) {
      return { success: false, error: 'Pedido não encontrado.' }
    }

    const snapshot = order.shippingAddressSnapshot as Record<string, unknown> | null
    const isLocal = Boolean(
      order.isLocalDelivery ||
      snapshot?.isLocalDelivery ||
      (typeof snapshot?.serviceName === 'string' &&
        snapshot.serviceName.toLowerCase().includes('local'))
    )

    if (!isLocal) {
      return {
        success: false,
        error: 'Este pedido não é de Entrega Local e exige emissão de etiqueta para envio.',
      }
    }

    if (order.logisticsStatus !== 'READY_FOR_SHIPPING') {
      return {
        success: false,
        error: `O pedido deve estar com status "Pronto para Envio" (status atual: ${order.logisticsStatus}).`,
      }
    }

    const dispatchNote = `[Saída por Frota Própria confirmada por ${admin.name || admin.username} em ${new Date().toLocaleString('pt-BR')}]`
    const updatedNotes = order.adminNotes
      ? `${order.adminNotes}\n${dispatchNote}`
      : dispatchNote

    await prisma.order.update({
      where: { id: orderId },
      data: {
        logisticsStatus: 'SHIPPED',
        shippedAt: new Date(),
        adminNotes: updatedNotes,
      },
    })

    revalidatePath('/admin/orders')
    revalidatePath('/admin')
    revalidatePath('/profile/orders')

    return { success: true }
  } catch (err: unknown) {
    console.error('Erro ao confirmar entrega local:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Falha ao despachar entrega local.',
    }
  }
}

/**
 * Gera etiqueta de envio do Melhor Envio para pedidos prontos para envio.
 * Fase 2 (E10): Integração HTTP real via fetch com proteção de idempotência.
 */
export async function generateMelhorEnvioLabelAction(
  orderId: string
): Promise<GenerateLabelResponse> {
  try {
    const admin = await requireAdmin()

    if (!orderId || typeof orderId !== 'string') {
      return { success: false, error: 'ID do pedido inválido.' }
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            cpf: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                dimensions: true,
                weightGrams: true,
              },
            },
          },
        },
      },
    })

    if (!order) {
      return { success: false, error: 'Pedido não encontrado.' }
    }

    // 1. Proteção de Idempotência: se externalShipmentId E shippingLabelUrl já existem, retorna imediatamente
    if (order.externalShipmentId && order.shippingLabelUrl) {
      return {
        success: true,
        shippingLabelUrl: order.shippingLabelUrl,
        externalShipmentId: order.externalShipmentId,
      }
    }

    // 2. Validação de elegibilidade (Regras de Negócio)
    if (order.paymentStatus !== 'PAID') {
      return {
        success: false,
        error: 'Etiquetas só podem ser emitidas para pedidos com pagamento confirmado (PAID).',
      }
    }

    if (
      order.logisticsStatus !== 'READY_FOR_SHIPPING' &&
      order.logisticsStatus !== 'SHIPPED'
    ) {
      return {
        success: false,
        error: `O pedido deve estar com status "Pronto para Envio" (status atual: ${order.logisticsStatus}).`,
      }
    }

    const snapshot = order.shippingAddressSnapshot as Record<string, unknown> | null
    const isLocal = Boolean(
      order.isLocalDelivery ||
      snapshot?.isLocalDelivery ||
      (typeof snapshot?.serviceName === 'string' &&
        snapshot.serviceName.toLowerCase().includes('local'))
    )

    if (isLocal) {
      return {
        success: false,
        error: 'Pedidos de Entrega Local são isentos de etiquetas do Melhor Envio.',
      }
    }

    const token = process.env.MELHOR_ENVIO_TOKEN
    if (!token) {
      throw new Error('MELHOR_ENVIO_TOKEN não está configurado nas variáveis de ambiente.')
    }

    const rawBaseUrl = (
      process.env.MELHOR_ENVIO_URL ||
      process.env.MELHOR_ENVIO_API_URL ||
      'https://sandbox.melhorenvio.com.br'
    ).trim()
    const baseUrl = rawBaseUrl
      .replace(/\/$/, '')
      .replace(/\/api\/v2\/me(\/shipment\/calculate)?$/, '')

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'Lumen3D (suporte@lumen3d.com.br)',
    }

    let shipmentId = order.externalShipmentId

    // Se ainda não possui externalShipmentId, executa os passos (a) a (d): Carrinho -> Persistência -> Checkout -> Generate
    if (!shipmentId) {
      if (!snapshot || !snapshot.zipCode) {
        return {
          success: false,
          error: 'Endereço de entrega ou CEP não localizado no snapshot do pedido.',
        }
      }

      // Extrai serviço selecionado (ex: "me-1" -> 1, "me-2" -> 2)
      const rawServiceId = String(snapshot.serviceId || '1')
      const serviceIdNum = parseInt(rawServiceId.replace(/\D/g, ''), 10) || 1

      // Monta remetente (Lúmen 3D)
      const fromData = {
        name: process.env.STORE_NAME || 'Lúmen 3D',
        phone: process.env.STORE_PHONE || '15981159636',
        email: process.env.STORE_EMAIL || 'lumenimpressao3d@gmail.com',
        document: process.env.STORE_DOCUMENT || '00000000000',
        address: process.env.STORE_STREET || 'Rua Principal',
        complement: process.env.STORE_COMPLEMENT || '',
        number: process.env.STORE_NUMBER || '100',
        district: process.env.STORE_NEIGHBORHOOD || 'Centro',
        city: process.env.STORE_CITY || 'Itapetininga',
        state_abbr: process.env.STORE_STATE || 'SP',
        country_id: 'BR',
        postal_code: sanitizeCEP(STORE_CEP || '18200000'),
      }

      // Monta destinatário
      const toData = {
        name: order.user?.name || 'Cliente Lúmen 3D',
        phone: order.user?.phone || '15999999999',
        email: order.user?.email || '',
        document: order.user?.cpf || '00000000000',
        address: String(snapshot.street || ''),
        complement: snapshot.complement ? String(snapshot.complement) : '',
        number: String(snapshot.number || 'S/N'),
        district: String(snapshot.neighborhood || ''),
        city: String(snapshot.city || ''),
        state_abbr: String(snapshot.state || 'SP'),
        country_id: 'BR',
        postal_code: sanitizeCEP(String(snapshot.zipCode || '')),
      }

      // Itens e volumes com fallback global obrigatório: 15x15x15 cm, 0.3 kg
      const productsPayload = order.items.map((item, index) => {
        const dims = item.product?.dimensions
          ? getVolumeFromDimensions(item.product.dimensions)
          : { width: 15, height: 15, length: 15 }

        const rawWeight = item.product?.weightGrams
          ? item.product.weightGrams / 1000
          : 0.3

        const unitWeightKg = Math.max(Number(rawWeight.toFixed(3)), 0.001)

        return {
          id: `item-${index + 1}`,
          name: item.productTitle,
          quantity: item.quantity,
          unitary_value: Number(item.priceUnit),
          weight: unitWeightKg,
          width: dims.width || 15,
          height: dims.height || 15,
          length: dims.length || 15,
        }
      })

      const totalInsuranceValue = Number(order.totalAmount)

      const melhorEnvioCartPayload = {
        service: serviceIdNum,
        from: fromData,
        to: toData,
        products: productsPayload.map((p) => ({
          name: p.name,
          quantity: p.quantity,
          unitary_value: p.unitary_value,
        })),
        volumes: productsPayload.map((p) => ({
          height: p.height,
          width: p.width,
          length: p.length,
          weight: p.weight,
        })),
        options: {
          insurance_value: totalInsuranceValue,
          receipt: false,
          own_hand: false,
          reverse: false,
          non_commercial: true,
        },
      }

      // a) POST /api/v2/me/cart
      const cartRes = await fetch(`${baseUrl}/api/v2/me/cart`, {
        method: 'POST',
        headers,
        body: JSON.stringify(melhorEnvioCartPayload),
      })

      const cartData = (await cartRes.json().catch(() => ({}))) as Record<string, unknown>
      if (!cartRes.ok || !cartData.id) {
        const errMsg =
          typeof cartData.message === 'string'
            ? cartData.message
            : typeof cartData.error === 'string'
            ? cartData.error
            : `Status ${cartRes.status}`
        throw new Error(`Falha ao inserir etiqueta no carrinho do Melhor Envio: ${errMsg}`)
      }

      shipmentId = String(cartData.id)

      // b) Salva IMEDIATAMENTE o externalShipmentId antes do pagamento (checkout)
      await prisma.order.update({
        where: { id: orderId },
        data: {
          externalShipmentId: shipmentId,
        },
      })

      // c) POST /api/v2/me/shipment/checkout
      const checkoutRes = await fetch(`${baseUrl}/api/v2/me/shipment/checkout`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ orders: [shipmentId] }),
      })

      const checkoutData = (await checkoutRes.json().catch(() => ({}))) as Record<string, unknown>
      if (!checkoutRes.ok) {
        const errMsg =
          typeof checkoutData.message === 'string'
            ? checkoutData.message
            : typeof checkoutData.error === 'string'
            ? checkoutData.error
            : `Status ${checkoutRes.status}`
        throw new Error(`Falha no checkout (pagamento) da etiqueta no Melhor Envio: ${errMsg}`)
      }

      // d) POST /api/v2/me/shipment/generate
      const generateRes = await fetch(`${baseUrl}/api/v2/me/shipment/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ orders: [shipmentId] }),
      })

      const generateData = (await generateRes.json().catch(() => ({}))) as Record<string, unknown>
      if (!generateRes.ok) {
        const errMsg =
          typeof generateData.message === 'string'
            ? generateData.message
            : typeof generateData.error === 'string'
            ? generateData.error
            : `Status ${generateRes.status}`
        throw new Error(`Falha ao gerar etiqueta no Melhor Envio: ${errMsg}`)
      }
    }

    // e) POST /api/v2/me/shipment/print (Executado também diretamente quando externalShipmentId já existia sem shippingLabelUrl)
    const printRes = await fetch(`${baseUrl}/api/v2/me/shipment/print`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ mode: 'public', orders: [shipmentId] }),
    })

    const printData = (await printRes.json().catch(() => ({}))) as Record<string, unknown>
    if (!printRes.ok || typeof printData.url !== 'string' || !printData.url) {
      const errMsg =
        typeof printData.message === 'string'
          ? printData.message
          : typeof printData.error === 'string'
          ? printData.error
          : `Status ${printRes.status}`
      throw new Error(`Falha ao obter URL de impressão da etiqueta no Melhor Envio: ${errMsg}`)
    }

    const labelUrl = printData.url

    // 3. Persistência Final
    const labelNote = `[Etiqueta Melhor Envio emitida via API (${shipmentId}) por ${admin.name || admin.username} em ${new Date().toLocaleString('pt-BR')}]`
    const updatedAdminNotes = order.adminNotes
      ? `${order.adminNotes}\n${labelNote}`
      : labelNote

    await prisma.order.update({
      where: { id: orderId },
      data: {
        shippingLabelUrl: labelUrl,
        externalShipmentId: shipmentId,
        logisticsStatus: 'SHIPPED',
        shippedAt: order.shippedAt || new Date(),
        adminNotes: updatedAdminNotes,
      },
    })

    revalidatePath('/admin/orders')
    revalidatePath('/admin')
    revalidatePath('/profile/orders')

    return {
      success: true,
      shippingLabelUrl: labelUrl,
      externalShipmentId: shipmentId,
    }
  } catch (err: unknown) {
    console.error('Erro ao gerar etiqueta no Melhor Envio:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Falha ao emitir etiqueta no Melhor Envio.',
    }
  }
}