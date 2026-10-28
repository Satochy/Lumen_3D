'use server'

import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

const signInSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
  rememberMe: z.boolean().optional(),
})

const signUpSchema = z.object({
  name: z.string().trim().min(3, 'Informe seu nome completo.'),
  username: z.string().trim().min(3, 'O username deve ter pelo menos 3 caracteres.'),
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
})

const resetRequestSchema = z.object({
  email: z.string().email('Informe um endereço de e-mail válido.'),
})

const updatePasswordSchema = z
  .object({
    password: z.string().min(8, 'A nova senha deve ter pelo menos 8 caracteres.'),
    confirmPassword: z.string().min(8, 'Confirme a nova senha.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  })

export async function signIn(_prevState: any, formData: FormData) {
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
    rememberMe: formData.get('rememberMe') === 'on',
  }

  const result = signInSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  const supabase = await createClient(Boolean(result.data.rememberMe))
  const { error } = await supabase.auth.signInWithPassword({
    email: result.data.email,
    password: result.data.password,
  })

  if (error) {
    if (error.message === 'Invalid login credentials') {
      return { error: 'E-mail ou senha incorretos.' }
    }
    if (error.message.includes('Email not confirmed')) {
      return { error: 'Por favor, desative a confirmação de email no painel do Supabase.' }
    }
    return { error: error.message }
  }

  await ensureProfileInDB()

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signUp(_prevState: any, formData: FormData) {
  const raw = {
    name: formData.get('name'),
    username: formData.get('username'),
    email: formData.get('email'),
    password: formData.get('password'),
  }

  const result = signUpSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  const { name, username, email, password } = result.data

  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    return { error: 'Este e-mail já está cadastrado.' }
  }

  const supabase = await createClient(true)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error || !data.user) {
    return { error: error?.message || 'Erro ao criar conta.' }
  }

  try {
    await prisma.user.create({
      data: {
        id: data.user.id,
        email,
        name,
        username,
        role: 'CLIENT',
      },
    })
  } catch (dbError) {
    console.error('Erro ao salvar no banco:', dbError)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function requestPasswordReset(
  _prevState: { error: string; success?: string },
  formData: FormData
): Promise<{ error: string; success?: string }> {
  const parsed = resetRequestSchema.safeParse({
    email: formData.get('email'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const headersList = await headers()
  const origin =
    headersList.get('origin') ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })

  if (error) {
    return { error: 'Não foi possível enviar o e-mail de recuperação. Tente novamente.' }
  }

  return {
    error: '',
    success: 'Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.',
  }
}

export async function updatePassword(
  _prevState: { error: string },
  formData: FormData
): Promise<{ error: string }> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (error) {
    return { error: error.message || 'Erro ao atualizar a senha.' }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}

async function ensureProfileInDB() {
  const supabase = await createClient()
  const { data, error: authError } = await supabase.auth.getUser()
  const supabaseUser = data?.user
  if (authError || !supabaseUser?.email) return

  const profileExists = await prisma.user.findUnique({
    where: { email: supabaseUser.email },
  })

  if (!profileExists) {
    await prisma.user.create({
      data: {
        id: supabaseUser.id,
        email: supabaseUser.email,
        name: 'Usuário',
        username: supabaseUser.email.split('@')[0],
        role: 'CLIENT',
      },
    })
  }
}