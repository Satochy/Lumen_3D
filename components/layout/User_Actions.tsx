import Link from 'next/link'
import Image from 'next/image'
import { Shield, User } from 'lucide-react'

interface UserType {
  id: string
  name: string
  email: string
  role: string
  avatarUrl: string | null
}

interface UserActionsProps {
  user: UserType | null
}

export default function User_Actions({ user }: UserActionsProps) {
  if (user) {
    return (
      <div className="flex items-center gap-3">
        {user.role === 'ADMIN' && (
          <Link
            href="/admin"
            aria-label="Painel Admin"
            title="Painel Admin"
            className="btn-soft hidden md:flex items-center justify-center gap-1.5 w-10 h-10 lg:w-auto lg:h-auto lg:px-3 lg:py-1.5 text-xs font-semibold bg-cyan-950/60 border border-cyan-800/50 rounded-lg hover:border-cyan-400/50 text-cyan-300 transition"
          >
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden lg:inline">Painel Admin</span>
          </Link>
        )}

        <Link
          href="/profile"
          className="flex items-center gap-2 p-1.5 rounded-full bg-cyan-950/40 border border-cyan-800/40 hover:border-cyan-400/60 transition group"
          title="Acessar minha conta"
        >
          <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 overflow-hidden font-bold text-xs">
            {user.avatarUrl ? (
              <Image src={user.avatarUrl} alt={user.name} width={32} height={32} className="object-cover" />
            ) : (
              <User className="w-4 h-4 text-cyan-400" />
            )}
          </div>
          <span className="text-xs font-semibold text-slate-200 pr-2 hidden lg:inline group-hover:text-cyan-300 transition">
            {user.name}
          </span>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className="hidden min-[400px]:block text-xs font-semibold px-3.5 py-2 text-slate-300 hover:text-cyan-400 transition"
      >
        Entrar
      </Link>
      <Link
        href="/register"
        className="btn-fx text-xs font-bold px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg transition shadow-md shadow-cyan-500/10"
      >
        Cadastrar
      </Link>
    </div>
  )
}