import { Header, Footer } from '@/components/layout'
import { 
  Hero_Section, 
  Catalog_Section, 
  Delivery_Section, 
  Feedbacks_Section, 
  About_Section, 
  Especial_Order_Section 
} from '@/components/sections'

import { prisma } from '@/lib/prisma'
import { Product } from '@prisma/client'

export const revalidate = 0

// ============================================================================
// VERIFICADOR DE SESSÃO / AUTENTICAÇÃO (MOCK PARA TESTES DE INTERFACE)
// ============================================================================
async function getCurrentUser() {
  return {
    id: '1',
    name: 'Satochy',
    email: 'satochy@lumen3d.com',
    role: 'ADMIN',
    avatarUrl: null,
  }
}

export default async function Landing_Page() {
  const user = await getCurrentUser()

  let products: Product[] = []
  try {
    products = await prisma.product.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
    })
  } catch (error) {
    console.warn('Tabela de produtos vazia ou banco desconectado:', error)
  }

  return (
    <div className="page-root min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Header orquestrador */}
      <Header user={user} />

      <main className="flex-1">
        <Hero_Section />
        <Catalog_Section products={products} />
        <Delivery_Section />
        <Feedbacks_Section />
        <About_Section />
        <Especial_Order_Section />
      </main>

      <Footer />
    </div>
  );
}