'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export type ActionResponse<T = undefined> = {
  success: boolean
  data?: T
  error?: string | null
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']

const profileSchema = z.object({
  name: z.string().trim().min(3, 'O nome completo deve ter pelo menos 3 caracteres.'),
  username: z
    .string()
    .trim()
    .min(3, 'O username deve ter pelo menos 3 caracteres.')
    .max(30, 'O username deve ter no máximo 30 caracteres.'),
  phone: z.string().trim().optional().nullable(),
  cpf: z.string().trim().optional().nullable(),
  birthDate: z.string().trim().optional().nullable(),
})

const addressSchema = z.object({
  street: z.string().trim().min(2, 'Informe a rua/logradouro.'),
  number: z.string().trim().min(1, 'Informe o número.'),
  complement: z.string().trim().optional().nullable(),
  neighborhood: z.string().trim().min(2, 'Informe o bairro.'),
  city: z.string().trim().min(2, 'Informe a cidade.'),
  state: z.string().trim().length(2, 'Informe a UF com 2 letras (ex: SP).'),
  zipCode: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length === 8, 'O CEP deve ter 8 dígitos.'),
  isDefault: z.boolean().optional(),
})

async function hasValidImageSignature(file: File): Promise<boolean> {
  const buffer = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true
  // WEBP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return true
  }
  return false
}

async function uploadAvatarFile(userId: string, file: File): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  const storageClient = createSupabaseAdminClient(supabaseUrl, serviceKey)

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'png'
  const filePath = `avatars/${userId}-${Date.now()}.${safeExt}`

  const arrayBuffer = await file.arrayBuffer()
  const { error } = await storageClient.storage
    .from('product-images')
    .upload(filePath, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    })

  if (error) {
    throw new Error(`Falha no upload da imagem: ${error.message}`)
  }

  const { data } = storageClient.storage.from('product-images').getPublicUrl(filePath)
  return data.publicUrl
}

export async function updateProfileAction(
  _prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const sessionUser = await getCurrentUser()
  if (!sessionUser) {
    return { success: false, error: 'Sessão expirada. Faça login novamente.' }
  }

  const parsed = profileSchema.safeParse({
    name: formData.get('name'),
    username: formData.get('username'),
    phone: formData.get('phone') || null,
    cpf: formData.get('cpf') || null,
    birthDate: formData.get('birthDate') || null,
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Dados inválidos.' }
  }

  const { name, username, phone, cpf, birthDate } = parsed.data
  const cleanCpf = cpf ? cpf.replace(/\D/g, '') : null

  if (cleanCpf && cleanCpf.length !== 11) {
    return { success: false, error: 'O CPF deve conter 11 dígitos.' }
  }

  if (cleanCpf) {
    const cpfOwner = await prisma.user.findUnique({ where: { cpf: cleanCpf } })
    if (cpfOwner && cpfOwner.id !== sessionUser.id) {
      return { success: false, error: 'Este CPF já está vinculado a outra conta.' }
    }
  }

  let parsedBirthDate: Date | null = null
  if (birthDate) {
    const d = new Date(birthDate)
    if (isNaN(d.getTime()) || d >= new Date()) {
      return { success: false, error: 'Informe uma data de nascimento válida.' }
    }
    parsedBirthDate = d
  }

  let newAvatarUrl: string | undefined = undefined
  const avatarFile = formData.get('avatar')
  if (avatarFile instanceof File && avatarFile.size > 0) {
    if (!ALLOWED_MIME.includes(avatarFile.type)) {
      return { success: false, error: 'Formato inválido. Use JPG, PNG ou WebP.' }
    }
    if (avatarFile.size > MAX_AVATAR_BYTES) {
      return { success: false, error: 'A imagem deve ter no máximo 5 MB.' }
    }
    const validSig = await hasValidImageSignature(avatarFile)
    if (!validSig) {
      return { success: false, error: 'O arquivo enviado não é uma imagem válida.' }
    }

    try {
      newAvatarUrl = await uploadAvatarFile(sessionUser.id, avatarFile)
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erro ao enviar foto de perfil.' }
    }
  }

  try {
    await prisma.user.update({
      where: { id: sessionUser.id },
      data: {
        name,
        username,
        phone: phone || null,
        cpf: cleanCpf,
        birthDate: parsedBirthDate,
        ...(newAvatarUrl ? { avatarUrl: newAvatarUrl } : {}),
      },
    })
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error)
    return { success: false, error: 'Erro ao salvar alterações no banco de dados.' }
  }

  revalidatePath('/', 'layout')
  revalidatePath('/profile')
  return { success: true, error: null }
}

export async function sendEmailVerificationAction(): Promise<ActionResponse> {
  const sessionUser = await getCurrentUser()
  if (!sessionUser) {
    return { success: false, error: 'Sessão não autenticada.' }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: sessionUser.email,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

export async function createAddressAction(
  _prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const sessionUser = await getCurrentUser()
  if (!sessionUser) {
    return { success: false, error: 'Sessão não autenticada.' }
  }

  const parsed = addressSchema.safeParse({
    street: formData.get('street'),
    number: formData.get('number'),
    complement: formData.get('complement') || null,
    neighborhood: formData.get('neighborhood'),
    city: formData.get('city'),
    state: String(formData.get('state') ?? '').toUpperCase(),
    zipCode: formData.get('zipCode'),
    isDefault: formData.get('isDefault') === 'on',
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Dados de endereço inválidos.' }
  }

  const data = parsed.data

  try {
    const existingCount = await prisma.address.count({ where: { userId: sessionUser.id } })
    const shouldBeDefault = existingCount === 0 ? true : Boolean(data.isDefault)

    await prisma.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.address.updateMany({
          where: { userId: sessionUser.id, isDefault: true },
          data: { isDefault: false },
        })
      }

      await tx.address.create({
        data: {
          userId: sessionUser.id,
          street: data.street,
          number: data.number,
          complement: data.complement,
          neighborhood: data.neighborhood,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          isDefault: shouldBeDefault,
        },
      })
    })
  } catch (error) {
    console.error('Erro ao salvar endereço:', error)
    return { success: false, error: 'Não foi possível salvar o endereço.' }
  }

  revalidatePath('/profile')
  return { success: true, error: null }
}

export async function deleteAddressAction(addressId: string): Promise<ActionResponse> {
  const sessionUser = await getCurrentUser()
  if (!sessionUser) {
    return { success: false, error: 'Sessão não autenticada.' }
  }

  try {
    await prisma.address.deleteMany({
      where: { id: addressId, userId: sessionUser.id },
    })
    revalidatePath('/profile')
    return { success: true, error: null }
  } catch (error) {
    console.error('Erro ao remover endereço:', error)
    return { success: false, error: 'Falha ao remover endereço.' }
  }
}

export async function setDefaultAddressAction(addressId: string): Promise<ActionResponse> {
  const sessionUser = await getCurrentUser()
  if (!sessionUser) {
    return { success: false, error: 'Sessão não autenticada.' }
  }

  try {
    const target = await prisma.address.findFirst({
      where: { id: addressId, userId: sessionUser.id },
    })
    if (!target) {
      return { success: false, error: 'Endereço não encontrado.' }
    }

    await prisma.$transaction([
      prisma.address.updateMany({
        where: { userId: sessionUser.id },
        data: { isDefault: false },
      }),
      prisma.address.update({
        where: { id: addressId },
        data: { isDefault: true },
      }),
    ])

    revalidatePath('/profile')
    return { success: true, error: null }
  } catch (error) {
    console.error('Erro ao definir endereço padrão:', error)
    return { success: false, error: 'Não foi possível alterar o endereço padrão.' }
  }
}

export async function getUserDefaultCepAction(): Promise<ActionResponse<{ zipCode: string | null }>> {
  const sessionUser = await getCurrentUser()
  if (!sessionUser) {
    return { success: true, data: { zipCode: null }, error: null }
  }

  try {
    const defaultAddress = await prisma.address.findFirst({
      where: { userId: sessionUser.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: { zipCode: true },
    })

    return {
      success: true,
      data: { zipCode: defaultAddress?.zipCode ?? null },
      error: null,
    }
  } catch {
    return { success: false, error: 'Erro ao buscar CEP padrão.' }
  }
}