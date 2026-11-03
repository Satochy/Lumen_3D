import React from 'react'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Admin_Sidebar from '@/components/admin/Admin_Sidebar'
import Admin_Header from '@/components/admin/Admin_Header'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const adminUser = await requireAdmin()

  // Buscar contagens em tempo real para os badges da Sidebar
  const [productionCount, readyShippingCount, occurrencesCount] = await Promise.all([
    prisma.order.count({
      where: {
        paymentStatus: 'PAID',
        logisticsStatus: { in: ['PREPARING', 'PRODUCING', 'PRINTING', 'POST_PROCESSING'] },
      },
    }),
    prisma.order.count({
      where: {
        logisticsStatus: 'READY_FOR_SHIPPING',
      },
    }),
    prisma.order.count({
      where: {
        hasOpenOccurrence: true,
      },
    }),
  ])

  return (
    <div className="flex min-h-screen bg-[#040711] text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200 antialiased">
      {/* Background Decorativo com Iluminação Sutil (Glow Radial Dark) */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[350px] bg-gradient-to-br from-cyan-500/5 via-blue-600/3 to-transparent blur-3xl rounded-full" />
        <div className="absolute top-1/3 right-10 w-[500px] h-[300px] bg-gradient-to-br from-indigo-500/4 via-purple-600/2 to-transparent blur-3xl rounded-full" />
      </div>

      {/* Sidebar de Gestão com Backdrop Blur */}
      <div className="relative z-20">
        <Admin_Sidebar
          adminUser={{
            id: adminUser.id,
            name: adminUser.name,
            username: adminUser.username,
            email: adminUser.email,
            avatarUrl: adminUser.avatarUrl ?? null,
          }}
          counts={{
            production: productionCount,
            readyShipping: readyShippingCount,
            occurrences: occurrencesCount,
          }}
        />
      </div>

      {/* Área Central / Conteúdo com Header Integrado */}
      <main className="flex-1 p-6 sm:p-8 lg:p-10 overflow-y-auto relative z-10 transition-all duration-300 ease-in-out">
        <div className="max-w-7xl mx-auto">
          <Admin_Header />
          {children}
        </div>
      </main>
    </div>
  )
}
