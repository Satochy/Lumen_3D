'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Menu, X, Shield } from 'lucide-react'

type Props = { isAdmin: boolean; isGuest: boolean }

const linkCls =
  'block px-6 py-3.5 text-xs font-medium tracking-wider text-slate-300 uppercase border-t border-cyan-950/40 hover:text-cyan-400 hover:bg-cyan-950/30 transition'

export default function Mobile_Nav({ isAdmin, isGuest }: Props) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => mq.matches && setOpen(false)
    window.addEventListener('keydown', onKey)
    mq.addEventListener('change', onChange)
    return () => {
      window.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onChange)
    }
  }, [open])

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={open}
        aria-controls="mobile-nav"
        className="w-10 h-10 flex items-center justify-center rounded-lg bg-cyan-950/40 border border-cyan-800/40 text-cyan-300 hover:border-cyan-400/60 active:scale-95 transition"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* posicionado em relação ao <header> sticky */}
      <nav
        id="mobile-nav"
        aria-label="Menu principal"
        className={`absolute left-0 right-0 top-full bg-[#050811]/95 backdrop-blur-md border-b border-cyan-950/40 shadow-2xl shadow-black/40 transition-[opacity,transform,visibility] duration-300 ${
          open
            ? 'opacity-100 translate-y-0 visible'
            : 'opacity-0 -translate-y-2 invisible pointer-events-none'
        }`}
      >
        <a href="#catalogo" onClick={close} className={linkCls}>Catálogo</a>
        <Link href="/marketplace" onClick={close} className={`${linkCls} !text-cyan-400 font-bold`}>Marketplace</Link>
        <a href="#orcamento" onClick={close} className={linkCls}>Orçamentos</a>
        <a
          href="https://instagram.com/lumen.3d_"
          target="_blank"
          rel="noopener noreferrer"
          onClick={close}
          className={linkCls}
        >
          Instagram
        </a>

        {isAdmin && (
          <Link href="/admin" onClick={close} className={`${linkCls} md:hidden flex items-center gap-2 !text-cyan-300`}>
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            Painel Admin
          </Link>
        )}
        {isGuest && (
          <Link href="/login" onClick={close} className={`${linkCls} min-[400px]:hidden`}>Entrar</Link>
        )}
      </nav>
    </div>
  )
}