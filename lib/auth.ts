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

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient()
  const {
    data: { user: supabaseUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !supabaseUser || !supabaseUser.email) {
    return null
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: supabaseUser.email },
  })

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
}

export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') {
    redirect('/')
  }
  return user
}