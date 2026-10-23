'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export interface CartItem {
  productId: string
  variantId?: string
  title: string
  slug: string
  price: number
  image: string
  quantity: number
  stock?: number
  /** Peso unitário em gramas, usado no cálculo de frete */
  weightGrams?: number | null
  /** Dimensões unitárias (ex.: "10x10x20 cm"), usadas no cálculo de frete */
  dimensions?: string | null
  /** Atributos da variante selecionada, ex: { color: "red", size: "xl" } */
  attributes?: Record<string, string>
}

interface CartContextType {
  cart: CartItem[]
  addItem: (product: Omit<CartItem, 'quantity'> & { quantity?: number }) => void
  removeItem: (productId: string, variantId?: string) => void
  updateQuantity: (productId: string, variantId: string | undefined, quantity: number) => void
  clearCart: () => void
  totalAmount: number
  totalItems: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [isHydrated, setIsHydrated] = useState(false)

  // 1. Carrega o carrinho salvo no browser ao inicializar
  useEffect(() => {
    const saved = localStorage.getItem('lumen3d_cart')
    if (saved) {
      try {
        const parsedCart = JSON.parse(saved)
        // Migração silenciosa caso existam itens legados no localStorage (apenas com 'id')
        const migratedCart = parsedCart.map((item: any) => ({
          ...item,
          productId: item.productId || item.id,
        }))
        setCart(migratedCart)
      } catch (e) {
        console.error('Erro ao ler carrinho do localStorage:', e)
      }
    }
    setIsHydrated(true)
  }, [])

  // 2. Persiste alterações no localStorage após a hidratação inicial
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('lumen3d_cart', JSON.stringify(cart))
    }
  }, [cart, isHydrated])

  // Lógica: Adicionar item separando corretamente por Produto + Variante
  const addItem = (product: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    const qtyToAdd = product.quantity && product.quantity > 0 ? product.quantity : 1

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex(
        (item) => item.productId === product.productId && item.variantId === product.variantId
      )

      if (existingIndex > -1) {
        const updated = [...prevCart]
        const currentItem = updated[existingIndex]
        const maxStock = currentItem.stock ?? Infinity

        updated[existingIndex] = {
          ...currentItem,
          quantity: Math.min(currentItem.quantity + qtyToAdd, maxStock),
        }
        return updated
      }

      return [...prevCart, { ...product, quantity: qtyToAdd }]
    })
  }

  // Lógica: Remover item exato (Produto + Variante)
  const removeItem = (productId: string, variantId?: string) => {
    setCart((prevCart) => 
      prevCart.filter((item) => !(item.productId === productId && item.variantId === variantId))
    )
  }

  // Lógica: Atualizar quantidade diretamente (remover se for <= 0)
  const updateQuantity = (productId: string, variantId: string | undefined, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId, variantId)
      return
    }

    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.productId === productId && item.variantId === variantId) {
          const maxStock = item.stock ?? Infinity
          return { ...item, quantity: Math.min(quantity, maxStock) }
        }
        return item
      })
    )
  }

  const clearCart = () => setCart([])

  // Cálculos derivados dinâmicos
  const totalAmount = cart.reduce((acc, item) => acc + item.price * item.quantity, 0)
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        cart,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalAmount,
        totalItems,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart deve ser utilizado dentro de um CartProvider')
  }
  return context
}