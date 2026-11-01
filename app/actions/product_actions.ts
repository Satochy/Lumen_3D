'use server'

import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  deleteProductImages,
  uploadProductImages,
  validateImageFiles,
} from '@/lib/product_images'

export type FormState = {
  error: string
}

// Limite da coluna Decimal(10, 2)
const MAX_PRICE = 99999999.99

const productFieldsSchema = z.object({
  title: z.string().trim().min(1, 'Informe o título do produto.'),
  description: z.string().trim(),
  category: z.string().trim().default('Geral'),
  price: z
    .number({ message: 'Preço inválido.' })
    .finite('Preço inválido.')
    .nonnegative('Preço inválido.')
    .max(MAX_PRICE, 'Preço inválido.'),
  stock: z
    .number({ message: 'Estoque inválido.' })
    .int('Estoque inválido.')
    .nonnegative('Estoque inválido.'),
  weightGrams: z
    .number({ message: 'Peso inválido.' })
    .finite('Peso inválido.')
    .nonnegative('Peso inválido.')
    .nullable(),
  dimensions: z.string().trim().nullable(),
  isFeatured: z.boolean(),
})

function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function uniqueSlug(base: string) {
  let slug = base
  let n = 2
  while (await prisma.product.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${n++}`
  }
  return slug
}

function getNewFiles(formData: FormData): File[] {
  return formData
    .getAll('newImages')
    .filter((f): f is File => f instanceof File && f.size > 0)
}

type ParsedProductData = {
  title: string
  description: string
  category: string
  price: Prisma.Decimal
  stock: number
  weightGrams: number | null
  dimensions: string | null
  isFeatured: boolean
}

function parseFields(formData: FormData): { error?: string; data?: ParsedProductData } {
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const category = String(formData.get('category') ?? '').trim() || 'Geral'
  const rawPrice = parseFloat(String(formData.get('price') ?? '').replace(',', '.'))
  const priceNumber = Math.round(rawPrice * 100) / 100
  const stock = parseInt(String(formData.get('stock') ?? ''), 10)
  const rawWeight = String(formData.get('weightGrams') ?? '').replace(',', '.').trim()
  const weightGrams = rawWeight ? parseFloat(rawWeight) : null
  const dimensions = String(formData.get('dimensions') ?? '').trim() || null
  const isFeatured = formData.get('isFeatured') === 'on'

  const parsed = productFieldsSchema.safeParse({
    title,
    description,
    category,
    price: priceNumber,
    stock,
    weightGrams,
    dimensions,
    isFeatured,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Dados inválidos.' }
  }

  return {
    data: {
      ...parsed.data,
      category: parsed.data.category || 'Geral',
      price: new Prisma.Decimal(parsed.data.price.toFixed(2)),
    },
  }
}

function revalidateStore(slug?: string) {
  revalidatePath('/admin/products')
  revalidatePath('/marketplace')
  revalidatePath('/marketplace/[slug]', 'page')
  revalidatePath('/')
  if (slug) revalidatePath(`/marketplace/${slug}`)
}

export async function createProductAction(
  _prev: unknown,
  formData: FormData
): Promise<FormState> {
  await requireAdmin()

  const parsed = parseFields(formData)
  if (parsed.error) return { error: parsed.error }
  if (!parsed.data) return { error: 'Dados inválidos.' }
  const data = parsed.data

  const files = getNewFiles(formData)
  const fileError = await validateImageFiles(files, 0)
  if (fileError) return { error: fileError }

  const base = slugify(String(formData.get('slug') ?? '') || data.title)
  if (!base) return { error: 'Não foi possível gerar o slug. Use letras ou números no título.' }
  const slug = await uniqueSlug(base)

  let images: string[] = []
  try {
    images = await uploadProductImages(files)
    await prisma.product.create({ data: { ...data, slug, images } })
  } catch (error) {
    console.error('Erro ao cadastrar produto:', error)
    await deleteProductImages(images)
    return { error: 'Falha ao cadastrar o produto. Tente novamente.' }
  }

  revalidateStore(slug)
  redirect('/admin/products')
}

export async function updateProductAction(
  id: string,
  _prev: unknown,
  formData: FormData
): Promise<FormState> {
  await requireAdmin()

  const current = await prisma.product.findUnique({ where: { id } })
  if (!current) return { error: 'Produto não encontrado.' }

  const parsed = parseFields(formData)
  if (parsed.error) return { error: parsed.error }
  if (!parsed.data) return { error: 'Dados inválidos.' }
  const data = parsed.data

  const kept = formData
    .getAll('existingImages')
    .map(String)
    .filter((url) => current.images.includes(url))
  const removed = current.images.filter((url) => !kept.includes(url))

  const files = getNewFiles(formData)
  const fileError = await validateImageFiles(files, kept.length)
  if (fileError) return { error: fileError }

  let uploaded: string[] = []
  try {
    uploaded = await uploadProductImages(files)
    await prisma.product.update({
      where: { id },
      data: { ...data, images: [...kept, ...uploaded] },
    })
  } catch (error) {
    console.error('Erro ao atualizar produto:', error)
    await deleteProductImages(uploaded)
    return { error: 'Falha ao salvar as alterações. Tente novamente.' }
  }

  await deleteProductImages(removed)
  revalidateStore(current.slug)
  redirect('/admin/products')
}

export async function archiveProductAction(id: string) {
  await requireAdmin()

  try {
    const product = await prisma.product.update({
      where: { id },
      data: { archivedAt: new Date() },
    })
    revalidateStore(product.slug)
  } catch (error) {
    console.error('Erro ao arquivar produto:', id, error)
  }
}

export async function restoreProductAction(id: string) {
  await requireAdmin()

  try {
    const product = await prisma.product.update({
      where: { id },
      data: { archivedAt: null },
    })
    revalidateStore(product.slug)
  } catch (error) {
    console.error('Erro ao restaurar produto:', id, error)
  }
}

export async function deleteProductAction(id: string) {
  await requireAdmin()

  const orderCount = await prisma.orderItem.count({ where: { productId: id } })
  if (orderCount > 0) {
    console.warn('Exclusão negada: produto com pedidos. Arquive-o.', id)
    return
  }

  try {
    const product = await prisma.product.delete({ where: { id } })
    await deleteProductImages(product.images)
    revalidateStore(product.slug)
  } catch (error) {
    console.error('Erro -> excluir produto:', id, error)
  }
}
