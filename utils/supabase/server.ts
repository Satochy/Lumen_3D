import { createServerClient as createSupabaseSSRClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const createClient = async (persistSession: boolean = true) => {
  const cookieStore = await cookies()

  return createSupabaseSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const cookieOptions = persistSession
                ? options
                : { ...options, maxAge: undefined, expires: undefined }
              cookieStore.set(name, value, cookieOptions)
            })
          } catch {
            // Ignorado quando chamado em Server Component puro (o middleware atualiza a sessão)
            // O `setAll` foi chamado em um Component Route Handler.
            // Isso pode ser ignorado se você tiver middleware que lida com a atualização
            // de cookies com base no estado do usuário.
          }
        },
      },
    }
  )
}

export const createServerClient = createClient