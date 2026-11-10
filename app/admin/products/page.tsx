import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Product_Manager_Client, {
  type SerializedAdminProduct,
} from '@/components/admin/Product_Manager_Client'

export default async function AdminProductsPage() {
  await requireAdmin()

  // O admin enxerga todos os produtos, inclusive arquivados.
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { orderItems: true } } },
  })

  const serializedProducts: SerializedAdminProduct[] = products.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    description: p.description,
    category: p.category,
    price: p.price.toNumber(),
    stock: p.stock,
    reservedStock: p.reservedStock ?? 0,
    isMadeToOrder: p.isMadeToOrder,
    productionDays: p.productionDays,
    weightGrams: p.weightGrams,
    dimensions: p.dimensions,
    images: p.images,
    isFeatured: p.isFeatured,
    archivedAt: p.archivedAt ? p.archivedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    orderItemsCount: p._count.orderItems,
  }))

  return <Product_Manager_Client initialProducts={serializedProducts} />
}
