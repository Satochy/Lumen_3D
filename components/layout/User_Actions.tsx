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
            className="btn-soft hover-btn-bounce hidden md:flex items-center justify-center gap-1.5 w-10 h-10 lg:w-auto lg:h-auto lg:px-3 lg:py-1.5 text-xs font-semibold bg-cyan-950/60 border border-cyan-800/50 rounded-lg hover:border-cyan-400/50 text-cyan-300 transition-all duration-300"
          >
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden lg:inline">Painel Admin</span>
          </Link>
        )}

        {/* TODO(auth): voltar a apontar para /profile quando a rota existir */}
        <span
          className="flex items-center gap-2 p-1.5 rounded-full bg-cyan-950/40 border border-cyan-800/40 transition-all duration-300 group"
          title="Minha conta (em breve)"
          aria-disabled="true"
        >
          <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 overflow-hidden font-bold text-xs">
            {user.avatarUrl ? (
              <Image src={user.avatarUrl} alt={user.name} width={32} height={32} className="object-cover" />
            ) : (
              <User className="w-4 h-4 text-cyan-400" />
            )}
          </div>
          <span className="text-xs font-semibold text-slate-200 pr-2 hidden lg:inline group-hover:text-cyan-300 transition-colors duration-300">
            {user.name}
          </span>
        </span>
      </div>
    )
  }

  // TODO(auth): trocar por <Link href="/login"> e <Link href="/register">
  // quando as rotas existirem. Enquanto isso, ficam só como indicativo visual.
  return (
    <div className="flex items-center gap-2">
      <span
        className="hidden min-[400px]:block text-xs font-semibold px-3.5 py-2 text-slate-500 cursor-default"
        title="Login em breve"
      >
        Entrar
      </span>
      <span
        className="text-xs font-bold px-4 py-2 bg-cyan-950/60 border border-cyan-800/50 text-cyan-500/70 rounded-lg cursor-default"
        title="Cadastro em breve"
      >
        Cadastrar
      </span>
    </div>
  )
}