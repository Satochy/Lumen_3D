import type { PaymentStatus, LogisticsStatus } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { getOrders, updateLogisticsStatus } from '@/app/actions/orders'
import { formatCurrency } from '@/lib/format_currency'

const paymentBadges: Record<PaymentStatus, { label: string; style: string }> = {
  PENDING: { label: 'Aguardando Pagamento', style: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  PAID: { label: 'Pago', style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  FAILED: { label: 'Falhou / Recusado', style: 'bg-red-500/10 text-red-400 border-red-500/20' },
  REFUNDED: { label: 'Reembolsado', style: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
}

const logisticsBadges: Record<LogisticsStatus, { label: string; style: string }> = {
  PREPARING: { label: 'Na Fila', style: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  PRINTING: { label: 'Em Impressão', style: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  POST_PROCESSING: { label: 'Acabamento', style: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  READY_FOR_SHIPPING: { label: 'Pronto p/ Envio', style: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
  SHIPPED: { label: 'Enviado', style: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  DELIVERED: { label: 'Entregue', style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  CANCELLED: { label: 'Cancelado', style: 'bg-red-500/10 text-red-400 border-red-500/20' },
}

const logisticsOptions = Object.keys(logisticsBadges) as LogisticsStatus[]

export default async function OrdersPage() {
  await requireAdmin()

  const result = await getOrders()
  const orders = result.success ? result.data : []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Fila de Produção & Pedidos</h1>
        <p className="text-slate-400 text-sm">
          Acompanhe os pedidos, visualize os pagamentos confirmados e gerencie o estado das impressões.
        </p>
      </div>

      <div className="space-y-4">
        {orders?.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
            Nenhum pedido encontrado na fila.
          </div>
        ) : (
          orders?.map((order) => {
            const payBadge = paymentBadges[order.paymentStatus] || { label: order.paymentStatus, style: 'bg-slate-800 text-slate-300' }
            const logBadge = logisticsBadges[order.logisticsStatus] || { label: order.logisticsStatus, style: 'bg-slate-800 text-slate-300' }

            return (
              <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <p className="text-xs text-slate-400">
                      ID: <span className="font-mono text-slate-200">{order.id}</span>
                    </p>
                    <p className="text-sm font-semibold text-slate-100">
                      Pedido #{order.id.slice(-6)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    {/* Status de Pagamento (Somente leitura — gerido exclusivamente via Mercado Pago) */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Pagamento:</span>
                      <span className={`px-2.5 py-1 text-[10px] uppercase font-bold border rounded-md text-center ${payBadge.style}`}>
                        {payBadge.label}
                      </span>
                    </div>

                    {/* Status de Logística */}
                    <form action={updateLogisticsStatus} className="flex items-center gap-2">
                      <input type="hidden" name="orderId" value={order.id} />
                      <span className={`px-2 py-1 text-[10px] uppercase font-bold border rounded-md w-32 text-center ${logBadge.style}`}>
                        {logBadge.label}
                      </span>
                      <select name="logisticsStatus" defaultValue={order.logisticsStatus} className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-cyan-500">
                        {logisticsOptions.map((status) => (
                          <option key={status} value={status}>{logisticsBadges[status].label}</option>
                        ))}
                      </select>
                      <button type="submit" className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-lg transition">Mudar</button>
                    </form>
                  </div>
                </div>

                {/* Itens do Pedido */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-400">Itens para Produção:</p>
                  <ul className="divide-y divide-slate-800/50">
                    {order.items.map((item) => (
                      <li key={item.id} className="py-2 flex justify-between items-center text-sm">
                        <div>
                          <span className="font-medium text-slate-200">{item.productTitle || item.product?.title || 'Item Personalizado'}</span>
                          <span className="text-xs text-slate-400 ml-2">x{item.quantity}</span>
                          {item.isMadeToOrder && (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Sob Encomenda{item.productionDays ? ` (${item.productionDays}d)` : ''}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">
                          Preço Unit.: {formatCurrency(item.priceUnit.toNumber())}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Frete: <strong className="text-slate-200">{formatCurrency(order.shippingCost.toNumber())}</strong>
                  </span>
                  <span className="text-sm font-bold text-cyan-400">
                    Total: {formatCurrency(order.totalAmount.toNumber())}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
