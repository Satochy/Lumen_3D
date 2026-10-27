/**
 * Interface do usuário com role administrativa ou cliente.
 */
export interface User {
  id: string
  name: string | null
  email: string
  role: 'ADMIN' | 'CLIENT'
  avatarUrl: string | null
}

/**
 * Obtém o usuário autenticado da sessão Supabase e busca o perfil no banco.
 * Lança erro se não houver sessão ativa ou se o usuário não tiver perfil no DB.
 */
export async function getCurrentUser(): Promise<User | null> {
  // Importa aqui para evitar problema de ciclo (cliente Supabase depende de env vars)
  const { createClient } = await import('@/utils/supabase/server')
  const { prisma } = await import('@/lib/prisma')

  const supabase = await createClient()
  const { data, error: authError } = await supabase.auth.getUser()
  const supabaseUser = data?.user

  if (authError || !supabaseUser) {
    return null
  }

  // Busca o registro correspondente na tabela User usando o email (campo unique)
  const userProfile = await prisma.user.findUnique({
    where: { email: supabaseUser.email },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      birthDate: true,
      phone: true,
      cpf: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!userProfile) {
    return null
  }

  return {
    id: userProfile.id,
    name: userProfile.name,
    email: userProfile.email,
    role: userProfile.role,
    avatarUrl: null, // A tabela User não tem avatarUrl ainda
  }
}

/**
 * Verifica se o usuário é administrador e lança erro caso contrário.
 */
export async function requireAdmin(): Promise<void> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') {
    throw new Error('Acesso não autorizado. Apenas administradores.')
  }
}