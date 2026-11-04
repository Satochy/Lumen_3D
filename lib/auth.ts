import { cache } from 'react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export interface User {
  id: string
  username: string
  name: string | null 
  email: string
  role: 'ADMIN' | 'CLIENT'
  avatarUrl: string | null
  emailConfirmedAt?: string | null
}

const userSelectFields = {
  id: true,
  username: true,
  name: true,
  email: true,
  role: true,
  avatarUrl: true,
} as const

/**
 * Retorna o usuário autenticado na sessão atual com memoização por request (React cache).
 * Evita múltiplas requisições HTTP redundantes para a API do Supabase e queries repetidas no banco.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient()
  const {
    data: { user: supabaseUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !supabaseUser || !supabaseUser.email) {
    return null
  }

  let dbUser = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
    select: userSelectFields,
  })

  if (!dbUser && supabaseUser.email) {
    dbUser = await prisma.user.findUnique({
      where: { email: supabaseUser.email },
      select: userSelectFields,
    })
  }

  if (!dbUser) {
    return null
  }

  return {
    id: dbUser.id,
    username: dbUser.username,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
    avatarUrl: dbUser.avatarUrl ?? null,
    emailConfirmedAt: supabaseUser.email_confirmed_at ?? null,
  }
})

export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') {
    redirect('/')
  }
  return user
}