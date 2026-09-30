import Image from 'next/image'
import Navbar from './Navbar'
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
  user: UserType | null
  children?: React.ReactNode
}

export default function Header({ user, children }: HeaderProps) {
  return (
    <header className="border-b border-cyan-950/40 bg-[#050811]/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 max-[360px]:px-4 h-20 [@media(max-height:500px)]:h-16 flex items-center justify-between">
        <a href="#hero" className="hover-btn-bounce inline-flex items-center gap-3">
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
        </a>

        {/* Navegação injetada ou padrão */}
        {children ? children : <Navbar />}

        {/* Ações do utilizador + Mobile Nav */}
        <div className="flex items-center gap-3">
          <UserActions user={user} />
          <div className="md:hidden">
            <MobileNav isAdmin={user?.role === 'ADMIN'} isGuest={!user} />
          </div>
        </div>

      </div>
    </header>
  )
}