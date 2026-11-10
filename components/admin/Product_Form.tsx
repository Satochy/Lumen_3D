'use client'

import { startTransition, useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Package,
  Layers,
  Image as ImageIcon,
  Upload,
  Star,
  Trash2,
  AlertCircle,
  Sparkles,
} from 'lucide-react'

type FormState = { error: string } | undefined

export interface ProductFormDefaults {
  title: string
  slug: string
  description: string
  category: string
  price: number
  stock: number
  isMadeToOrder?: boolean
  productionDays?: number | null
  weightGrams: number
  dimensions: string
  images: string[]
  isFeatured: boolean
}

interface ProductFormProps {
  action: (state: FormState, formData: FormData) => Promise<FormState>
  submitLabel: string
  defaults?: ProductFormDefaults
}

const inputCls =
  'w-full bg-[#050811]/60 border border-gray-800/80 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-800/70 transition-colors'
const labelCls = 'block text-xs font-medium text-gray-400 mb-1.5'
const cardCls = 'bg-[#0a0e1a] border border-gray-800/80 rounded-2xl p-6 space-y-4'

export default function Product_Form({ action, submitLabel, defaults }: ProductFormProps) {
  const isEdit = !!defaults
  const [state, formAction, isPending] = useActionState(action, undefined)
  const [existing, setExisting] = useState<string[]>(defaults?.images ?? [])
  const [previews, setPreviews] = useState<string[]>([])
  const [isMadeToOrderChecked, setIsMadeToOrderChecked] = useState<boolean>(
    defaults?.isMadeToOrder ?? false
  )
  const [stockValue, setStockValue] = useState<string>(
    defaults?.stock !== undefined ? String(defaults.stock) : '0'
  )
  const [productionDaysValue, setProductionDaysValue] = useState<string>(
    defaults?.productionDays !== undefined && defaults?.productionDays !== null
      ? String(defaults.productionDays)
      : ''
  )

  // Libera as URLs temporárias de preview quando a seleção muda ou o form desmonta
  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url))
  }, [previews])

  // Envio manual com sanitização programática dos campos incompatíveis antes do submit
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    if (isMadeToOrderChecked) {
      formData.set('isMadeToOrder', 'true')
      formData.set('stock', '0')
    } else {
      formData.set('isMadeToOrder', 'false')
      formData.set('productionDays', '')
    }

    startTransition(() => formAction(formData))
  }

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    setPreviews(files.map((file) => URL.createObjectURL(file)))
  }

  const makeMain = (url: string) =>
    setExisting((prev) => [url, ...prev.filter((u) => u !== url)])
  const removeExisting = (url: string) =>
    setExisting((prev) => prev.filter((u) => u !== url))

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Cabeçalho alinhado à esquerda */}
      <div className="text-left">
        <h2 className="text-xl font-bold text-slate-100 tracking-tight">
          {isEdit ? 'Editar Produto' : 'Novo Produto'}
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          {isEdit
            ? 'Atualize as informações, modalidade de produção, estoque e fotos da peça no catálogo.'
            : 'Preencha os dados básicos, modalidade de fabricação e fotos para disponibilizar a peça no catálogo.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Informações Básicas */}
        <div className={cardCls}>
          <div className="flex items-center gap-2 border-b border-gray-800/80 pb-3">
            <Package className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-gray-200">Informações Básicas</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="prod-title" className={labelCls}>
                Nome do Produto
              </label>
              <input
                id="prod-title"
                name="title"
                required
                defaultValue={defaults?.title}
                placeholder="Ex: Vaso Poligonal 20cm"
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="prod-slug" className={labelCls}>
                Slug (URL Amigável)
              </label>
              {isEdit ? (
                <>
                  <input
                    id="prod-slug"
                    value={defaults.slug}
                    disabled
                    readOnly
                    className={`${inputCls} opacity-60 cursor-not-allowed`}
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    O slug não muda ao editar, para não quebrar links já compartilhados.
                  </p>
                </>
              ) : (
                <>
                  <input
                    id="prod-slug"
                    name="slug"
                    placeholder="Deixe vazio para gerar pelo título"
                    className={inputCls}
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Letras minúsculas, números e hífens. Acentos são removidos automaticamente.
                  </p>
                </>
              )}
            </div>

            <div>
              <label htmlFor="prod-category" className={labelCls}>
                Categoria
              </label>
              <input
                id="prod-category"
                name="category"
                defaultValue={defaults?.category}
                placeholder="Ex: Decoração, Action Figure"
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="prod-price" className={labelCls}>
                Preço (R$)
              </label>
              <input
                id="prod-price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={defaults?.price}
                placeholder="89.90"
                className={inputCls}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-gray-800/60">
            <label
              htmlFor="isFeatured"
              className="inline-flex items-center gap-2.5 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                id="isFeatured"
                name="isFeatured"
                defaultChecked={defaults?.isFeatured}
                className="w-4 h-4 rounded bg-[#050811]/60 border-gray-800 text-cyan-500 focus:ring-0 cursor-pointer"
              />
              <span className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Destacar produto na página principal do Marketplace</span>
              </span>
            </label>
          </div>
        </div>

        {/* Card 2: Modalidade e Estoque (Renderização Condicional Rígida) */}
        <div className={cardCls}>
          <div className="flex items-center gap-2 border-b border-gray-800/80 pb-3">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-gray-200">Modalidade e Estoque</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="prod-modality" className={labelCls}>
                Modalidade de Fabricação
              </label>
              <input
                type="hidden"
                name="isMadeToOrder"
                value={isMadeToOrderChecked ? 'true' : 'false'}
              />
              <select
                id="prod-modality"
                value={isMadeToOrderChecked ? 'made_to_order' : 'ready_stock'}
                onChange={(e) => {
                  const nextIsMadeToOrder = e.target.value === 'made_to_order'
                  setIsMadeToOrderChecked(nextIsMadeToOrder)
                  if (nextIsMadeToOrder) {
                    setStockValue('0')
                  } else {
                    setProductionDaysValue('')
                  }
                }}
                className={`${inputCls} cursor-pointer`}
              >
                <option value="ready_stock" className="bg-[#0a0e1a] text-gray-200">
                  Pronta Entrega (Estoque Físico)
                </option>
                <option value="made_to_order" className="bg-[#0a0e1a] text-gray-200">
                  Sob Encomenda (Fila de Produção)
                </option>
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                {isMadeToOrderChecked
                  ? 'Não exige saldo físico imediato e entra na fila de impressão após pagamento.'
                  : 'Baixa automática no saldo físico após confirmação de pagamento.'}
              </p>
            </div>

            {!isMadeToOrderChecked ? (
              <div>
                <input type="hidden" name="productionDays" value="" />
                <label htmlFor="prod-stock" className={labelCls}>
                  {isEdit ? 'Quantidade em Estoque' : 'Estoque Inicial'}
                </label>
                <input
                  id="prod-stock"
                  name="stock"
                  type="number"
                  min="0"
                  required
                  value={stockValue}
                  onChange={(e) => setStockValue(e.target.value)}
                  placeholder="10"
                  className={inputCls}
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Unidades físicas prontas disponíveis imediatamente para envio.
                </p>
              </div>
            ) : (
              <div>
                <input type="hidden" name="stock" value="0" />
                <label htmlFor="prod-days" className={labelCls}>
                  Prazo de Produção (Dias úteis) *
                </label>
                <input
                  id="prod-days"
                  name="productionDays"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={productionDaysValue}
                  onChange={(e) => setProductionDaysValue(e.target.value)}
                  placeholder="Ex: 5"
                  className={inputCls}
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Tempo estimado de fabricação na oficina antes da expedição.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-800/60">
            <div>
              <label htmlFor="prod-weight" className={labelCls}>
                Peso Estimado (Gramas)
              </label>
              <input
                id="prod-weight"
                name="weightGrams"
                type="number"
                min="0"
                defaultValue={defaults?.weightGrams ?? undefined}
                placeholder="250"
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="prod-dimensions" className={labelCls}>
                Dimensões da Embalagem / Peça (Ex: 10x10x20 cm)
              </label>
              <input
                id="prod-dimensions"
                name="dimensions"
                defaultValue={defaults?.dimensions ?? ''}
                placeholder="10x10x20 cm"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Mídia e Descrição */}
        <div className={cardCls}>
          <div className="flex items-center gap-2 border-b border-gray-800/80 pb-3">
            <ImageIcon className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-gray-200">Mídia e Descrição</h3>
          </div>

          <div>
            <label htmlFor="prod-desc" className={labelCls}>
              Descrição do Produto
            </label>
            <textarea
              id="prod-desc"
              name="description"
              rows={4}
              defaultValue={defaults?.description}
              placeholder="Descreva os detalhes da peça, acabamento, material utilizado e recomendações..."
              className={`${inputCls} resize-y`}
            />
          </div>

          <div className="space-y-3 pt-2">
            <label className={labelCls}>Upload de Imagens</label>

            {existing.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {existing.map((url, index) => (
                  <div
                    key={url}
                    className="relative bg-[#050811]/80 border border-gray-800/80 rounded-xl overflow-hidden group"
                  >
                    <input type="hidden" name="existingImages" value={url} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="w-full aspect-square object-cover"
                    />
                    {index === 0 && (
                      <span className="absolute top-2 left-2 bg-cyan-500 text-[#050811] text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 fill-current" />
                        <span>Principal</span>
                      </span>
                    )}
                    <div className="flex gap-1.5 p-2 bg-[#0a0e1a]/95 border-t border-gray-800/80">
                      {index !== 0 && (
                        <button
                          type="button"
                          onClick={() => makeMain(url)}
                          className="flex-1 text-[10px] font-medium bg-[#050811] hover:bg-gray-900 border border-gray-800 text-gray-300 rounded-lg px-2 py-1 transition cursor-pointer"
                        >
                          Principal
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeExisting(url)}
                        className="flex-1 text-[10px] font-medium bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-lg px-2 py-1 transition inline-flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remover</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-[#050811]/60 border border-dashed border-gray-800 hover:border-cyan-800/70 rounded-xl p-4 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-200">
                      Selecionar arquivos de imagem
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Até 6 fotos por produto, máx. 5 MB cada (JPG, PNG ou WebP). A primeira é a capa.
                      {isEdit && ' Novas fotos entram após as atuais.'}
                    </p>
                  </div>
                </div>

                <input
                  type="file"
                  name="newImages"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePick}
                  aria-label="Upload de fotos do produto"
                  className="block text-xs text-gray-300 file:mr-3 file:rounded-xl file:border-0 file:bg-cyan-500/15 file:border file:border-cyan-500/30 file:px-3.5 file:py-2 file:text-xs file:font-semibold file:text-cyan-300 hover:file:bg-cyan-500/25 file:transition file:cursor-pointer"
                />
              </div>
            </div>

            {previews.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
                {previews.map((url) => (
                  <div
                    key={url}
                    className="relative bg-[#050811] border border-cyan-500/30 rounded-xl overflow-hidden"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="w-full aspect-square object-cover"
                    />
                    <span className="absolute top-2 left-2 bg-[#050811]/90 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold px-2 py-0.5 rounded-md">
                      Nova
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Alerta de erro de validação */}
        {state?.error && (
          <div className="flex items-center gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        {/* Barra de Ações no final do formulário */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {isEdit && (
            <Link
              href="/admin/products"
              className="px-5 py-2.5 bg-transparent hover:bg-white/5 border border-gray-800 text-gray-300 hover:text-white rounded-xl text-sm font-medium transition-colors"
            >
              Cancelar
            </Link>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 disabled:cursor-wait text-[#050811] font-bold px-6 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-cyan-500/10 cursor-pointer"
          >
            {isPending ? 'Salvando...' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
