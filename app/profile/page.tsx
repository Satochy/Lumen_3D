import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Header, Footer } from '@/components/layout'
import Profile_Navbar from '@/components/profile/Profile_Navbar'
import Cart_Button from '@/components/cart/Cart_Button'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Profile_Client from '@/components/profile/Profile_Client'


export default async function ProfilePage() {
  const sessionUser = await getCurrentUser()
  if (!sessionUser) {
    redirect('/login')
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    include: {
      addresses: {
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      },
    },
  })

  if (!dbUser) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans">
      <Header user={sessionUser} logoHref="/" actions={<Cart_Button />}>
        <Profile_Navbar />
      </Header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Minha Conta</h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Gerencie seu perfil, foto de exibição, verificação de e-mail e endereços.
            </p>
          </div>
          <Link
            href="/profile/orders"
            className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-xs font-bold text-cyan-400 transition w-fit"
          >
            Ver Meus Pedidos →
          </Link>
        </div>

        <Profile_Client
          user={{
            id: dbUser.id,
            email: dbUser.email,
            username: dbUser.username,
            name: dbUser.name,
            avatarUrl: dbUser.avatarUrl,
            phone: dbUser.phone,
            cpf: dbUser.cpf,
            birthDate: dbUser.birthDate ? dbUser.birthDate.toISOString().split('T')[0] : null,
            emailConfirmedAt: sessionUser.emailConfirmedAt ?? null,
          }}
          addresses={dbUser.addresses}
        />
      </main>

      <Footer />
    </div>
  )
}