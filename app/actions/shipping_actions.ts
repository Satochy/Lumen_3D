'use server'

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

  // 2. Validar Itens
  if (!items || items.length === 0) {
    return { options: [], error: 'Carrinho vazio.' }
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

  // Sem token configurado no .env, utiliza as opções simuladas para desenvolvimento
  if (!token) {
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

  try {
    const response = await fetch(
      'https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'Lumen3D (suporte@lumen3d.com.br)',
        },
        body: JSON.stringify(payload),
      }
    )

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
 * Constrói o payload para a API do Melhor Envio
 */
function buildMelhorEnvioPayload(cepDestino: string, items: ShippingItem[]) {
  const totalWeightKg = items.reduce(
    (acc, item) => acc + (item.weightGrams / 1000) * item.quantity,
    0
  )

  const maxDims = items.reduce(
    (max, item) => {
      const dims = getVolumeFromDimensions(item.dimensions)
      const volume = dims.width * dims.height * dims.length
      return volume > max.volume ? { ...dims, volume } : max
    },
    { width: 0, height: 0, length: 0, volume: 0 }
  )

  return {
    from: {
      postal_code: STORE_CEP,
    },
    to: {
      postal_code: cepDestino,
    },
    products: [
      {
        weight: Math.max(totalWeightKg, 0.001),
        width: maxDims.width,
        height: maxDims.height,
        length: maxDims.length,
        quantity: items.reduce((acc, item) => acc + item.quantity, 0),
      },
    ],
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
    data.forEach((item: any) => {
      if (!item.error && item.price) {
        const price = Number(item.price || 0)
        options.push({
          serviceId: `me-${item.id}`,
          serviceName: String(item.name || 'Envio'),
          companyName: String(item.company?.name || 'Transportadora'),
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