'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getFilaments() {
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
  const material = formData.get('material') as string
  const color = formData.get('color') as string
  const hexColor = formData.get('hexColor') as string
  const remainingGrams = parseFloat(formData.get('remainingGrams') as string) || 0
  const minThresholdGrams = parseFloat(formData.get('minThresholdGrams') as string) || 200

  if (!material || !color) {
    return
  }

  await prisma.filamentStock.create({
    data: {
      material,
      color,
      hexColor,
      remainingGrams,
      minThresholdGrams,
    },
  })

  revalidatePath('/admin/filaments')
}

export async function updateFilamentWeight(id: string, remainingGrams: number) {
  try {
    const updated = await prisma.filamentStock.update({
      where: { id },
      data: { remainingGrams },
    })

    revalidatePath('/admin/filaments')
    return { success: true, data: updated }
  } catch (error) {
    console.error('Erro ao atualizar peso do filamento:', error)
    return { success: false, error: 'Erro ao atualizar peso do filamento.' }
  }
}