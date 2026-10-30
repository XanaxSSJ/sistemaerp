import { useEffect, useRef, useState } from 'react'
import { useSession } from '../store/session'

export type RealtimeStatus = 'idle' | 'connecting' | 'live' | 'error' | 'stopped'

export type RealtimeEvent = {
  type: string
  sucursalIds?: number[]
  at?: string
  meta?: Record<string, unknown>
}

/**
 * Mantiene el canal SSE de la sucursal activa (usar en AppShell).
 */
export function useRealtime(
  onEvent?: (event: RealtimeEvent) => void
): RealtimeStatus {
  const { sucursal, user } = useSession()
  const [status, setStatus] = useState<RealtimeStatus>('idle')
  const handlerRef = useRef(onEvent)
  handlerRef.current = onEvent

  useEffect(() => {
    if (!user || !sucursal) {
      void window.mebsy.realtime.unsubscribe()
      setStatus('idle')
      return
    }

    void window.mebsy.realtime.subscribe(sucursal.id)

    const offEvent = window.mebsy.realtime.onEvent((event) => {
      handlerRef.current?.(event)
    })
    const offStatus = window.mebsy.realtime.onStatus((s) => {
      setStatus(s.status)
    })

    return () => {
      offEvent()
      offStatus()
    }
  }, [user?.id, sucursal?.id])

  return status
}

/** Escucha eventos sin gestionar la conexión (páginas hijas). */
export function useRealtimeRefresh(
  types: string[],
  refresh: () => void,
  delayMs = 250
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    const off = window.mebsy.realtime.onEvent((event) => {
      if (!types.includes(event.type)) return
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        refreshRef.current()
      }, delayMs)
    })
    return () => {
      off()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [types.join('|'), delayMs])
}
