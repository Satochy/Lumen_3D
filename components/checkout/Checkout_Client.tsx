'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  ShieldCheck,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  ArrowLeft,
} from 'lucide-react'
import { formatCurrency } from '@/lib/format_currency'
import { formatCEP, sanitizeCEP } from '@/lib/shipping/shipping_utils'
import MercadoPagoBrick from '@/components/checkout/MercadoPagoBrick'

export interface SerializedCheckoutItem {
  id: string
  productId: string
  productTitle: string
  quantity: number
  priceUnit: number
  image: string | null
  slug: string | null
}

export interface ShippingSnapshotData {
  street?: string
  number?: string
  complement?: string | null
  neighborhood?: string
  city?: string
  state?: string
  zipCode?: string
  serviceId?: string
  serviceName?: string
  isLocalDelivery?: boolean
  shippingCost?: number
  subtotal?: number
}

export interface SerializedCheckoutOrder {
  id: string
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
  logisticsStatus: string
  totalAmount: number
  shippingCost: number
  isLocalDelivery: boolean
  createdAt: string
  shippingAddressSnapshot: ShippingSnapshotData | null
  items: SerializedCheckoutItem[]
}

interface CheckoutClientProps {
  order: SerializedCheckoutOrder
  preferenceId: string | null
  payerEmail: string
  payerName: string | null
}

export default function Checkout_Client({
  order,
  preferenceId,
  payerEmail,
  payerName,
}: CheckoutClientProps) {
  const itemsSubtotal = order.items.reduce(
    (acc, item) => acc + item.priceUnit * item.quantity,
    0
  )

  const snapshot = order.shippingAddressSnapshot
  const formattedCep = snapshot?.zipCode
    ? formatCEP(sanitizeCEP(snapshot.zipCode)) || snapshot.zipCode
    : null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Coluna Esquerda: Pagamento (MercadoPagoBrick) */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-[#0a0e1a] border border-slate-800/80 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                Pagamento do Pedido
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Comprador:{' '}
                <span className="text-slate-300 font-medium">
                  {payerName || payerEmail}
                </span>{' '}
                ({payerEmail})
              </p>
            </div>
            <span className="font-mono text-xs text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
              #{order.id.slice(0, 8)}
            </span>
          </div>

          {order.paymentStatus === 'PAID' ? (
            <div className="p-8 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">Pagamento Confirmado!</h3>
                <p className="text-xs text-slate-300">
                  Recebemos a confirmação do seu pagamento. Seu pedido já está sendo preparado pela equipe Lúmen 3D.
                </p>
              </div>
              <Link
                href="/profile/orders"
                className="inline-block px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition"
              >
                Acompanhar em Meus Pedidos
              </Link>
            </div>
          ) : (
            <div className="min-h-[380px]">
              <MercadoPagoBrick
                preferenceId={preferenceId}
                orderId={order.id}
                amount={order.totalAmount}
                payerEmail={payerEmail}
                payerName={payerName}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <Link
            href="/profile/orders"
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-cyan-400 transition font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Ver todos os meus pedidos
          </Link>
          <span>Ambiente 100% seguro • Lúmen 3D</span>
        </div>
      </div>

      {/* Coluna Direita: Resumo do Pedido (Produtos, Endereço/Frete do Snapshot, Subtotal e Total) */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-[#0a0e1a] border border-slate-800/80 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-cyan-400" />
              Resumo do Pedido
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                order.paymentStatus === 'PAID'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              {order.paymentStatus === 'PAID'
                ? 'Pago'
                : order.paymentStatus === 'PENDING'
                  ? 'Aguardando Pagamento'
                  : order.paymentStatus}
            </span>
          </div>

          <ul className="divide-y divide-slate-800/60 max-h-72 overflow-y-auto pr-1">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="py-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.productTitle}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{item.productTitle}</p>
                    <p className="text-slate-400 mt-0.5">
                      Qtd: {item.quantity} × {formatCurrency(item.priceUnit)}
                    </p>
                  </div>
                </div>
                <span className="font-bold text-slate-200 shrink-0">
                  {formatCurrency(item.priceUnit * item.quantity)}
                </span>
              </li>
            ))}
          </ul>

          {/* Dados de Entrega (Snapshot) */}
          <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-cyan-400" />
                {snapshot?.serviceName || 'Entrega Selecionada'}
              </span>
              {order.isLocalDelivery && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase">
                  Entrega Local Grátis
                </span>
              )}
            </div>

            {snapshot?.street ? (
              <p className="text-slate-400 leading-relaxed">
                {snapshot.street}, {snapshot.number}
                {snapshot.complement ? ` (${snapshot.complement})` : ''} —{' '}
                {snapshot.neighborhood}, {snapshot.city}/{snapshot.state}
                {formattedCep ? ` • CEP ${formattedCep}` : ''}
              </p>
            ) : (
              formattedCep && (
                <p className="text-slate-400">CEP de destino: {formattedCep}</p>
              )
            )}
          </div>

          {/* Totais */}
          <div className="space-y-2.5 pt-2 border-t border-slate-800 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Subtotal dos itens</span>
              <span className="font-semibold text-white">
                {formatCurrency(itemsSubtotal)}
              </span>
            </div>

            <div className="flex justify-between text-slate-300">
              <span>Frete</span>
              <span className="font-semibold text-cyan-400">
                {order.shippingCost === 0
                  ? 'Grátis'
                  : formatCurrency(order.shippingCost)}
              </span>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
              <span className="text-sm font-bold text-white">Total a Pagar</span>
              <span className="text-xl font-black text-cyan-400">
                {formatCurrency(order.totalAmount)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
