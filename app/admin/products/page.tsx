import { prisma } from '@/lib/prisma'
import { createProductAction, deleteProductAction } from '@/app/actions/product_actions'

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
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
        <form action={createProductAction} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Título do Produto</label>
              <input
                name="title"
                required
                placeholder="Ex: Vaso Poligonal 20cm"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Slug (URL Amigável)</label>
              <input
                name="slug"
                required
                placeholder="ex: vaso-poligonal-20cm"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Preço (R$)</label>
              <input
                name="price"
                type="number"
                step="0.01"
                required
                placeholder="89.90"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Estoque Inicial</label>
              <input
                name="stock"
                type="number"
                required
                placeholder="10"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Peso (Gramas)</label>
              <input
                name="weightGrams"
                type="number"
                placeholder="250"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Descrição</label>
              <input
                name="description"
                placeholder="Descrição resumida do produto"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Categoria</label>
              <input
                name="category"
                placeholder="Ex: Decoração, Action Figure"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Dimensões (Ex: 10x10x20 cm)</label>
              <input
                name="dimensions"
                placeholder="10x10x20 cm"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">URLs das Imagens (Separadas por vírgula)</label>
              <input
                name="images"
                placeholder="/vaso-1.jpg, /vaso-2.jpg"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isFeatured"
              name="isFeatured"
              className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0"
            />
            <label htmlFor="isFeatured" className="text-xs text-slate-300">
              Destacar produto na página principal do Marketplace
            </label>
          </div>

          <button
            type="submit"
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold py-2.5 rounded-lg text-sm transition mt-4"
          >
            Cadastrar Produto
          </button>
        </form>
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
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-800/30">
                    <td className="p-3 font-medium text-slate-100">{product.title}</td>
                    <td className="p-3">R$ {product.price.toFixed(2)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] ${product.stock > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                        {product.stock} un
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">{product.category}</td>
                    <td className="p-3 text-right">
                      <form action={deleteProductAction.bind(null, product.id)}>
                        <button
                          type="submit"
                          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3 py-1 rounded text-xs transition"
                        >
                          Excluir
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}