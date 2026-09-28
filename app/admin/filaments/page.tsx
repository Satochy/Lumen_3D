import { getFilaments, createFilament } from '@/app/actions/filaments'

export default async function FilamentsPage() {
  const result = await getFilaments()
  const filaments = result.success ? result.data : []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Gestão de Filamentos</h1>
        <p className="text-slate-400 text-sm">Controle de peso e alerta de nível mínimo de bobinas.</p>
      </div>

      {/* Formulário de Cadastro */}
      <form action={createFilament} className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
        <h3 className="text-lg font-semibold">Adicionar Nova Bobina</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Material (ex: PLA, PETG)</label>
            <input
              type="text"
              name="material"
              required
              placeholder="PLA"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Nome da Cor</label>
            <input
              type="text"
              name="color"
              required
              placeholder="Preto Fosco"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Código HEX da Cor</label>
            <input
              type="text"
              name="hexColor"
              placeholder="#000000"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Peso Atual (gramas)</label>
            <input
              type="number"
              name="remainingGrams"
              defaultValue="1000"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Alerta Mínimo (gramas)</label>
            <input
              type="number"
              name="minThresholdGrams"
              defaultValue="200"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-amber-500 text-slate-950 font-medium text-sm rounded-lg hover:bg-amber-400 transition"
        >
          Cadastrar Insumo
        </button>
      </form>

      {/* Lista de Filamentos */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="p-4">Material</th>
              <th className="p-4">Cor</th>
              <th className="p-4">Peso Restante</th>
              <th className="p-4">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filaments?.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-slate-500">
                  Nenhum filamento cadastrado no estoque.
                </td>
              </tr>
            ) : (
              filaments?.map((item) => {
                const isLow = item.remainingGrams <= item.minThresholdGrams
                return (
                  <tr key={item.id} className="hover:bg-slate-800/50">
                    <td className="p-4 font-medium">{item.material}</td>
                    <td className="p-4 flex items-center gap-2">
                      {item.hexColor && (
                        <span
                          className="w-4 h-4 rounded-full border border-slate-700"
                          style={{ backgroundColor: item.hexColor }}
                        />
                      )}
                      {item.color}
                    </td>
                    <td className="p-4">{item.remainingGrams}g</td>
                    <td className="p-4">
                      {isLow ? (
                        <span className="px-2 py-1 text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 rounded-md">
                          Estoque Baixo
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
                          Em Estoque
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}