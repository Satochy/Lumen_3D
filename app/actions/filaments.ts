'use server'

import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

const createFilamentSchema = z.object({
  material: z.string().trim().min(1, 'Informe o material.'),
  color: z.string().trim().min(1, 'Informe a cor.'),
  hexColor: z
    .string()
    .trim()
    .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Cor HEX inválida.')
    .optional()
    .or(z.literal('')),
  remainingGrams: z.coerce.number().nonnegative().default(0),
  minThresholdGrams: z.coerce.number().nonnegative().default(200),
})

const updateFilamentWeightSchema = z.object({
  id: z.string().uuid('ID de filamento inválido.'),
  remainingGrams: z.number().nonnegative('O peso restante não pode ser negativo.'),
})

export async function getFilaments() {
  await requireAdmin()

  try {
    const filaments = await prisma.filamentStock.findMany({
      orderBy: { color: 'asc' },
    })
    return { success: true, data: filaments }
  } catch (error) {
    console.error('Erro ao buscar filamentos:', error)
    return { success: false, error: 'Falha ao carregar estoque de filamentos.' }
  }
}

export async function createFilament(formData: FormData): Promise<void> {
  await requireAdmin()

  const parsed = createFilamentSchema.safeParse({
    material: formData.get('material'),
    color: formData.get('color'),
    hexColor: formData.get('hexColor') || '',
    remainingGrams: formData.get('remainingGrams') || 0,
    minThresholdGrams: formData.get('minThresholdGrams') || 200,
  })

  if (!parsed.success) {
    return
  }

  const { material, color, hexColor, remainingGrams, minThresholdGrams } = parsed.data

  try {
    await prisma.filamentStock.create({
      data: {
        material,
        color,
        hexColor: hexColor || null,
        remainingGrams,
        minThresholdGrams,
      },
    })
  } catch (error) {
    console.error('Erro ao criar filamento:', error)
    return
  }

  revalidatePath('/admin/filaments')
  revalidatePath('/admin')
}

export async function updateFilamentWeight(id: string, remainingGrams: number) {
  await requireAdmin()

  const parsed = updateFilamentWeightSchema.safeParse({ id, remainingGrams })
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Dados inválidos.',
    }
  }

  try {
    const updated = await prisma.filamentStock.update({
      where: { id: parsed.data.id },
      data: { remainingGrams: parsed.data.remainingGrams },
    })

    revalidatePath('/admin/filaments')
    revalidatePath('/admin')
    return { success: true, data: updated }
  } catch (error) {
    console.error('Erro ao atualizar peso do filamento:', error)
    return { success: false, error: 'Erro ao atualizar peso do filamento.' }
  }
}

export async function createFilamentAction(formData: FormData): Promise<{
  success: boolean
  error?: string
}> {
  await requireAdmin()

  const parsed = createFilamentSchema.safeParse({
    material: formData.get('material'),
    color: formData.get('color'),
    hexColor: formData.get('hexColor') || '',
    remainingGrams: formData.get('remainingGrams') || 0,
    minThresholdGrams: formData.get('minThresholdGrams') || 200,
  })

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Dados inválidos.',
    }
  }

  const { material, color, hexColor, remainingGrams, minThresholdGrams } =
    parsed.data

  try {
    await prisma.filamentStock.create({
      data: {
        material: material.toUpperCase(),
        color,
        hexColor: hexColor || null,
        remainingGrams,
        minThresholdGrams,
      },
    })
    revalidatePath('/admin/filaments')
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    console.error('Erro ao criar filamento:', error)
    return { success: false, error: 'Erro ao cadastrar bobina.' }
  }
}

export async function deleteFilamentAction(id: string): Promise<{
  success: boolean
  error?: string
}> {
  await requireAdmin()

  try {
    await prisma.filamentStock.delete({ where: { id } })
    revalidatePath('/admin/filaments')
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    console.error('Erro ao excluir filamento:', error)
    return { success: false, error: 'Erro ao excluir bobina do estoque.' }
  }
}
