'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getProducts() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: products }
  } catch (error) {
    console.error('Erro ao buscar produtos:', error)
    return { success: false, error: 'Falha ao carregar produtos.' }
  }
}

export async function createProduct(formData: FormData): Promise<void> {
  const title = formData.get('title') as string
  const slug = formData.get('slug') as string
  const description = formData.get('description') as string
  const category = (formData.get('category') as string) || 'Geral'
  const price = parseFloat(formData.get('price') as string) || 0
  const stock = parseInt(formData.get('stock') as string) || 0

  if (!title || !slug) return

  await prisma.product.create({
    data: {
      title,
      slug,
      description,
      category,
      price,
      stock,
      images: [],
    },
  })

  revalidatePath('/admin/products')
}