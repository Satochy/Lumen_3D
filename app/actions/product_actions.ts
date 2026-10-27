'use server'

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
  price: number
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
  const price = Math.round(rawPrice * 100) / 100
  const stock = parseInt(String(formData.get('stock') ?? ''), 10)
  const rawWeight = String(formData.get('weightGrams') ?? '').replace(',', '.').trim()
  const weightGrams = rawWeight ? parseFloat(rawWeight) : null
  const dimensions = String(formData.get('dimensions') ?? '').trim() || null
  const isFeatured = formData.get('isFeatured') === 'on'

  if (!title) return { error: 'Informe o título do produto.' }
  if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE) return { error: 'Preço inválido.' }
  if (!Number.isInteger(stock) || stock < 0) return { error: 'Estoque inválido.' }
  if (weightGrams !== null && (!Number.isFinite(weightGrams) || weightGrams < 0)) {
    return { error: 'Peso inválido.' }
  }

  return {
    data: { title, description, category, price, stock, weightGrams, dimensions, isFeatured },
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
  _prev: any,
  formData: FormData
): Promise<FormState> {
  await requireAdmin()

  const parsed = parseFields(formData)
  if (parsed.error) return { error: parsed.error }
  if (!parsed.data) return { error: 'Dados inválidos.' }
  const data = parsed.data

  const files = getNewFiles(formData)
  const fileError = validateImageFiles(files, 0)
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
  _prev: any,
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
  const fileError = validateImageFiles(files, kept.length)
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