'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useRef, useEffect } from 'react'
import { LogOut, User as UserIcon, Settings, Package } from 'lucide-react'
import { signOut } from '@/app/actions/auth_actions'

interface UserType {
  id: string
  name: string | null
  email: string
  role: string
  avatarUrl: string | null
}

export default function User_Actions({ user }: { user?: UserType | null }) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fecha o menu ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!user) {
    return (
      <div className="hidden md:flex items-center gap-3">
        <Link 
          href="/login" 
          className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition"
        >
          Entrar
        </Link>
        <Link 
          href="/register" 
          className="btn-fx px-4 py-2 bg-cyan-950/40 border border-cyan-800/60 hover:border-cyan-400 text-cyan-400 font-bold text-xs rounded-lg transition"
        >
          Cadastrar
        </Link>
      </div>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 pr-3 bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 rounded-full transition group"
      >
        <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center border border-slate-700">
          {user.avatarUrl ? (
            <Image 
              src={user.avatarUrl} 
              alt={user.name || 'Avatar do Usuário'} 
              width={32} 
              height={32} 
              className="object-cover w-full h-full"
            />
          ) : (
            <UserIcon className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition" />
          )}
        </div>
        <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition hidden md:block">
          {user.name?.split(' ')[0] || user.email.split('@')[0]}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-[#0a0e1a] border border-cyan-950 rounded-xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          
          <div className="px-4 py-2 border-b border-slate-800/80 mb-2">
            <p className="text-xs font-bold text-white truncate">{user.name || user.email.split('@')[0]}</p>
            <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
          </div>

          <div className="flex flex-col">
            <Link 
              href="/profile" 
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-900/80 hover:text-white transition flex items-center gap-2"
            >
              <Settings className="w-3.5 h-3.5" />
              Minha Conta
            </Link>
            
            <Link 
              href="/profile/orders" 
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-900/80 hover:text-white transition flex items-center gap-2"
            >
              <Package className="w-3.5 h-3.5" />
              Meus Pedidos
            </Link>
            
            {user.role === 'ADMIN' && (
              <Link 
                href="/admin" 
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-xs font-bold text-cyan-400 hover:bg-cyan-950/40 transition flex items-center gap-2 border-t border-slate-800/80 mt-1 pt-3"
              >
                <Settings className="w-3.5 h-3.5" />
                Painel Admin
              </Link>
            )}
            
            <button 
              onClick={() => signOut()}
              className="w-full text-left px-4 py-2 text-xs font-medium text-rose-400 hover:bg-rose-950/20 transition flex items-center gap-2 border-t border-slate-800/80 mt-2 pt-3"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  )
}