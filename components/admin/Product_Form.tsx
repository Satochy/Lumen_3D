'use client'

import { startTransition, useActionState, useEffect, useState } from 'react'
import Link from 'next/link'

type FormState = { error: string } | undefined

export interface ProductFormDefaults {
  title: string
  slug: string
  description: string
  category: string
  price: number
  stock: number
  weightGrams: number | null
  dimensions: string | null
  images: string[]
  isFeatured: boolean
}

interface ProductFormProps {
  action: (state: FormState, formData: FormData) => Promise<FormState>
  submitLabel: string
  defaults?: ProductFormDefaults
}

const inputCls =
  'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500'
const labelCls = 'block text-xs text-slate-300 mb-1'

export default function Product_Form({ action, submitLabel, defaults }: ProductFormProps) {
  const isEdit = !!defaults
  const [state, formAction, isPending] = useActionState(action, undefined)
  const [existing, setExisting] = useState<string[]>(defaults?.images ?? [])
  const [previews, setPreviews] = useState<string[]>([])

  // Libera as URLs temporárias de preview quando a seleção muda ou o form desmonta
  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url))
  }, [previews])

  // Envio manual: com <form action> o React 19 limparia os campos (e as fotos
  // escolhidas) quando a action devolve um erro de validação.
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Título do Produto</label>
          <input
            name="title"
            required
            defaultValue={defaults?.title}
            placeholder="Ex: Vaso Poligonal 20cm"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Slug (URL Amigável)</label>
          {isEdit ? (
            <>
              <input value={defaults.slug} disabled readOnly className={`${inputCls} opacity-60`} />
              <p className="text-[10px] text-slate-500 mt-1">
                O slug não muda ao editar, para não quebrar links já compartilhados.
              </p>
            </>
          ) : (
            <>
              <input name="slug" placeholder="Deixe vazio para gerar pelo título" className={inputCls} />
              <p className="text-[10px] text-slate-500 mt-1">
                Letras minúsculas, números e hífens. Acentos são removidos automaticamente.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Preço (R$)</label>
          <input
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
        <div>
          <label className={labelCls}>{isEdit ? 'Estoque' : 'Estoque Inicial'}</label>
          <input
            name="stock"
            type="number"
            min="0"
            required
            defaultValue={defaults?.stock}
            placeholder="10"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Peso (Gramas)</label>
          <input
            name="weightGrams"
            type="number"
            min="0"
            defaultValue={defaults?.weightGrams ?? undefined}
            placeholder="250"
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Descrição</label>
          <input
            name="description"
            defaultValue={defaults?.description}
            placeholder="Descrição resumida do produto"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Categoria</label>
          <input
            name="category"
            defaultValue={defaults?.category}
            placeholder="Ex: Decoração, Action Figure"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Dimensões (Ex: 10x10x20 cm)</label>
        <input
          name="dimensions"
          defaultValue={defaults?.dimensions ?? ''}
          placeholder="10x10x20 cm"
          className={inputCls}
        />
      </div>

      {/* Fotos */}
      <div className="space-y-3">
        <label className={labelCls}>Fotos do produto</label>

        {existing.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {existing.map((url, index) => (
              <div
                key={url}
                className="relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden"
              >
                <input type="hidden" name="existingImages" value={url} />
                <img src={url} alt="" className="w-full aspect-square object-cover" />
                {index === 0 && (
                  <span className="absolute top-2 left-2 bg-cyan-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded">
                    Principal
                  </span>
                )}
                <div className="flex gap-1 p-2">
                  {index !== 0 && (
                    <button
                      type="button"
                      onClick={() => makeMain(url)}
                      className="flex-1 text-[10px] bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded px-1 py-1 transition"
                    >
                      Tornar principal
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeExisting(url)}
                    className="flex-1 text-[10px] bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded px-1 py-1 transition"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <input
          type="file"
          name="newImages"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePick}
          className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-950 hover:file:bg-cyan-400"
        />
        <p className="text-[10px] text-slate-500">
          Até 6 fotos por produto, 5 MB cada (JPG, PNG ou WebP). A primeira é a foto principal.
          {isEdit && ' As novas fotos entram depois das atuais.'}
        </p>

        {previews.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {previews.map((url) => (
              <div
                key={url}
                className="relative bg-slate-950 border border-cyan-500/30 rounded-xl overflow-hidden"
              >
                <img src={url} alt="" className="w-full aspect-square object-cover" />
                <span className="absolute top-2 left-2 bg-slate-950/80 text-cyan-400 text-[10px] font-bold px-2 py-0.5 rounded">
                  Nova
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2">
        <input
          type="checkbox"
          id="isFeatured"
          name="isFeatured"
          defaultChecked={defaults?.isFeatured}
          className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0"
        />
        <label htmlFor="isFeatured" className="text-xs text-slate-300">
          Destacar produto na página principal do Marketplace
        </label>
      </div>

      {state?.error && (
        <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="flex gap-3 mt-4">
        {isEdit && (
          <Link
            href="/admin/products"
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-sm transition"
          >
            Cancelar
          </Link>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 disabled:cursor-wait text-slate-950 font-semibold py-2.5 rounded-lg text-sm transition"
        >
          {isPending ? 'Salvando...' : submitLabel}
        </button>
      </div>
    </form>
  )
}