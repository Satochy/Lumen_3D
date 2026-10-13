import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { updateProductAction } from '@/app/actions/product_actions'
import Product_Form from '@/components/admin/Product_Form'

interface EditProductPageProps {
  params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params
  const product = await prisma.product.findUnique({ where: { id } })

  if (!product) notFound()

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <Link
          href="/admin/products"
          className="text-xs text-slate-400 hover:text-cyan-400 transition"
        >
          ← Voltar para produtos
        </Link>
        <h1 className="text-2xl font-bold text-slate-100 mt-2">Editar produto</h1>
        <p className="text-xs text-slate-400">{product.title}</p>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl">
        <Product_Form
          key={product.id}
          action={updateProductAction.bind(null, product.id)}
          submitLabel="Salvar alterações"
          defaults={{
            title: product.title,
            slug: product.slug,
            description: product.description,
            category: product.category,
            price: product.price,
            stock: product.stock,
            weightGrams: product.weightGrams,
            dimensions: product.dimensions,
            images: product.images,
            isFeatured: product.isFeatured,
          }}
        />
      </div>
    </div>
  )
}