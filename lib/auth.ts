/**
 * Mock de usuário atual para desenvolvimento.
 * Quando a autenticação real for implementada (decisão pendente), substituir por
 * verificação real via Supabase Session ou JWT. Não alterar a assinatura da função.
 */
export interface User {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'CLIENT'
  avatarUrl: string | null
}

// Usuário de teste fixo: cuidar de criar o usuário real no DB via script upsert quando autenticação for implementada
const MOCK_USER: User = {
  id: '1',
  name: 'Satochy',
  email: 'satochy@lumen3d.com',
  role: 'ADMIN',
  avatarUrl: null,
}

export async function getCurrentUser(): Promise<User> {
  // TODO: substituir por verificação real quando `@supabase/ssr` for configurado
  return MOCK_USER
}

/**
 * Verificação de admin (placeholder).
 * Quando a autenticação real estiver ativa, implementar checagem real contra DB.
 */
export async function requireAdmin(): Promise<void> {
  const user = await getCurrentUser()
  if (user.role !== 'ADMIN') {
    throw new Error('Acesso não autorizado')
  }
}