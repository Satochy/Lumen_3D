'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createProductAction(formData: FormData) {
  const title = (formData.get('title') as string) || ''
  const slug = (formData.get('slug') as string) || ''
  const description = (formData.get('description') as string) || ''
  const category = (formData.get('category') as string) || 'Geral'

  const rawPrice = (formData.get('price') as string || '').replace(',', '.')
  const price = parseFloat(rawPrice) || 0

  const rawStock = formData.get('stock') as string
  const stock = parseInt(rawStock, 10) || 0

  const rawWeight = formData.get('weightGrams') as string
  const weightGrams = rawWeight ? parseFloat(rawWeight.replace(',', '.')) : null

  const dimensions = (formData.get('dimensions') as string) || null
  const isFeatured = formData.get('isFeatured') === 'on' || formData.get('isFeatured') === 'true'

  const rawImages = formData.get('images') as string
  const images = rawImages
    ? rawImages.split(',').map((img) => img.trim()).filter(Boolean)
    : []

  if (!title || !slug) {
    throw new Error('Título e Slug são obrigatórios.')
  }

  await prisma.product.create({
    data: {
      title,
      slug,
      description,
      category,
      price,
      stock,
      images,
      dimensions,
      weightGrams,
      isFeatured,
    },
  })

  revalidatePath('/admin/products')
  revalidatePath('/marketplace')
  redirect('/admin/products')
}

export async function deleteProductAction(id: string) {
  await prisma.product.delete({
    where: { id },
  })

  revalidatePath('/admin/products')
  revalidatePath('/marketplace')
}