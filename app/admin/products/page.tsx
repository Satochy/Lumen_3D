import { getProducts, createProduct } from '@/app/actions/products'

export default async function ProductsPage() {
  const result = await getProducts()
  const products = result.success ? result.data : []

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Gerenciamento de Produtos</h1>

      {/* Formulário Simples */}
      <form action={createProduct} className="p-4 border border-slate-800 rounded space-y-3 bg-slate-900">
        <h2 className="text-sm font-semibold">Novo Produto</h2>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <input name="title" placeholder="Título" required className="p-2 bg-slate-950 border border-slate-800 rounded" />
          <input name="slug" placeholder="Slug (ex: vaso-geométrico)" required className="p-2 bg-slate-950 border border-slate-800 rounded" />
          <input name="price" type="number" step="0.01" placeholder="Preço (R$)" required className="p-2 bg-slate-950 border border-slate-800 rounded" />
          <input name="stock" type="number" placeholder="Estoque Inicial" required className="p-2 bg-slate-950 border border-slate-800 rounded" />
        </div>
        <textarea name="description" placeholder="Descrição do produto" className="w-full p-2 text-xs bg-slate-950 border border-slate-800 rounded" />
        <button type="submit" className="px-3 py-1.5 bg-amber-600 text-xs font-bold rounded">Salvar Produto</button>
      </form>

      {/* Tabela Simples */}
      <table className="w-full text-left text-xs">
        <thead className="border-b border-slate-800 text-slate-400">
          <tr>
            <th className="p-2">Título</th>
            <th className="p-2">Preço</th>
            <th className="p-2">Estoque</th>
          </tr>
        </thead>
        <tbody>
          {products?.map((p) => (
            <tr key={p.id} className="border-b border-slate-800/50">
              <td className="p-2 font-medium">{p.title}</td>
              <td className="p-2">R$ {p.price.toFixed(2)}</td>
              <td className="p-2">{p.stock} un.</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}