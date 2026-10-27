'use server'

import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const signInSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
})

const signUpSchema = z.object({
  name: z.string().trim().min(3, 'Informe seu nome completo.'),
  username: z.string().trim().min(3, 'O username deve ter pelo menos 3 caracteres.'),
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
})

export async function signIn(_prevState: any, formData: FormData) {
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
  }

  const result = signInSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  const supabase = await createClient()
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

  // Apenas verifica se o EMAIL já existe, username não é mais unique
  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    return { error: 'Este e-mail já está cadastrado.' }
  }

  const supabase = await createClient()
  
  // Como o 'Confirm email' estará desligado no Supabase, 
  // o signUp loga o usuário e salva o cookie da sessão automaticamente.
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
    // Se o banco falhar, o Supabase já criou o Auth. O usuário está logado,
    // mas sem perfil Prisma. A função ensureProfileInDB vai curar isso nos próximos logins.
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