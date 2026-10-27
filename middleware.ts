import { updateSession } from '@/utils/supabase/middleware'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Verifica autenticação e protege rotas do admin
  return updateSession(request)
}

export const config = {
  // Protege rotas específicas (/admin/*) e página de login
  matcher: ['/admin/:path*', '/login/:path*', '/register/:path*'],
}