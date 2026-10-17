import type { Prisma, Product } from '@prisma/client'

/**
 * Filtro único das vitrines e do checkout: produto arquivado não aparece
 * nem pode ser comprado. Use sempre este objeto em vez de repetir a condição.
 */
export const activeProducts = { archivedAt: null } satisfies Prisma.ProductWhereInput

/** Produto com o preço já convertido para number, seguro para Client Components. */
export type PublicProduct = Omit<Product, 'price'> & { price: number }

/**
 * Prisma.Decimal não pode ser passado a Client Components nem gravado no
 * localStorage do carrinho. Converta todo produto que sai do servidor para a
 * interface. Contas com dinheiro continuam sendo feitas no servidor, em Decimal.
 */
export function serializeProduct(product: Product): PublicProduct {
  return { ...product, price: product.price.toNumber() }
}