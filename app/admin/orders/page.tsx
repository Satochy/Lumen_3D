import { getOrders, updateOrderStatus } from '@/app/actions/orders'

const statusBadges: Record<string, { label: string; style: string }> = {
  PENDING: { label: 'Aguardando', style: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  PRINTING: { label: 'Em Impressão', style: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  FINISHING: { label: 'Acabamento', style: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  COMPLETED: { label: 'Concluído', style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  CANCELLED: { label: 'Cancelado', style: 'bg-red-500/10 text-red-400 border-red-500/20' },
}

export default async function OrdersPage() {
  const result = await getOrders()
  const orders = result.success ? result.data : []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Fila de Produção & Pedidos</h1>
        <p className="text-slate-400 text-sm">
          Acompanhe os pedidos em produção e altere o estado das impressões.
        </p>
      </div>

      <div className="space-y-4">
        {orders?.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
            Nenhum pedido encontrado na fila.
          </div>
        ) : (
          orders?.map((order) => {
            const badge = statusBadges[order.status] || {
              label: order.status,
              style: 'bg-slate-800 text-slate-300 border-slate-700',
            }

            return (
              <div
                key={order.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <p className="text-xs text-slate-400">
                      ID do Pedido: <span className="font-mono text-slate-200">{order.id}</span>
                    </p>
                    <p className="text-sm font-semibold text-slate-100">
                      Pedido #{order.id.slice(-6)}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span
                      className={`px-3 py-1 text-xs font-semibold border rounded-md ${badge.style}`}
                    >
                      {badge.label}
                    </span>

                    {/* Formulário de alteração rápida de estado */}
                    <form action={updateOrderStatus} className="flex items-center gap-2">
                      <input type="hidden" name="orderId" value={order.id} />
                      <select
                        name="status"
                        defaultValue={order.status}
                        className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500"
                      >
                        <option value="PENDING">Aguardando</option>
                        <option value="PRINTING">Em Impressão</option>
                        <option value="FINISHING">Acabamento</option>
                        <option value="COMPLETED">Concluído</option>
                        <option value="CANCELLED">Cancelado</option>
                      </select>
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-lg transition"
                      >
                        Atualizar
                      </button>
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
                          <span className="font-medium text-slate-200">{item.product.title}</span>
                          <span className="text-xs text-slate-400 ml-2">x{item.quantity}</span>
                        </div>
                        <span className="text-xs text-slate-400">
                          Preço Unit.: R$ {item.product.price.toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}