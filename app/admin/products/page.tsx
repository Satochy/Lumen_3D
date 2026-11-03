import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/format_currency'
import {
  createProductAction,
  deleteProductAction,
  archiveProductAction,
  restoreProductAction,
} from '@/app/actions/product_actions'
import Product_Form from '@/components/admin/Product_Form'
import { Package, Clock, ExternalLink, Plus } from 'lucide-react'

export default async function AdminProductsPage() {
  await requireAdmin()

  // O admin enxerga todos os produtos, inclusive arquivados.
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { orderItems: true } } },
  })

  const totalCount = products.length
  const activeCount = products.filter((p) => p.archivedAt === null).length
  const madeToOrderCount = products.filter((p) => p.isMadeToOrder && p.archivedAt === null).length
  const archivedCount = products.filter((p) => p.archivedAt !== null).length

  return (
    <div className="space-y-8">
      {/* Cards de Resumo do Catálogo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#090e1d] border border-slate-800">
          <p className="text-xs text-slate-400">Total Cadastrados</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{totalCount}</p>
        </div>
        <div className="p-4 rounded-2xl bg-[#090e1d] border border-slate-800">
          <p className="text-xs text-slate-400">Ativos na Vitrine</p>
          <p className="text-2xl font-bold text-cyan-400 mt-1">{activeCount}</p>
        </div>
        <div className="p-4 rounded-2xl bg-[#090e1d] border border-slate-800">
          <p className="text-xs text-slate-400">Sob Encomenda</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{madeToOrderCount}</p>
        </div>
        <div className="p-4 rounded-2xl bg-[#090e1d] border border-slate-800">
          <p className="text-xs text-slate-400">Arquivados</p>
          <p className="text-2xl font-bold text-slate-400 mt-1">{archivedCount}</p>
        </div>
      </div>

      {/* Formulário de Cadastro */}
      <div className="bg-[#090e1d] border border-slate-800 p-6 rounded-2xl space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
          <Plus className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-slate-200">Cadastrar Novo Produto</h2>
        </div>
        <Product_Form action={createProductAction} submitLabel="Cadastrar Produto no Catálogo" />
      </div>

      {/* Tabela de Gerenciamento de Produtos */}
      <div className="bg-[#090e1d] border border-slate-800 p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-100">Produtos no Inventário</h2>
            <p className="text-xs text-slate-400">Gerencie preços, prazos sob encomenda, saldos e arquivamento</p>
          </div>
        </div>

        {products.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">Nenhum produto cadastrado no momento.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-800/80 font-bold">
                <tr>
                  <th className="p-3">Item</th>
                  <th className="p-3">Preço</th>
                  <th className="p-3">Tipo / Estoque</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {products.map((product) => {
                  const isArchived = product.archivedAt !== null
                  const hasOrders = product._count.orderItems > 0
                  const availableStock = Math.max(0, product.stock - (product.reservedStock ?? 0))

                  return (
                    <tr
                      key={product.id}
                      className={`hover:bg-slate-900/40 transition ${isArchived ? 'opacity-60' : ''}`}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          {product.images?.[0] ? (
                            <img
                              src={product.images[0]}
                              alt={product.title}
                              className="w-10 h-10 rounded-lg object-cover border border-slate-800"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <span className="font-semibold text-slate-100 block">{product.title}</span>
                            <span className="text-[10px] font-mono text-slate-500">/{product.slug}</span>
                            {isArchived && (
                              <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-slate-400 border border-slate-700">
                                Arquivado
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-3 font-mono font-bold text-slate-200">
                        {formatCurrency(product.price.toNumber())}
                      </td>

                      <td className="p-3">
                        {product.isMadeToOrder ? (
                          <div className="space-y-0.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              <span>Sob Encomenda</span>
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              Preparo: {product.productionDays ? `${product.productionDays} dias` : 'Sob demanda'}
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                availableStock > 0
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              }`}
                            >
                              {availableStock} un disponível
                            </span>
                            {product.reservedStock > 0 && (
                              <span className="text-[10px] text-amber-400/80 block font-mono">
                                ({product.reservedStock} reservada{product.reservedStock > 1 ? 's' : ''})
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="p-3 text-slate-400">{product.category}</td>

                      <td className="p-3">
                        <div className="flex items-center justify-end gap-2">
                          {!isArchived && (
                            <Link
                              href={`/marketplace/${product.slug}`}
                              target="_blank"
                              className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded-lg text-xs transition"
                              title="Visualizar na loja pública"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          )}

                          <Link
                            href={`/admin/products/${product.id}/edit`}
                            className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-3 py-1 rounded-lg text-xs font-semibold transition"
                          >
                            Editar
                          </Link>

                          {isArchived ? (
                            <form action={restoreProductAction.bind(null, product.id)}>
                              <button
                                type="submit"
                                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-lg text-xs font-semibold transition"
                              >
                                Restaurar
                              </button>
                            </form>
                          ) : (
                            <form action={archiveProductAction.bind(null, product.id)}>
                              <button
                                type="submit"
                                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-lg text-xs font-semibold transition"
                              >
                                Arquivar
                              </button>
                            </form>
                          )}

                          {hasOrders ? (
                            <span
                              title="Produto com pedidos não pode ser excluído. Use Arquivar."
                              className="text-[10px] text-slate-500 px-1 font-mono"
                            >
                              (Vendido)
                            </span>
                          ) : (
                            <form action={deleteProductAction.bind(null, product.id)}>
                              <button
                                type="submit"
                                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3 py-1 rounded-lg text-xs font-semibold transition"
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
