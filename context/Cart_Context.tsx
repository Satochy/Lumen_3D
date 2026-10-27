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
  weightGrams?: number | null
  dimensions?: string | null
  attributes?: Record<string, string>
}

// Estrutura para salvar a opção de frete escolhida
export interface ShippingState {
  serviceId: string
  serviceName: string
  price: number
  isFree?: boolean
  cep: string
}

interface CartContextType {
  cart: CartItem[]
  shipping: ShippingState | null
  addItem: (product: Omit<CartItem, 'quantity'> & { quantity?: number }) => void
  removeItem: (productId: string, variantId?: string) => void
  updateQuantity: (productId: string, variantId: string | undefined, quantity: number) => void
  clearCart: () => void
  setShipping: (shipping: ShippingState | null) => void
  totalAmount: number
  totalItems: number
  finalTotal: number // Subtotal + Frete
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [shipping, setShippingState] = useState<ShippingState | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  // 1. Carrega o carrinho e o frete salvos no browser
  useEffect(() => {
    const savedCart = localStorage.getItem('lumen3d_cart')
    const savedShipping = localStorage.getItem('lumen3d_shipping')
    
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart)
        const migratedCart = parsedCart.map((item: any) => ({
          ...item,
          productId: item.productId || item.id,
        }))
        setCart(migratedCart)
      } catch (e) {
        console.error('Erro ao ler carrinho do localStorage:', e)
      }
    }

    if (savedShipping) {
      try {
        setShippingState(JSON.parse(savedShipping))
      } catch (e) {
         console.error('Erro ao ler frete do localStorage:', e)
      }
    }

    setIsHydrated(true)
  }, [])

  // 2. Persiste alterações no localStorage
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('lumen3d_cart', JSON.stringify(cart))
      if (shipping) {
        localStorage.setItem('lumen3d_shipping', JSON.stringify(shipping))
      } else {
        localStorage.removeItem('lumen3d_shipping')
      }
    }
  }, [cart, shipping, isHydrated])

  const setShipping = (newShipping: ShippingState | null) => {
    setShippingState(newShipping)
  }

  const addItem = (product: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    const qtyToAdd = product.quantity && product.quantity > 0 ? product.quantity : 1
    // Sempre que adicionar um item novo, reseta o frete (pois peso e dimensões mudam)
    setShippingState(null) 

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

  const removeItem = (productId: string, variantId?: string) => {
    setShippingState(null) // Reseta o frete se os itens mudarem
    setCart((prevCart) => 
      prevCart.filter((item) => !(item.productId === productId && item.variantId === variantId))
    )
  }

  const updateQuantity = (productId: string, variantId: string | undefined, quantity: number) => {
    setShippingState(null) // Reseta o frete se a quantidade mudar
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

  const clearCart = () => {
    setCart([])
    setShippingState(null)
  }

  const totalAmount = cart.reduce((acc, item) => acc + item.price * item.quantity, 0)
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0)
  const finalTotal = totalAmount + (shipping?.price || 0)

  return (
    <CartContext.Provider
      value={{
        cart,
        shipping,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        setShipping,
        totalAmount,
        totalItems,
        finalTotal
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