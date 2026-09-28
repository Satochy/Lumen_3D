import { Header, Footer } from '@/components/layout'
import { 
  Hero_Section, 
  Catalog_Section, 
  Delivery_Section, 
  Feedbacks_Section, 
  About_Section, 
  Especial_Order_Section 
} from '@/components/sections'
import Scroll_Reveal from '@/components/Scroll_Reveal'

import { prisma } from '@/lib/prisma'
import { Product } from '@prisma/client'

export const revalidate = 0

// ============================================================================
// VERIFICADOR DE SESSÃO / AUTENTICAÇÃO (MOCK PARA TESTES DE INTERFACE)
// ============================================================================
// Altere o retorno desta função para testar os estados da aplicação:
//
// 1. SIMULAR ADMIN: Mantenha role: 'ADMIN'
// 2. SIMULAR USUÁRIO COMUM: Mude role para 'USER'
// 3. SIMULAR DESLOGADO: Descomente 'return null' e comente o objeto abaixo
// ============================================================================
async function getCurrentUser() {
  // return null // <-- Descomente para testar a visualização de visitante (deslogado)

  return {
    id: '1',
    name: 'Satochy',
    email: 'satochy@lumen3d.com',
    role: 'ADMIN', // Opções: 'ADMIN' ou 'USER'
    avatarUrl: null, // URL da foto ou null
  }
}

export default async function Landing_Page() {
  const user = await getCurrentUser()

  // Busca dos produtos no banco. Se o banco estiver vazio/desconectado,
  // cai no catch e o CatalogSection exibe a mensagem de aviso padrão.
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
      <Scroll_Reveal />

      {/* Header orquestrador: distribui user para UserActions e MobileNav */}
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
