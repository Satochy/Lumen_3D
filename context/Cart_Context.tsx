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
  reservedStock?: number
  isMadeToOrder?: boolean
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

const DEFAULT_MAX_MTO_QUANTITY = 999

function getMaxMtoQuantity(): number {
  const raw = process.env.NEXT_PUBLIC_MAX_MTO_QUANTITY
  if (!raw) return DEFAULT_MAX_MTO_QUANTITY
  const parsed = Number(raw)
  if (Number.isSafeInteger(parsed) && parsed >= 1) {
    return parsed
  }
  return DEFAULT_MAX_MTO_QUANTITY
}

function getAvailableReadyStock(stock?: number, reservedStock?: number): number {
  if (stock === undefined || !Number.isFinite(stock)) {
    return getMaxMtoQuantity()
  }
  const reserved = reservedStock !== undefined && Number.isFinite(reservedStock) ? reservedStock : 0
  return Math.max(0, Math.trunc(stock) - Math.trunc(reserved))
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
        const parsedCart = JSON.parse(savedCart) as unknown
        if (Array.isArray(parsedCart)) {
          const maxMto = getMaxMtoQuantity()
          const migratedCart: CartItem[] = parsedCart
            .map((rawItem: unknown) => {
              const item = (rawItem ?? {}) as Record<string, unknown>
              const rawQty = Number(item.quantity ?? 1)
              const safeQty =
                Number.isSafeInteger(rawQty) && rawQty >= 1
                  ? Math.min(rawQty, maxMto)
                  : 1
              return {
                ...(item as unknown as CartItem),
                productId: String(item.productId || item.id || ''),
                quantity: safeQty,
              }
            })
            .filter((item) => item.productId.length > 0 && item.quantity >= 1)
          // Hidratação segura pós-SSR a partir do localStorage
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setCart(migratedCart)
        }
      } catch (e) {
        console.error('Erro ao ler carrinho do localStorage:', e)
      }
    }

    if (savedShipping) {
      try {
        setShippingState(JSON.parse(savedShipping) as ShippingState)
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
    const rawQty = product.quantity ?? 1
    if (!Number.isSafeInteger(rawQty) || rawQty < 1) {
      return
    }
    const qtyToAdd = rawQty
    const isMadeToOrder = Boolean(product.isMadeToOrder)
    const maxMto = getMaxMtoQuantity()

    // Bloqueia adição de item de Pronta Entrega sem estoque vendável disponível (stock - reservedStock)
    if (!isMadeToOrder && product.stock !== undefined) {
      const available = getAvailableReadyStock(product.stock, product.reservedStock)
      if (available <= 0) {
        return
      }
    }

    // Sempre que adicionar um item novo, reseta o frete (pois peso e dimensões mudam)
    setShippingState(null)

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex(
        (item) => item.productId === product.productId && item.variantId === product.variantId
      )

      if (existingIndex > -1) {
        const updated = [...prevCart]
        const currentItem = updated[existingIndex]
        const itemIsMadeToOrder = Boolean(product.isMadeToOrder ?? currentItem.isMadeToOrder)
        const resolvedStock = product.stock ?? currentItem.stock
        const resolvedReservedStock = product.reservedStock ?? currentItem.reservedStock
        const maxAllowed = itemIsMadeToOrder
          ? maxMto
          : getAvailableReadyStock(resolvedStock, resolvedReservedStock)

        if (maxAllowed <= 0) {
          return prevCart
        }

        updated[existingIndex] = {
          ...currentItem,
          stock: resolvedStock,
          reservedStock: resolvedReservedStock,
          isMadeToOrder: itemIsMadeToOrder,
          quantity: Math.min(currentItem.quantity + qtyToAdd, maxAllowed),
        }
        return updated
      }

      const maxAllowed = isMadeToOrder
        ? maxMto
        : getAvailableReadyStock(product.stock, product.reservedStock)

      if (maxAllowed <= 0) {
        return prevCart
      }

      return [
        ...prevCart,
        {
          ...product,
          isMadeToOrder,
          quantity: Math.min(qtyToAdd, maxAllowed),
        },
      ]
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
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      if (quantity <= 0) {
        removeItem(productId, variantId)
      }
      return
    }

    const maxMto = getMaxMtoQuantity()

    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.productId === productId && item.variantId === variantId) {
          const maxAllowed = item.isMadeToOrder
            ? maxMto
            : getAvailableReadyStock(item.stock, item.reservedStock)
          return { ...item, quantity: Math.max(1, Math.min(quantity, maxAllowed)) }
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
        finalTotal,
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
