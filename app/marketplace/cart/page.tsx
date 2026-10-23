'use client'

import { Header, Footer } from '@/components/layout'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/context/Cart_Context'
import { Trash2, Minus, Plus, ArrowRight, ShoppingBag } from 'lucide-react'

export default function CartPage() {

  const { cart, updateQuantity, removeItem, totalAmount, totalItems } = useCart()

  // Formatação provisória de moeda (até integrarmos o format_currency global aqui)
  const formatBRL = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  if (cart.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
        <div className="w-20 h-20 bg-cyan-950/30 rounded-full flex items-center justify-center mb-6">
          <ShoppingBag className="w-10 h-10 text-cyan-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Seu carrinho está vazio</h1>
        <p className="text-slate-400 mb-8 max-w-md">
          Você ainda não adicionou nenhuma peça 3D ao seu carrinho. Explore nosso catálogo para encontrar produtos incríveis.
        </p>
        <Link
          href="/marketplace"
          className="btn-fx px-6 py-3 bg-cyan-500 text-slate-950 font-bold rounded-xl hover:bg-cyan-400 transition"
        >
          Explorar Produtos
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      <Header logoHref="/">
      <nav className="hidden md:flex items-center gap-8 text-xs font-medium tracking-wider text-slate-400 uppercase">
        <div className="flex items-center justify-center gap-4 text-sm font-bold">
          <span className="text-cyan-400 border-b-2 border-cyan-400 pb-1">Carrinho</span>
          <span className="text-slate-700">---------</span>
          <span className="text-slate-500">Entrega</span>
          <span className="text-slate-700">---------</span>
          <span className="text-slate-500">Pagamento</span>
        </div>
      </nav>
      </Header>

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="text-3xl font-bold text-white mb-8">Meu Carrinho</h1>

          <div className="grid lg:grid-cols-12 gap-10">

            {/* Coluna da Esquerda: Lista de Produtos */}
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-slate-200 mb-6 border-b border-slate-800/80 pb-4">
                  Itens ({totalItems})
                </h2>

                <div className="space-y-6">
                  {cart.map((item) => (
                    <div
                      key={`${item.productId}-${item.variantId || 'base'}`}
                      className="flex flex-col sm:flex-row gap-6 pb-6 border-b border-slate-800/50 last:border-0 last:pb-0"
                    >
                      {/* Imagem */}
                      <div className="relative w-24 h-24 bg-slate-950 rounded-xl overflow-hidden shrink-0 border border-slate-800">
                        <Image
                          src={item.image}
                          alt={item.title}
                          fill
                          className="object-cover"
                        />
                      </div>

                      {/* Informações do Produto */}
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="text-base font-bold text-white line-clamp-1">{item.title}</h3>

                          {/* Renderização de Atributos da Variante (se existirem) */}
                          {item.attributes && (
                            <div className="text-xs text-slate-400 mt-1 flex gap-2">
                              {Object.entries(item.attributes).map(([key, val]) => (
                                <span key={key} className="bg-slate-800/50 px-2 py-0.5 rounded">
                                  {val}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-4">
                          <span className="text-lg font-black text-cyan-400">
                            {formatBRL(item.price)}
                          </span>

                          {/* Controles de Quantidade e Remoção */}
                          <div className="flex items-center gap-4">
                            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                              <button
                                onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="w-10 text-center text-sm font-bold text-white">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>

                            <button
                              onClick={() => removeItem(item.productId, item.variantId)}
                              className="p-2 text-rose-500/70 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                              title="Remover item"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Coluna da Direita: Resumo do Pedido */}
            <div className="lg:col-span-4 space-y-6">
              {/* Resumo Financeiro */}
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-slate-200 mb-6 border-b border-slate-800/80 pb-4">
                  Resumo do Pedido
                </h3>

                <div className="space-y-4 text-sm mb-6">
                  <div className="flex justify-between text-slate-300">
                    <span>Subtotal ({totalItems} itens)</span>
                    <span className="font-semibold text-white">{formatBRL(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Frete</span>
                    <span className="text-xs italic">Calculado na próxima etapa</span>
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-slate-800/80 pt-4 mb-6">
                  <span className="text-base font-bold text-white">Total Previsto</span>
                  <span className="text-xl font-black text-cyan-400">{formatBRL(totalAmount)}</span>
                </div>

                <Link
                  href="/marketplace/checkout"
                  className="btn-fx w-full py-4 bg-cyan-500 text-slate-950 font-bold rounded-xl hover:bg-cyan-400 transition flex items-center justify-center gap-2"
                >
                  Continuar para Checkout
                  <ArrowRight className="w-5 h-5" />
                </Link>

                <div className="mt-4 flex flex-col gap-2 text-xs text-slate-500 text-center">
                  <p>Compra 100% segura.</p>
                  <p>O frete e o endereço serão confirmados na próxima etapa.</p>
                </div>
              </div>

            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}