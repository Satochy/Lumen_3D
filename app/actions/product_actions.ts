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

const productFieldsSchema = z
  .object({
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
    isMadeToOrder: z.boolean().default(false),
    productionDays: z
      .number({ message: 'Prazo de produção inválido.' })
      .int('Prazo de produção inválido.')
      .positive('O prazo de produção deve ser maior que zero.')
      .nullable(),
    weightGrams: z
      .number({ message: 'Peso inválido.' })
      .finite('Peso inválido.')
      .nonnegative('Peso inválido.')
      .nullable(),
    dimensions: z.string().trim().nullable(),
    isFeatured: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (
      data.isMadeToOrder &&
      (data.productionDays === null ||
        !Number.isSafeInteger(data.productionDays) ||
        data.productionDays < 1)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['productionDays'],
        message:
          'Informe o prazo comercial de produção (em dias úteis, mínimo 1) para produtos Sob Encomenda.',
      })
    }
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
  isMadeToOrder: boolean
  productionDays: number | null
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
  const stock = parseInt(String(formData.get('stock') ?? '0'), 10)
  const isMadeToOrder =
    formData.get('isMadeToOrder') === 'on' || formData.get('isMadeToOrder') === 'true'
  const rawProductionDays = String(formData.get('productionDays') ?? '').trim()
  const productionDays =
    isMadeToOrder && rawProductionDays ? parseInt(rawProductionDays, 10) : null
  const rawWeight = String(formData.get('weightGrams') ?? '').replace(',', '.').trim()
  const weightGrams = rawWeight ? parseFloat(rawWeight) : null
  const dimensions = String(formData.get('dimensions') ?? '').trim() || null
  const isFeatured = formData.get('isFeatured') === 'on'

  const parsed = productFieldsSchema.safeParse({
    title,
    description,
    category,
    price: priceNumber,
    stock: Number.isNaN(stock) && isMadeToOrder ? 0 : stock,
    isMadeToOrder,
    productionDays,
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

export async function archiveProductAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  try {
    const product = await prisma.product.update({
      where: { id },
      data: { archivedAt: new Date() },
    })
    revalidateStore(product.slug)
    return { success: true }
  } catch (error) {
    console.error('Erro ao arquivar produto:', id, error)
    return { success: false, error: 'Não foi possível arquivar o produto.' }
  }
}

export async function restoreProductAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  try {
    const product = await prisma.product.update({
      where: { id },
      data: { archivedAt: null },
    })
    revalidateStore(product.slug)
    return { success: true }
  } catch (error) {
    console.error('Erro ao restaurar produto:', id, error)
    return { success: false, error: 'Não foi possível restaurar o produto.' }
  }
}

export async function deleteProductAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  const orderCount = await prisma.orderItem.count({ where: { productId: id } })
  if (orderCount > 0) {
    return {
      success: false,
      error:
        'Este produto possui histórico de vendas e não pode ser apagado definitivamente. Utilize a opção Arquivar.',
    }
  }

  try {
    const product = await prisma.$transaction(async (tx) => {
      await tx.stockReservation.deleteMany({ where: { productId: id } })
      await tx.stockMovement.deleteMany({ where: { productId: id } })
      return tx.product.delete({ where: { id } })
    })
    await deleteProductImages(product.images)
    revalidateStore(product.slug)
    return { success: true }
  } catch (error) {
    console.error('Erro -> excluir produto:', id, error)
    return {
      success: false,
      error: 'Erro ao excluir o produto permanentemente. Tente novamente.',
    }
  }
}

export async function bulkArchiveProductsAction(
  ids: string[]
): Promise<{ success: boolean; count?: number; error?: string }> {
  await requireAdmin()

  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, error: 'Nenhum produto selecionado para arquivar.' }
  }

  try {
    const result = await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { archivedAt: new Date() },
    })
    revalidateStore()
    return { success: true, count: result.count }
  } catch (error) {
    console.error('Erro ao arquivar produtos em lote:', error)
    return {
      success: false,
      error: 'Falha ao arquivar os produtos selecionados.',
    }
  }
}

export async function bulkDeleteProductsAction(
  ids: string[]
): Promise<{ success: boolean; deletedCount?: number; blockedCount?: number; error?: string }> {
  await requireAdmin()

  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, error: 'Nenhum produto selecionado para excluir.' }
  }

  try {
    // Identifica quais produtos possuem pedidos vinculados (histórico financeiro protegido)
    const productsWithOrders = await prisma.orderItem.findMany({
      where: { productId: { in: ids } },
      select: { productId: true },
      distinct: ['productId'],
    })

    const blockedIds = new Set(
      productsWithOrders
        .map((item) => item.productId)
        .filter((pid): pid is string => Boolean(pid))
    )
    const deletableIds = ids.filter((id) => !blockedIds.has(id))

    if (deletableIds.length === 0) {
      return {
        success: false,
        blockedCount: blockedIds.size,
        error:
          'Os produtos selecionados possuem histórico de vendas e não podem ser excluídos permanentemente. Utilize a opção Arquivar.',
      }
    }

    const productsToDelete = await prisma.product.findMany({
      where: { id: { in: deletableIds } },
      select: { images: true },
    })

    const deletedResult = await prisma.$transaction(async (tx) => {
      await tx.stockReservation.deleteMany({
        where: { productId: { in: deletableIds } },
      })
      await tx.stockMovement.deleteMany({
        where: { productId: { in: deletableIds } },
      })
      return tx.product.deleteMany({
        where: { id: { in: deletableIds } },
      })
    })

    const allImages = productsToDelete.flatMap((p) => p.images)
    if (allImages.length > 0) {
      await deleteProductImages(allImages)
    }

    revalidateStore()
    return {
      success: true,
      deletedCount: deletedResult.count,
      blockedCount: blockedIds.size,
    }
  } catch (error) {
    console.error('Erro ao excluir produtos em lote:', error)
    return {
      success: false,
      error: 'Falha ao excluir os produtos selecionados. Tente novamente.',
    }
  }
}
