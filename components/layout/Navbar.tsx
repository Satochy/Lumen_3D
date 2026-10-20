import Link from 'next/link'
import { siteConfig } from '@/lib/config'

export default function Navbar() {
  return (
    <nav className="hidden md:flex items-center gap-8 text-xs font-medium tracking-wider text-slate-400 uppercase">
      <a href="#catalogo" className="nav-link hover:text-cyan-400 transition">Catálogo</a>
      <Link href="/marketplace" className="nav-link text-cyan-400 font-bold hover:text-cyan-300 transition flex items-center gap-1">
        Marketplace
      </Link>
      <a href="#orcamento" className="nav-link hover:text-cyan-400 transition">Orçamentos</a>
      <a href={siteConfig.instagram.url} target="_blank" rel="noopener noreferrer" className="nav-link hover:text-cyan-400 transition">Instagram</a>
    </nav>
  )
}