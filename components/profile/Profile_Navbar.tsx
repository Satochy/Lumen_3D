'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Profile_Navbar() {
  const pathname = usePathname()

  const links = [
    { href: '/', label: 'Início' },
    { href: '/marketplace', label: 'Marketplace' },
    { href: '/profile', label: 'Minha Conta' },
    { href: '/profile/orders', label: 'Meus Pedidos' },
  ]

  return (
    <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
      {links.map((link) => {
        const isActive = pathname === link.href
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              isActive
                ? 'text-cyan-400 font-bold'
                : 'hover:text-cyan-400 transition'
            }
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}