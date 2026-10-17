import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import {
  createProductAction,
  deleteProductAction,
  archiveProductAction,
  restoreProductAction,
} from '@/app/actions/product_actions'
import Product_Form from '@/components/admin/Product_Form'

export default async function AdminProductsPage() {
  // O admin enxerga tudo, inclusive arquivados. _count indica se o produto já foi vendido.
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { orderItems: true } } },
  })

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Painel Admin</h1>
        <p className="text-xs text-slate-400">Cadastro e gerenciamento de produtos</p>
      </div>

      {/* Formulário de Cadastro */}
      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl">
        <h2 className="text-base font-semibold text-slate-200 mb-4">Cadastrar Novo Produto</h2>
        <Product_Form action={createProductAction} submitLabel="Cadastrar Produto" />
      </div>

      {/* Tabela de Gerenciamento de Produtos */}
      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl">
        <h2 className="text-base font-semibold text-slate-200 mb-4">Produtos Cadastrados</h2>
        {products.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum produto cadastrado no momento.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Preço</th>
                  <th className="p-3">Estoque</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {products.map((product) => {
                  const isArchived = product.archivedAt !== null
                  const hasOrders = product._count.orderItems > 0

                  return (
                    <tr
                      key={product.id}
                      className={`hover:bg-slate-800/30 ${isArchived ? 'opacity-60' : ''}`}
                    >
                      <td className="p-3 font-medium text-slate-100">
                        {product.title}
                        {isArchived && (
                          <span className="ml-2 px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                            Arquivado
                          </span>
                        )}
                      </td>
                      <td className="p-3">R$ {product.price.toFixed(2)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] ${product.stock > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                          {product.stock} un
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">{product.category}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/products/${product.id}/edit`}
                            className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-3 py-1 rounded text-xs transition"
                          >
                            Editar
                          </Link>

                          {isArchived ? (
                            <form action={restoreProductAction.bind(null, product.id)}>
                              <button
                                type="submit"
                                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded text-xs transition"
                              >
                                Restaurar
                              </button>
                            </form>
                          ) : (
                            <form action={archiveProductAction.bind(null, product.id)}>
                              <button
                                type="submit"
                                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1 rounded text-xs transition"
                              >
                                Arquivar
                              </button>
                            </form>
                          )}

                          {hasOrders ? (
                            <span
                              title="Produto com pedidos não pode ser excluído. Use Arquivar."
                              className="text-[10px] text-slate-500 px-1"
                            >
                              Com pedidos
                            </span>
                          ) : (
                            <form action={deleteProductAction.bind(null, product.id)}>
                              <button
                                type="submit"
                                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3 py-1 rounded text-xs transition"
                              >
                                Excluir
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}