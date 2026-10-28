import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  // O link de 'Esqueci minha senha' enviará next=/reset-password
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Deu certo! Redireciona para a página de redefinir a senha
      return NextResponse.redirect(`${origin}${next}`)
    }
    
    // Se o código expirou ou falhou, redireciona para o login com a mensagem de erro da API
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
  }

  // Se não tem 'code', mas a URL contém '#access_token' (Hash Fragment do Supabase)
  // o Next.js middleware vai pegar isso na próxima renderização, então podemos deixar passar.
  if (request.url.includes('access_token')) {
    return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/login`)
}