import { Header, Footer, Navbar } from '@/components/layout'
import { getCurrentUser } from '@/lib/auth'
import {
  Hero_Section,
  Catalog_Section,
  Delivery_Section,
  Feedbacks_Section,
  About_Section,
  Especial_Order_Section
} from '@/components/sections'

import { prisma } from '@/lib/prisma'
import { activeProducts, serializeProduct, type PublicProduct } from '@/lib/product_helpers'

export const revalidate = 0

export default async function Landing_Page() {
  const user = await getCurrentUser()

  let products: PublicProduct[] = []
  try {
    const rawProducts = await prisma.product.findMany({
      where: activeProducts,
      take: 6,
      orderBy: { createdAt: 'desc' },
    })

    // Converte o Decimal do Prisma para number usando serializeProduct
    products = rawProducts.map(serializeProduct)
  } catch (error) {
    console.warn('Tabela de produtos vazia ou banco desconectado:', error)
  }

  return (
    <div className="page-root min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Header orquestrador */}
      <Header user={user} logoHref="#hero">
        <Navbar />
      </Header>

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
  )
}