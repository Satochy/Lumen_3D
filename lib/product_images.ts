import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

export const PRODUCT_IMAGES_BUCKET = 'product-images'
export const MAX_IMAGES = 6
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB por foto

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function getBucket() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY

  if (!url || !key) {
    throw new Error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no .env')
  }

  return createClient(url, key, { auth: { persistSession: false } }).storage.from(
    PRODUCT_IMAGES_BUCKET
  )
}

/** Retorna uma mensagem de erro, ou null se os arquivos forem válidos. */
export function validateImageFiles(files: File[], alreadyKept: number): string | null {
  if (alreadyKept + files.length > MAX_IMAGES) {
    return `Máximo de ${MAX_IMAGES} fotos por produto.`
  }

  for (const file of files) {
    if (!EXTENSIONS[file.type]) {
      return `"${file.name}": use imagens JPG, PNG ou WebP.`
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return `"${file.name}" passa de ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`
    }
  }

  return null
}

/** Envia as fotos e devolve as URLs públicas, na mesma ordem. Desfaz tudo se uma falhar. */
export async function uploadProductImages(files: File[]): Promise<string[]> {
  if (files.length === 0) return []

  const bucket = getBucket()
  const uploadedPaths: string[] = []

  try {
    for (const file of files) {
      const path = `products/${randomUUID()}.${EXTENSIONS[file.type]}`
      const buffer = Buffer.from(await file.arrayBuffer())

      const { error } = await bucket.upload(path, buffer, {
        contentType: file.type,
        cacheControl: '31536000',
      })
      if (error) throw error

      uploadedPaths.push(path)
    }
  } catch (error) {
    if (uploadedPaths.length > 0) await bucket.remove(uploadedPaths)
    throw error
  }

  return uploadedPaths.map((path) => bucket.getPublicUrl(path).data.publicUrl)
}

const PUBLIC_MARKER = `/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`

function pathFromUrl(url: string): string | null {
  const index = url.indexOf(PUBLIC_MARKER)
  if (index === -1) return null // imagem local (ex: /vaso-1.jpg), não está no bucket
  return decodeURIComponent(url.slice(index + PUBLIC_MARKER.length))
}

/** Remove do bucket as URLs que pertencem a ele. Ignora o resto. */
export async function deleteProductImages(urls: string[]): Promise<void> {
  const paths = urls.map(pathFromUrl).filter((p): p is string => p !== null)
  if (paths.length === 0) return

  const { error } = await getBucket().remove(paths)
  if (error) console.error('Erro ao remover imagens do Storage:', error)
}