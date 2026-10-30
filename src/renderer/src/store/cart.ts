import { create } from 'zustand'
import type { AfectacionIgv, MetodoPago, ProductWithStock } from '@core/types'

export interface CartLine {
  productoId: number
  codigo: string
  nombre: string
  precio: number
  cantidad: number
  stock: number
  afectacionIgv: AfectacionIgv
}

export type NvMetodoPago = Extract<MetodoPago, 'efectivo' | 'yape' | 'mixto'>

interface CartState {
  items: CartLine[]
  metodoPago: NvMetodoPago
  montoEfectivo: string
  montoYape: string
  addProduct: (product: ProductWithStock) => void
  setQty: (productoId: number, cantidad: number) => void
  remove: (productoId: number) => void
  clear: () => void
  setMetodoPago: (v: NvMetodoPago) => void
  setMontoEfectivo: (v: string) => void
  setMontoYape: (v: string) => void
  total: () => number
}

export const useCart = create<CartState>((set, get) => ({
  items: [],
  metodoPago: 'efectivo',
  montoEfectivo: '',
  montoYape: '',
  addProduct: (product) => {
    set((state) => {
      const existing = state.items.find((i) => i.productoId === product.id)
      if (existing) {
        if (existing.cantidad + 1 > product.stock) return state
        return {
          items: state.items.map((i) =>
            i.productoId === product.id
              ? { ...i, cantidad: i.cantidad + 1 }
              : i
          )
        }
      }
      if (product.stock <= 0) return state
      return {
        items: [
          ...state.items,
          {
            productoId: product.id,
            codigo: product.codigo,
            nombre: product.nombre,
            precio: product.precio,
            cantidad: 1,
            stock: product.stock,
            afectacionIgv: product.afectacionIgv
          }
        ]
      }
    })
  },
  setQty: (productoId, cantidad) => {
    set((state) => ({
      items: state.items
        .map((i) => {
          if (i.productoId !== productoId) return i
          const qty = Math.max(0, Math.min(cantidad, i.stock))
          return { ...i, cantidad: qty }
        })
        .filter((i) => i.cantidad > 0)
    }))
  },
  remove: (productoId) =>
    set((state) => ({
      items: state.items.filter((i) => i.productoId !== productoId)
    })),
  clear: () =>
    set({
      items: [],
      metodoPago: 'efectivo',
      montoEfectivo: '',
      montoYape: ''
    }),
  setMetodoPago: (metodoPago) =>
    set(() => {
      if (metodoPago === 'efectivo') {
        return { metodoPago, montoYape: '', montoEfectivo: '' }
      }
      if (metodoPago === 'yape') {
        return { metodoPago, montoEfectivo: '', montoYape: '' }
      }
      return { metodoPago, montoEfectivo: '', montoYape: '' }
    }),
  setMontoEfectivo: (montoEfectivo) => set({ montoEfectivo }),
  setMontoYape: (montoYape) => set({ montoYape }),
  total: () =>
    get().items.reduce((sum, i) => sum + i.precio * i.cantidad, 0)
}))
