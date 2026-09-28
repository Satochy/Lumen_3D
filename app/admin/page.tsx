import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function AdminDashboardPage() {
  const [totalFilaments, totalOrders, pendingOrders] = await Promise.all([
    prisma.filamentStock.count(),
    prisma.order.count(),
    prisma.order.count({ where: { status: 'PENDING' } }),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Visão Geral</h1>
        <p className="text-slate-400 text-sm">Resumo operacional do Lúmen 3D.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-2">
          <p className="text-xs font-medium text-slate-400">Filamentos Cadastrados</p>
          <p className="text-3xl font-bold text-amber-500">{totalFilaments}</p>
          <Link href="/admin/filaments" className="text-xs text-slate-400 hover:text-slate-200 underline">
            Ver estoque &rarr;
          </Link>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-2">
          <p className="text-xs font-medium text-slate-400">Total de Pedidos</p>
          <p className="text-3xl font-bold text-slate-100">{totalOrders}</p>
          <Link href="/admin/orders" className="text-xs text-slate-400 hover:text-slate-200 underline">
            Ver fila de produção &rarr;
          </Link>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-2">
          <p className="text-xs font-medium text-slate-400">Aguardando Impressão</p>
          <p className="text-3xl font-bold text-blue-400">{pendingOrders}</p>
          <Link href="/admin/orders" className="text-xs text-slate-400 hover:text-slate-200 underline">
            Gerenciar fila &rarr;
          </Link>
        </div>
      </div>
    </div>
  )
}