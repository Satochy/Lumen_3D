import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export default async function AdminDashboardPage() {
  await requireAdmin()

  // Busca algumas estatísticas reais para a dashboard
  const productCount = await prisma.product.count()
  const orderCount = await prisma.order.count()
  const filamentCount = await prisma.filamentStock.count()

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-xs text-slate-400">Visão geral do sistema Lúmen 3D</p>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl">
          <p className="text-xs text-slate-400">Produtos Cadastrados</p>
          <p className="text-3xl font-bold text-cyan-400 mt-2">{productCount}</p>
          <Link href="/admin/products" className="text-xs text-cyan-500 hover:underline mt-4 inline-block">
            Gerenciar produtos &rarr;
          </Link>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl">
          <p className="text-xs text-slate-400">Pedidos Totais</p>
          <p className="text-3xl font-bold text-emerald-400 mt-2">{orderCount}</p>
          <Link href="/admin/orders" className="text-xs text-emerald-500 hover:underline mt-4 inline-block">
            Ver pedidos &rarr;
          </Link>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl">
          <p className="text-xs text-slate-400">Filamentos em Estoque</p>
          <p className="text-3xl font-bold text-amber-400 mt-2">{filamentCount}</p>
          <Link href="/admin/filaments" className="text-xs text-amber-500 hover:underline mt-4 inline-block">
            Controlar estoque &rarr;
          </Link>
        </div>
      </div>
    </div>
  )
}