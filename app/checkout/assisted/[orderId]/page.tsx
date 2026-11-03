import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Header, Footer } from '@/components/layout'
import Cart_Button from '@/components/cart/Cart_Button'
import Assisted_Checkout_Unlock from '@/components/checkout/Assisted_Checkout_Unlock'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function AssistedCheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  const cookieStore = await cookies()
  const isUnlocked = cookieStore.get(`unlocked_order_${orderId}`)?.value === 'true'

  // Se já foi desbloqueado por cookie, avança diretamente ao checkout
  if (isUnlocked) {
    redirect(`/marketplace/checkout/${orderId}`)
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      isAssistedSale: true,
      assistedSaleExpectedEmail: true,
      userId: true,
    },
  })

  if (!order || !order.isAssistedSale) {
    redirect('/marketplace')
  }

  const user = await getCurrentUser()
  const expectedEmail = order.assistedSaleExpectedEmail?.trim().toLowerCase()
  const userEmail = user?.email?.trim().toLowerCase()

  // Se o usuário já estiver logado E o email da sessão bater, redireciona de imediato
  if (user && expectedEmail && userEmail === expectedEmail) {
    if (order.userId !== user.id) {
      await prisma.order.update({
        where: { id: order.id },
        data: { userId: user.id },
      })
    }
    redirect(`/marketplace/checkout/${orderId}`)
  }

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans">
      <Header user={user} logoHref="/" actions={<Cart_Button />} />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <Assisted_Checkout_Unlock orderId={orderId} />
      </main>

      <Footer />
    </div>
  )
}
