import Link from 'next/link'
import React from 'react'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 p-6 flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-bold text-amber-500 tracking-wider">LÚMEN 3D</h2>
          <p className="text-xs text-slate-400">Painel de Controlo</p>
        </div>

        <nav className="flex flex-col gap-2">
          <Link
            href="/admin"
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-sm font-medium transition"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/filaments"
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-sm font-medium transition"
          >
            Estoque de Filamentos
          </Link>
          <Link
            href="/admin/orders"
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-sm font-medium transition"
          >
            Fila de Produção
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}