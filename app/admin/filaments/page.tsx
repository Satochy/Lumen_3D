import { requireAdmin } from '@/lib/auth'
import { getFilaments, createFilament } from '@/app/actions/filaments'
import { CircleDot, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react'

export default async function FilamentsPage() {
  await requireAdmin()

  const result = await getFilaments()
  const filaments = result.success && result.data ? result.data : []

  const totalSpools = filaments.length
  const totalWeightKg = (
    filaments.reduce((acc, f) => acc + f.remainingGrams, 0) / 1000
  ).toFixed(2)
  const lowStockSpools = filaments.filter((f) => f.remainingGrams <= f.minThresholdGrams).length

  return (
    <div className="space-y-8">
      {/* Cards de Métricas de Insumos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-[#090e1d] border border-slate-800">
          <p className="text-xs text-slate-400">Total de Carretéis</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{totalSpools}</p>
        </div>
        <div className="p-4 rounded-2xl bg-[#090e1d] border border-slate-800">
          <p className="text-xs text-slate-400">Massa Total Disponível</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{totalWeightKg} kg</p>
        </div>
        <div className="p-4 rounded-2xl bg-[#090e1d] border border-slate-800">
          <p className="text-xs text-slate-400">Carretéis em Alerta Baixo</p>
          <p
            className={`text-2xl font-bold mt-1 ${
              lowStockSpools > 0 ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {lowStockSpools}
          </p>
        </div>
      </div>

      {/* Formulário de Cadastro */}
      <div className="bg-[#090e1d] border border-slate-800 p-6 rounded-2xl space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
          <Plus className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold text-slate-200">Adicionar Nova Bobina ao Estoque</h2>
        </div>

        <form action={createFilament} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Material (ex: PLA, PETG)</label>
              <input
                type="text"
                name="material"
                required
                placeholder="PLA"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500 uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Nome da Cor</label>
              <input
                type="text"
                name="color"
                required
                placeholder="Preto Fosco"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Código HEX da Cor</label>
              <input
                type="text"
                name="hexColor"
                placeholder="#111111"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Peso Atual (gramas)</label>
              <input
                type="number"
                name="remainingGrams"
                defaultValue="1000"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Alerta Mínimo (gramas)</label>
              <input
                type="number"
                name="minThresholdGrams"
                defaultValue="200"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-md shadow-amber-950/40"
            >
              Cadastrar Bobina
            </button>
          </div>
        </form>
      </div>

      {/* Lista de Filamentos */}
      <div className="bg-[#090e1d] border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="border-b border-slate-800/80 pb-3">
          <h2 className="text-base font-bold text-slate-100">Bobinas Cadastradas</h2>
          <p className="text-xs text-slate-400">Controle de consumo e disponibilidade por carretel</p>
        </div>

        {filaments.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">Nenhum filamento cadastrado no estoque.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase font-bold text-slate-500 tracking-wider border-b border-slate-800/80">
                <tr>
                  <th className="pb-3">Material</th>
                  <th className="pb-3">Cor</th>
                  <th className="pb-3">Peso Restante</th>
                  <th className="pb-3 text-right">Status do Carretel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filaments.map((item) => {
                  const isLow = item.remainingGrams <= item.minThresholdGrams
                  const percentage = Math.min(100, Math.round((item.remainingGrams / (item.spoolWeightKg * 1000)) * 100))

                  return (
                    <tr key={item.id} className="hover:bg-slate-900/40 transition">
                      <td className="py-3 font-bold text-slate-100">{item.material}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          {item.hexColor ? (
                            <span
                              className="w-4 h-4 rounded-full border border-slate-700 shrink-0 shadow-sm"
                              style={{ backgroundColor: item.hexColor }}
                            />
                          ) : (
                            <CircleDot className="w-4 h-4 text-slate-600 shrink-0" />
                          )}
                          <span className="font-medium text-slate-200">{item.color}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="space-y-1">
                          <span className="font-mono font-bold text-slate-200">{item.remainingGrams}g</span>
                          <div className="w-28 bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isLow ? 'bg-rose-500' : 'bg-cyan-400'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        {isLow ? (
                          <span className="px-2.5 py-1 text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Abaixo do Mínimo ({item.minThresholdGrams}g)</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Em Estoque</span>
                          </span>
                        )}
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
