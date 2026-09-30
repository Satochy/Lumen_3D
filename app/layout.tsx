import type { Metadata, Viewport } from 'next'
import './globals.css'
import Scroll_Reveal from '@/components/Scroll_Reveal'

export const metadata: Metadata = {
  title: 'Lúmen 3D | Do digital ao real.',
  description: 'Prototipagem, peças decorativas e modelos exclusivos impressos em 3D.',
  icons: {
    icon: '/logo-icon.png',
    shortcut: '/logo-icon.png',
    apple: '/logo-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      <body className="antialiased bg-[#050811] text-slate-100 overflow-x-hidden max-w-full w-full">
        <Scroll_Reveal />
        {children}
      </body>
    </html>
  )
}