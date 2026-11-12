export type OrderOriginChannel = 'Marketplace' | 'WhatsApp' | 'Instagram' | 'Balcão'

export type OrderModality = 'Pronta Entrega' | 'Sob Encomenda' | 'Híbrido'

export type OrderPaymentStatusKey = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'

export type OrderLogisticsStatusKey =
  | 'PREPARING'
  | 'PRODUCING'
  | 'PRINTING'
  | 'POST_PROCESSING'
  | 'READY_FOR_SHIPPING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'

export interface PresentableOrderItem {
  id: string
  orderId?: string
  productId?: string | null
  variantId?: string | null
  productTitle: string
  quantity: number
  priceUnit: number
  isMadeToOrder?: boolean
  productionDays?: number | null
  isReady?: boolean
  productionStatus?: string
  readyAt?: string | null
  readyByUserId?: string | null
  product?: {
    id: string
    title: string
    slug: string
    images?: string[]
    category?: string
    stock?: number
    reservedStock?: number
    isMadeToOrder?: boolean
    productionDays?: number | null
  } | null
}

export interface PresentableOrderOccurrence {
  id: string
  orderId?: string
  type: string
  status: string
  description: string
  metadata?: Record<string, unknown> | null
  createdAt?: string
}

export interface PresentableOrderAddress {
  city?: string
  state?: string
  zipCode?: string
  neighborhood?: string
  isDefault?: boolean
}

export interface PresentableOrderInput {
  id: string
  userId?: string | null
  paymentStatus: OrderPaymentStatusKey | string
  logisticsStatus: OrderLogisticsStatusKey | string
  totalAmount: number
  shippingCost?: number | null
  isLocalDelivery?: boolean | null
  isAssistedSale?: boolean | null
  assistedSaleExpectedEmail?: string | null
  clientName?: string | null
  adminNotes?: string | null
  trackingCode?: string | null
  shippingLabelUrl?: string | null
  externalShipmentId?: string | null
  externalPaymentId?: string | null
  paymentMethod?: string | null
  hasOpenOccurrence?: boolean | null
  checkoutUrl?: string | null
  createdAt: string | Date
  paidAt?: string | Date | null
  cancelledAt?: string | Date | null
  shippedAt?: string | Date | null
  deliveredAt?: string | Date | null
  shippingAddressSnapshot?: Record<string, unknown> | null
  user?: {
    id?: string
    name?: string | null
    username?: string | null
    email?: string | null
    phone?: string | null
    addresses?: PresentableOrderAddress[]
  } | null
  items: PresentableOrderItem[]
  occurrences?: PresentableOrderOccurrence[]
}

export interface NormalizedOrderPresentation {
  id: string
  shortId: string
  createdAtIso: string
  dateFormatted: string
  timeFormatted: string
  clientName: string
  clientEmail: string
  linkedUserLabel: string | null
  location: {
    city: string
    state: string
    zipCode: string
    label: string
    isLocal: boolean
    street?: string
    number?: string
    complement?: string | null
    neighborhood?: string
    serviceName?: string
  }
  origin: OrderOriginChannel
  modality: OrderModality
  hasMadeToOrder: boolean
  totalUnits: number
  itemsTotal: number
  shippingCost: number
  grandTotal: number
  paymentStatus: OrderPaymentStatusKey
  logisticsStatus: OrderLogisticsStatusKey
  isCancelled: boolean
  isPaid: boolean
  isPending: boolean
  isExpired: boolean
  isAssistedSale: boolean
  hasOpenOccurrence: boolean
  isFinalized: boolean
  isHybrid: boolean
  logisticsBadge: { label: string; badgeClass: string }
  deliveredAtIso: string | null
  shippedAtIso: string | null
  trackingCode: string | null
  shippingLabelUrl: string | null
  externalShipmentId: string | null
  adminNotes: string | null
  checkoutUrl: string
  raw: PresentableOrderInput
}

const GENERIC_CLIENT_PLACEHOLDERS = new Set([
  'cliente',
  'cliente balcão',
  'cliente balcao',
  'cliente externo',
  'cliente não informado',
  'cliente nao informado',
  'comprador',
  'anônimo',
  'anonimo',
])

function isGenericClientName(name: string | null | undefined): boolean {
  if (!name) return true
  const normalized = name.trim().toLowerCase()
  return normalized.length === 0 || GENERIC_CLIENT_PLACEHOLDERS.has(normalized)
}

export function extractClientNameFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null
  const match = notes.match(/\[Cliente:\s*([^\]]+)\]/i)
  if (match?.[1] && !isGenericClientName(match[1])) {
    return match[1].trim()
  }
  return null
}

/**
 * Resolve de forma única o Nome e o E-mail do cliente em todas as telas do Admin:
 * 1. Nome salvo na Venda Assistida (shippingAddressSnapshot.recipientName / clientName / adminNotes [Cliente: ...])
 * 2. Nome real do usuário vinculado (order.user?.name / username), ignorando placeholders genéricos
 * 3. E-mail esperado da Venda Assistida (assistedSaleExpectedEmail / shippingAddressSnapshot.expectedEmail) antes de order.user?.email
 */
export function resolveOrderClientIdentity(order: PresentableOrderInput): {
  clientName: string
  clientEmail: string
  linkedUserLabel: string | null
} {
  const snap =
    order.shippingAddressSnapshot &&
    typeof order.shippingAddressSnapshot === 'object' &&
    !Array.isArray(order.shippingAddressSnapshot)
      ? order.shippingAddressSnapshot
      : null

  const snapRecipientName =
    typeof snap?.recipientName === 'string' && !isGenericClientName(snap.recipientName)
      ? snap.recipientName.trim()
      : typeof snap?.clientName === 'string' && !isGenericClientName(snap.clientName)
        ? snap.clientName.trim()
        : null

  const propClientName =
    typeof order.clientName === 'string' && !isGenericClientName(order.clientName)
      ? order.clientName.trim()
      : null

  const notesClientName = extractClientNameFromNotes(order.adminNotes)

  const userRealName =
    order.user?.name && !isGenericClientName(order.user.name)
      ? order.user.name.trim()
      : order.user?.username && !isGenericClientName(order.user.username)
        ? order.user.username.trim()
        : null

  const snapExpectedEmail =
    typeof snap?.expectedEmail === 'string' && snap.expectedEmail.trim()
      ? snap.expectedEmail.trim().toLowerCase()
      : null

  const assistedEmail =
    order.assistedSaleExpectedEmail && order.assistedSaleExpectedEmail.trim()
      ? order.assistedSaleExpectedEmail.trim().toLowerCase()
      : null

  const userEmail =
    order.user?.email && order.user.email.trim()
      ? order.user.email.trim().toLowerCase()
      : null

  const resolvedEmail = assistedEmail || snapExpectedEmail || userEmail || 'Sem e-mail'

  const emailPrefixFallback =
    resolvedEmail !== 'Sem e-mail' && resolvedEmail.includes('@')
      ? resolvedEmail.split('@')[0]
      : null

  const resolvedName =
    snapRecipientName ||
    propClientName ||
    notesClientName ||
    userRealName ||
    order.user?.name?.trim() ||
    order.user?.username?.trim() ||
    emailPrefixFallback ||
    'Cliente'

  const linkedUserLabel =
    order.user && (order.user.name || order.user.username)
      ? order.user.name || order.user.username || null
      : null

  return {
    clientName: resolvedName,
    clientEmail: resolvedEmail,
    linkedUserLabel,
  }
}

/**
 * Padroniza o Canal / Origem do pedido (`Marketplace`, `WhatsApp`, `Instagram`, `Balcão`)
 */
export function resolveOrderOrigin(order: PresentableOrderInput): OrderOriginChannel {
  const isAssisted = Boolean(
    order.isAssistedSale ||
      order.assistedSaleExpectedEmail ||
      (order.adminNotes && order.adminNotes.includes('[Origem:'))
  )

  if (!isAssisted) {
    return 'Marketplace'
  }

  const notes = order.adminNotes || ''
  if (notes.includes('[Origem: Instagram]')) return 'Instagram'
  if (notes.includes('[Origem: Outro]') || notes.toLowerCase().includes('balc')) return 'Balcão'
  return 'WhatsApp'
}

/**
 * Padroniza a localização geográfica e dados de entrega do pedido
 */
export function resolveOrderLocation(order: PresentableOrderInput): NormalizedOrderPresentation['location'] {
  const snap =
    order.shippingAddressSnapshot &&
    typeof order.shippingAddressSnapshot === 'object' &&
    !Array.isArray(order.shippingAddressSnapshot)
      ? order.shippingAddressSnapshot
      : null

  const fallbackAddr =
    order.user?.addresses?.find((a) => a.isDefault) || order.user?.addresses?.[0]

  const city = (
    (typeof snap?.city === 'string' ? snap.city : '') ||
    fallbackAddr?.city ||
    ''
  ).trim()
  const state = (
    (typeof snap?.state === 'string' ? snap.state : '') ||
    fallbackAddr?.state ||
    ''
  )
    .trim()
    .toUpperCase()
  const zipCode = (
    (typeof snap?.zipCode === 'string' ? snap.zipCode : '') ||
    fallbackAddr?.zipCode ||
    ''
  ).trim()

  const street = typeof snap?.street === 'string' ? snap.street : undefined
  const number = typeof snap?.number === 'string' ? snap.number : undefined
  const complement =
    typeof snap?.complement === 'string' ? snap.complement : null
  const neighborhood =
    typeof snap?.neighborhood === 'string' ? snap.neighborhood : undefined
  const serviceName =
    typeof snap?.serviceName === 'string' ? snap.serviceName : undefined

  const isLocal = Boolean(
    order.isLocalDelivery ||
      snap?.isLocalDelivery ||
      (serviceName && serviceName.toLowerCase().includes('local'))
  )

  if (city && state) {
    return {
      city,
      state,
      zipCode,
      label: `${city}/${state}`,
      isLocal,
      street,
      number,
      complement,
      neighborhood,
      serviceName,
    }
  }

  if (city) {
    return {
      city,
      state: 'SP',
      zipCode,
      label: city,
      isLocal,
      street,
      number,
      complement,
      neighborhood,
      serviceName,
    }
  }

  if (isLocal) {
    return {
      city: 'Itapetininga e Região',
      state: 'SP',
      zipCode,
      label: 'Itapetininga e Região/SP',
      isLocal: true,
      street,
      number,
      complement,
      neighborhood,
      serviceName,
    }
  }

  return {
    city: 'Não informado',
    state: '--',
    zipCode,
    label: 'A definir / Balcão',
    isLocal: false,
    street,
    number,
    complement,
    neighborhood,
    serviceName,
  }
}

/**
 * Padroniza os valores financeiros do pedido:
 * - grandTotal: valor final consolidado para exibição limpa na coluna TOTAL (sem string composta de peças + frete)
 * - itemsTotal / shippingCost / totalUnits: mantidos para auditoria contábil e gaveta de detalhes
 */
export function resolveOrderFinancials(order: PresentableOrderInput): {
  itemsTotal: number
  shippingCost: number
  grandTotal: number
  totalUnits: number
} {
  const shippingCost = Math.max(0, Number(order.shippingCost ?? 0))
  const rawTotalAmount = Math.max(0, Number(order.totalAmount ?? 0))

  const calculatedItemsSum = order.items.reduce(
    (sum, item) => sum + Number(item.priceUnit || 0) * Number(item.quantity || 0),
    0
  )
  const totalUnits = order.items.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  )

  const itemsTotal =
    calculatedItemsSum > 0
      ? Number(calculatedItemsSum.toFixed(2))
      : Number(Math.max(0, rawTotalAmount - shippingCost).toFixed(2))

  // Se rawTotalAmount já corresponde a itemsTotal + shippingCost (tolerância de 0.05), mantém;
  // caso contrário (ex: totalAmount estava sem somar frete ou vice-versa), garante consistência:
  const expectedGrandTotal = Number((itemsTotal + shippingCost).toFixed(2))
  const grandTotal =
    Math.abs(rawTotalAmount - expectedGrandTotal) <= 0.05
      ? Number(rawTotalAmount.toFixed(2))
      : Math.max(expectedGrandTotal, Number(rawTotalAmount.toFixed(2)))

  return {
    itemsTotal,
    shippingCost: Number(shippingCost.toFixed(2)),
    grandTotal,
    totalUnits,
  }
}

export function isOrderFinalized(order: {
  logisticsStatus?: string | null
  deliveredAt?: string | Date | null
  adminNotes?: string | null
}): boolean {
  if (order.logisticsStatus !== 'DELIVERED') return false
  if (
    order.adminNotes &&
    (order.adminNotes.includes('[FINALIZADO]') ||
      order.adminNotes.includes('[Finalizado pelo Cliente') ||
      order.adminNotes.includes('[FINALIZADO:'))
  ) {
    return true
  }
  if (!order.deliveredAt) return false
  const deliveredTime =
    order.deliveredAt instanceof Date
      ? order.deliveredAt.getTime()
      : new Date(order.deliveredAt).getTime()
  if (isNaN(deliveredTime)) return false
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000
  return Date.now() - deliveredTime >= THREE_DAYS_MS
}

export const MARKETPLACE_ORDER_EXPIRATION_HOURS = 10
export const ASSISTED_ORDER_EXPIRATION_HOURS = 24

export const MARKETPLACE_ORDER_EXPIRATION_MS =
  MARKETPLACE_ORDER_EXPIRATION_HOURS * 60 * 60 * 1000 // 10h = 36.000.000 ms
export const ASSISTED_ORDER_EXPIRATION_MS =
  ASSISTED_ORDER_EXPIRATION_HOURS * 60 * 60 * 1000 // 24h = 86.400.000 ms

/**
 * Lógica Central Unificada de Timeout / Expiração de Pedidos (Máquina de Estados de Expiração).
 * - Se o pedido NÃO estiver PENDING, retorna false.
 * - Se for Venda Assistida (isAssistedSale === true ou origem indicando assistida), expira em 24h.
 * - Se for Marketplace regular, expira em 10h.
 * - Retorna true se o tempo decorrido desde createdAt excedeu o limite.
 */
export function isOrderExpired(order: any): boolean {
  if (!order) return false
  const raw = order.raw || order

  const paymentStatus = raw.paymentStatus || order.paymentStatus
  if (paymentStatus !== 'PENDING') {
    return false
  }

  const isAssisted = Boolean(
    raw.isAssistedSale ||
      order.isAssistedSale ||
      raw.assistedSaleExpectedEmail ||
      (order.origin && order.origin !== 'Marketplace') ||
      (typeof raw.adminNotes === 'string' && raw.adminNotes.includes('[Origem:'))
  )

  const limitMs = isAssisted ? ASSISTED_ORDER_EXPIRATION_MS : MARKETPLACE_ORDER_EXPIRATION_MS

  const createdDate = raw.createdAt || order.createdAt
  if (!createdDate) return false

  const createdTime =
    createdDate instanceof Date ? createdDate.getTime() : new Date(createdDate).getTime()
  if (isNaN(createdTime)) return false

  return Date.now() - createdTime >= limitMs
}

/**
 * Formatação padronizada do badge de pagamento:
 * Se o pedido estiver expirado (isOrderExpired), força o badge vermelho:
 * { label: 'Prazo Expirado', style: 'bg-rose-500/10 text-rose-400 border-rose-500/20' }
 */
export function resolveOrderPaymentPresentation(order: any): {
  label: string
  dotClass: string
  badgeClass: string
  style: string
  isExpired: boolean
} {
  const raw = order?.raw || order
  const isCancelled =
    raw?.logisticsStatus === 'CANCELLED' || Boolean(raw?.cancelledAt)

  if (isOrderExpired(order)) {
    return {
      label: 'Prazo Expirado',
      dotClass: 'bg-gray-400',
      badgeClass: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      style: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      isExpired: true,
    }
  }

  if (isCancelled) {
    return {
      label: 'Cancelado',
      dotClass: 'bg-rose-400',
      badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      style: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      isExpired: false,
    }
  }

  const statusKey = (raw?.paymentStatus || 'PENDING') as OrderPaymentStatusKey
  const base = UNIFIED_PAYMENT_BADGES[statusKey] || UNIFIED_PAYMENT_BADGES.PENDING

  return {
    ...base,
    style: base.badgeClass,
    isExpired: false,
  }
}

/**
 * Resolve a apresentação contextual do status logístico (Máquina de Estados Estrita):
 * - Aguardando Pagto: se ainda não pago e não cancelado
 * - Cancelado: se cancelado
 * - Aguardando Produção: se pago e o pedido for Híbrido (itens pronta entrega + encomenda)
 * - Na Fila / Em Produção: se pago e 100% Sob Encomenda
 * - Pronto p/ Envio: se READY_FOR_SHIPPING
 * - Enviado (Aguard. Cliente): se SHIPPED e entrega local/regional
 * - A Caminho: se SHIPPED e transportadora (Melhor Envio)
 * - Finalizado: se DELIVERED e entregue há >= 3 dias ou concluído manualmente
 * - Entregue: se DELIVERED há menos de 3 dias
 */
export function resolveOrderLogisticsPresentation(
  order: PresentableOrderInput | NormalizedOrderPresentation
): {
  label: string
  badgeClass: string
  isFinalized: boolean
  isProductionQueue: boolean
  queueLink?: string
} {
  const isCancelled =
    order.logisticsStatus === 'CANCELLED' || Boolean((order as PresentableOrderInput).cancelledAt)
  const isPaid = order.paymentStatus === 'PAID'
  const isFinalized = isOrderFinalized(
    'raw' in order && order.raw ? order.raw : (order as PresentableOrderInput)
  )

  // 1. Se expirado por timeout comercial (10h Marketplace / 24h Assistida)
  if (isOrderExpired(order)) {
    return {
      label: 'Cancelado',
      badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      isFinalized: false,
      isProductionQueue: false,
    }
  }

  // 2. Se cancelado
  if (isCancelled) {
    return {
      label: 'Cancelado',
      badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      isFinalized: false,
      isProductionQueue: false,
    }
  }

  // 2. Se ainda não está pago
  if (!isPaid) {
    return {
      label: 'Aguardando Pagto',
      badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-700/60',
      isFinalized: false,
      isProductionQueue: false,
    }
  }

  // Analisa itens para verificar se o pedido é Híbrido ou 100% Sob Encomenda
  const rawOrder = 'raw' in order && order.raw ? order.raw : (order as PresentableOrderInput)
  const items: PresentableOrderItem[] = rawOrder.items || []
  const hasMadeToOrder = items.some((i) =>
    Boolean(i.isMadeToOrder || i.product?.isMadeToOrder)
  )
  const hasReadyToShip = items.some(
    (i) => !Boolean(i.isMadeToOrder || i.product?.isMadeToOrder)
  )
  const isHybrid = hasMadeToOrder && hasReadyToShip

  const logisticsStatus = order.logisticsStatus as OrderLogisticsStatusKey

  // 3. Se pago e em fase de produção (PREPARING, PRODUCING, PRINTING, POST_PROCESSING)
  if (
    logisticsStatus === 'PREPARING' ||
    logisticsStatus === 'PRODUCING' ||
    logisticsStatus === 'PRINTING' ||
    logisticsStatus === 'POST_PROCESSING'
  ) {
    if (isHybrid) {
      return {
        label: 'Aguardando Produção',
        badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
        isFinalized: false,
        isProductionQueue: true,
        queueLink: '/admin/production',
      }
    }

    if (logisticsStatus === 'PREPARING') {
      return {
        label: 'Na Fila',
        badgeClass: 'bg-slate-500/10 text-slate-300 border-slate-700/60',
        isFinalized: false,
        isProductionQueue: true,
        queueLink: '/admin/production',
      }
    }

    if (logisticsStatus === 'PRINTING') {
      return {
        label: 'Em Impressão',
        badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
        isFinalized: false,
        isProductionQueue: true,
        queueLink: '/admin/production',
      }
    }

    if (logisticsStatus === 'POST_PROCESSING') {
      return {
        label: 'Em Acabamento',
        badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
        isFinalized: false,
        isProductionQueue: true,
        queueLink: '/admin/production',
      }
    }

    return {
      label: 'Em Produção',
      badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
      isFinalized: false,
      isProductionQueue: true,
      queueLink: '/admin/production',
    }
  }

  // 4. Se READY_FOR_SHIPPING
  if (logisticsStatus === 'READY_FOR_SHIPPING') {
    return {
      label: 'Pronto p/ Envio',
      badgeClass: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
      isFinalized: false,
      isProductionQueue: false,
    }
  }

  // 5. Se SHIPPED
  if (logisticsStatus === 'SHIPPED') {
    const isLocal =
      'location' in order && order.location
        ? Boolean(order.location.isLocal)
        : Boolean(
            rawOrder.isLocalDelivery ||
              (rawOrder.shippingAddressSnapshot as Record<string, unknown> | null)?.isLocalDelivery
          )

    if (isLocal) {
      return {
        label: 'Enviado (Aguard. Cliente)',
        badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
        isFinalized: false,
        isProductionQueue: false,
      }
    }

    return {
      label: 'A Caminho',
      badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
      isFinalized: false,
      isProductionQueue: false,
    }
  }

  // 6. Se DELIVERED
  if (logisticsStatus === 'DELIVERED') {
    if (isFinalized) {
      return {
        label: 'Finalizado',
        badgeClass: 'bg-emerald-500 text-slate-950 font-black border-emerald-400 shadow-sm',
        isFinalized: true,
        isProductionQueue: false,
      }
    }

    return {
      label: 'Entregue',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      isFinalized: false,
      isProductionQueue: false,
    }
  }

  return {
    label: UNIFIED_LOGISTICS_BADGES[logisticsStatus]?.label || 'Na Fila',
    badgeClass: UNIFIED_LOGISTICS_BADGES[logisticsStatus]?.badgeClass || 'bg-slate-500/10 text-slate-300 border-slate-700/60',
    isFinalized: false,
    isProductionQueue: false,
  }
}

/**
 * Resolve a Modalidade do pedido com base nos itens (Pronta Entrega, Sob Encomenda ou Híbrido),
 * independentemente do status de pagamento (seja PENDING ou PAID).
 */
export function resolveOrderModality(order: {
  items?: Array<{
    isMadeToOrder?: boolean | null
    product?: { isMadeToOrder?: boolean | null } | null
  }>
}): OrderModality {
  const items = order.items || []
  if (items.length === 0) {
    return 'Pronta Entrega'
  }
  const hasMadeToOrder = items.some((i) =>
    Boolean(i.isMadeToOrder || i.product?.isMadeToOrder)
  )
  const hasReadyToShip = items.some(
    (i) => !Boolean(i.isMadeToOrder || i.product?.isMadeToOrder)
  )

  if (hasMadeToOrder && hasReadyToShip) {
    return 'Híbrido'
  }
  if (hasMadeToOrder) {
    return 'Sob Encomenda'
  }
  return 'Pronta Entrega'
}

/**
 * Normaliza qualquer pedido do sistema em um objeto padronizado para renderização e busca
 */
export function normalizeAdminOrder(order: PresentableOrderInput): NormalizedOrderPresentation {
  const createdDate =
    order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt)
  const createdAtIso = isNaN(createdDate.getTime())
    ? new Date().toISOString()
    : createdDate.toISOString()

  const dateFormatted = createdDate.toLocaleDateString('pt-BR')
  const timeFormatted = createdDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const { clientName, clientEmail, linkedUserLabel } = resolveOrderClientIdentity(order)
  const origin = resolveOrderOrigin(order)
  const location = resolveOrderLocation(order)
  const { itemsTotal, shippingCost, grandTotal, totalUnits } = resolveOrderFinancials(order)

  const hasMadeToOrder = order.items.some((i) =>
    Boolean(i.isMadeToOrder || i.product?.isMadeToOrder)
  )
  const hasReadyToShip = order.items.some(
    (i) => !Boolean(i.isMadeToOrder || i.product?.isMadeToOrder)
  )
  const isHybrid = hasMadeToOrder && hasReadyToShip
  const modality: OrderModality = resolveOrderModality(order)

  const paymentStatus = (order.paymentStatus || 'PENDING') as OrderPaymentStatusKey
  const logisticsStatus = (order.logisticsStatus || 'PREPARING') as OrderLogisticsStatusKey
  const isExpired = isOrderExpired(order)
  const isCancelled = logisticsStatus === 'CANCELLED' || Boolean(order.cancelledAt) || isExpired
  const isPaid = paymentStatus === 'PAID'
  const isPending = paymentStatus === 'PENDING' && !isCancelled && !isExpired
  const isFinalized = isOrderFinalized(order)

  const deliveredDate = order.deliveredAt
    ? order.deliveredAt instanceof Date
      ? order.deliveredAt
      : new Date(order.deliveredAt)
    : null
  const deliveredAtIso = deliveredDate && !isNaN(deliveredDate.getTime()) ? deliveredDate.toISOString() : null

  const shippedDate = order.shippedAt
    ? order.shippedAt instanceof Date
      ? order.shippedAt
      : new Date(order.shippedAt)
    : null
  const shippedAtIso = shippedDate && !isNaN(shippedDate.getTime()) ? shippedDate.toISOString() : null

  const isAssistedSale = Boolean(order.isAssistedSale || origin !== 'Marketplace')
  const checkoutUrl =
    order.checkoutUrl || `/checkout/assisted/${order.id}`

  const logisticsPresentation = resolveOrderLogisticsPresentation(order)

  return {
    id: order.id,
    shortId: order.id.slice(-6).toUpperCase(),
    createdAtIso,
    dateFormatted,
    timeFormatted,
    clientName,
    clientEmail,
    linkedUserLabel,
    location,
    origin,
    modality,
    hasMadeToOrder,
    totalUnits,
    itemsTotal,
    shippingCost,
    grandTotal,
    paymentStatus,
    logisticsStatus,
    isCancelled,
    isPaid,
    isPending,
    isExpired,
    isAssistedSale,
    hasOpenOccurrence: Boolean(order.hasOpenOccurrence),
    isFinalized,
    isHybrid,
    logisticsBadge: {
      label: logisticsPresentation.label,
      badgeClass: logisticsPresentation.badgeClass,
    },
    deliveredAtIso,
    shippedAtIso,
    trackingCode: order.trackingCode ?? null,
    shippingLabelUrl: order.shippingLabelUrl ?? null,
    externalShipmentId: order.externalShipmentId ?? null,
    adminNotes: order.adminNotes ?? null,
    checkoutUrl,
    raw: order,
  }
}

export const UNIFIED_PAYMENT_BADGES: Record<
  OrderPaymentStatusKey,
  { label: string; dotClass: string; badgeClass: string }
> = {
  PENDING: {
    label: 'Aguardando',
    dotClass: 'bg-amber-400',
    badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  },
  PAID: {
    label: 'Pago',
    dotClass: 'bg-emerald-400',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  FAILED: {
    label: 'Recusado',
    dotClass: 'bg-rose-400',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  },
  REFUNDED: {
    label: 'Reembolsado',
    dotClass: 'bg-slate-400',
    badgeClass: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  },
}

export const UNIFIED_LOGISTICS_BADGES: Record<
  OrderLogisticsStatusKey,
  { label: string; badgeClass: string }
> = {
  PREPARING: {
    label: 'Na Fila',
    badgeClass: 'bg-slate-500/10 text-slate-300 border-slate-700/60',
  },
  PRODUCING: {
    label: 'Em Produção',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  },
  PRINTING: {
    label: 'Em Impressão',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  },
  POST_PROCESSING: {
    label: 'Acabamento',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  },
  READY_FOR_SHIPPING: {
    label: 'Pronto p/ Envio',
    badgeClass: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  },
  SHIPPED: {
    label: 'Enviado',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  },
  DELIVERED: {
    label: 'Entregue',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  CANCELLED: {
    label: 'Cancelado',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  },
}

export const UNIFIED_ORIGIN_BADGES: Record<
  OrderOriginChannel,
  { label: string; badgeClass: string }
> = {
  Marketplace: {
    label: 'Marketplace',
    badgeClass: 'bg-cyan-950/60 text-cyan-300 border-cyan-800/50',
  },
  WhatsApp: {
    label: 'WhatsApp',
    badgeClass: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50',
  },
  Instagram: {
    label: 'Instagram',
    badgeClass: 'bg-fuchsia-950/60 text-fuchsia-300 border-fuchsia-800/50',
  },
  Balcão: {
    label: 'Balcão',
    badgeClass: 'bg-slate-900 text-slate-300 border-slate-700/60',
  },
}

export const UNIFIED_MODALITY_BADGES: Record<
  OrderModality,
  { label: string; badgeClass: string }
> = {
  'Pronta Entrega': {
    label: 'Pronta Entrega',
    badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  },
  'Sob Encomenda': {
    label: 'Sob Encomenda',
    badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  },
  'Híbrido': {
    label: 'Híbrido',
    badgeClass: 'bg-white/10 text-white border-white/20',
  },
}
