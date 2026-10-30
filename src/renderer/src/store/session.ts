import { create } from 'zustand'
import type { SessionUser } from '@core/types'

export interface SucursalOption {
  id: number
  codigo: string
  nombre: string
  direccion: string
}

interface SessionState {
  user: SessionUser | null
  sucursal: SucursalOption | null
  setUser: (user: SessionUser | null) => void
  setSucursal: (sucursal: SucursalOption | null) => void
  logout: () => void
}

export const useSession = create<SessionState>((set) => ({
  user: null,
  sucursal: null,
  setUser: (user) => set({ user }),
  setSucursal: (sucursal) => set({ sucursal }),
  logout: () => {
    void window.mebsy.auth.logout()
    set({ user: null, sucursal: null })
  }
}))
