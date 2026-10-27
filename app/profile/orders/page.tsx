import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { PaymentStatus, LogisticsStatus } from '@prisma/client'
import { Header, Footer } from '@/components/layout'
import Profile_Navbar from '@/components/profile/Profile_Navbar'
import Cart_Button from '@/components/cart/Cart_Button'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/format_currency'

const paymentLabels: Record<PaymentStatus, { label: string; style: string }> = {
  PENDING: { label: 'Aguardando Pagamento', style: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  PAID: { label: 'Pago', style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  FAILED: { label: 'Recusado / Falhou', style: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  REFUNDED: { label: 'Reembolsado', style: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
}

const logisticsLabels: Record<LogisticsStatus, { label: string; style: string }> = {
  PREPARING: { label: 'Preparando / Na Fila', style: 'bg-slate-500/10 text-slate-300 border-slate-500/20' },
  PRINTING: { label: 'Em Produção (Impressão 3D)', style: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  POST_PROCESSING: { label: 'Em Acabamento', style: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  SHIPPED: { label: 'Enviado', style: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  DELIVERED: { label: 'Entregue', style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  CANCELLED: { label: 'Cancelado', style: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
}

export default async function UserOrdersPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    include: {
      items: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans">
      <Header user={user} logoHref="/" actions={<Cart_Button />}>
        <Profile_Navbar />
      </Header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Meus Pedidos</h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Acompanhe o status de pagamento, produção e entrega das suas encomendas.
            </p>
          </div>
          <Link
            href="/marketplace"
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition w-fit"
          >
            Explorar Catálogo
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
            <p className="text-sm text-slate-400">Você ainda não realizou nenhum pedido.</p>
            <Link
              href="/marketplace"
              className="inline-block px-5 py-2.5 bg-cyan-950/60 border border-cyan-800/60 hover:border-cyan-400 text-cyan-300 text-xs font-bold rounded-xl transition"
            >
              Ver Produtos no Marketplace
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const payBadge = paymentLabels[order.paymentStatus]
              const logBadge = logisticsLabels[order.logisticsStatus]
              const totalWithShipping =
                Number(order.totalAmount) + Number(order.shippingCost)

              return (
                <div
                  key={order.id}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <p className="text-xs text-slate-400">
                        Pedido <span className="font-mono text-slate-200">#{order.id.slice(0, 8)}</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Realizado em {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-1 text-[11px] font-bold border rounded-md ${payBadge.style}`}
                      >
                        {payBadge.label}
                      </span>
                      <span
                        className={`px-2.5 py-1 text-[11px] font-bold border rounded-md ${logBadge.style}`}
                      >
                        {logBadge.label}
                      </span>
                    </div>
                  </div>

                  <ul className="divide-y divide-slate-800/60 text-xs">
                    {order.items.map((item) => (
                      <li key={item.id} className="py-2.5 flex justify-between items-center">
                        <div>
                          <span className="font-semibold text-slate-200">{item.productTitle}</span>
                          <span className="text-slate-400 ml-2">x{item.quantity}</span>
                        </div>
                        <span className="text-slate-300 font-medium">
                          {formatCurrency(Number(item.priceUnit) * item.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
                    <div className="text-slate-400">
                      {order.trackingCode ? (
                        <span>
                          Código de Rastreio:{' '}
                          <strong className="font-mono text-cyan-400">{order.trackingCode}</strong>
                        </span>
                      ) : (
                        <span>Rastreio será disponibilizado após o envio.</span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-slate-400 mr-2">
                        Frete: {formatCurrency(Number(order.shippingCost))}
                      </span>
                      <span className="text-sm font-black text-cyan-400">
                        Total: {formatCurrency(totalWithShipping)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}