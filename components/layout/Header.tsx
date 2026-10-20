import Image from 'next/image'
import Link from 'next/link'
import UserActions from './User_Actions'
import MobileNav from './Mobile_Nav'

interface UserType {
  id: string
  name: string
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 [@media(max-height:500px)]:h-16 flex items-center justify-between">
        
        {/* Logo */}
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

        {/* Slot Central (Livre para cada página injetar o que quiser) */}
        {children}

        {/* Ações do Canto Direito */}
        <div className="flex items-center gap-3">
          {actions}
          <UserActions user={user} />
          <div className="md:hidden">
            <MobileNav isAdmin={user?.role === 'ADMIN'} isGuest={!user} />
          </div>
        </div>

      </div>
    </header>
  )
}