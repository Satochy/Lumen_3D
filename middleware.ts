import { updateSession } from '@/utils/supabase/middleware'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Verifica autenticação e protege rotas do admin
  return updateSession(request)
}

export const config = {
  // Protege rotas autenticadas (/admin, /profile, /marketplace/checkout) e páginas de autenticação
  matcher: [
    '/admin/:path*',
    '/profile/:path*',
    '/marketplace/checkout/:path*',
    '/login/:path*',
    '/register/:path*',
  ],
}