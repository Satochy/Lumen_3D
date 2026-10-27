import Image from 'next/image'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import UserActions from './User_Actions'
import MobileNav from './Mobile_Nav'

interface UserType {
  id: string
  username: string
  name: string | null
  email: string
  role: string
  avatarUrl: string | null
}

interface HeaderProps {
  user?: UserType | null
  logoHref?: string
  children?: React.ReactNode
  actions?: React.ReactNode
}

export default function Header({ user = null, logoHref = '/', children, actions }: HeaderProps) {
  return (
    <header className="border-b border-cyan-950/40 bg-[#050811]/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 max-[360px]:px-4 h-20 [@media(max-height:500px)]:h-16 flex items-center justify-between">
        <Link href={logoHref} className="hover-btn-bounce inline-flex items-center gap-3">
          <div className="relative w-15 h-15 flex items-center justify-center">
            <Image
              src="/logo-completa.png"
              alt="Lúmen 3D Ícone"
              width={60}
              height={60}
              className="object-contain"
              priority
            />
          </div>
        </Link>

        {children}

        <div className="flex items-center gap-3">
          {actions}

          {user?.role === 'ADMIN' && (
            <Link
              href="/admin"
              title="Acessar Painel Administrativo"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-cyan-950/50 border border-cyan-500/40 hover:border-cyan-400 hover:bg-cyan-900/40 text-cyan-400 text-xs font-bold transition"
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">ADM</span>
            </Link>
          )}

          <UserActions user={user} />

          <div className="md:hidden">
            <MobileNav isAdmin={user?.role === 'ADMIN'} isGuest={!user} />
          </div>
        </div>
      </div>
    </header>
  )
}