import { BrowserWindow } from 'electron'

export type RealtimeEventType =
  | 'connected'
  | 'stock.updated'
  | 'product.changed'
  | 'sale.created'
  | 'invoice.updated'

export interface RealtimeEvent {
  type: RealtimeEventType | string
  sucursalIds?: number[]
  at?: string
  meta?: Record<string, unknown>
  sucursalId?: number
}

type Status = 'idle' | 'connecting' | 'live' | 'error' | 'stopped'

/**
 * Cliente SSE hacia la API Fastify.
 * Reenvía eventos al renderer vía IPC channel `realtime:event`.
 */
export class RealtimeClient {
  private abort: AbortController | null = null
  private sucursalId: number | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private attempt = 0
  private status: Status = 'idle'
  private intentionalStop = false

  constructor(
    private readonly baseUrl: string,
    private readonly getToken: () => string | null
  ) {}

  getStatus(): Status {
    return this.status
  }

  subscribe(sucursalId: number): void {
    this.intentionalStop = false
    this.sucursalId = Number(sucursalId)
    void this.connect()
  }

  unsubscribe(): void {
    this.intentionalStop = true
    this.sucursalId = null
    this.clearReconnect()
    this.abort?.abort()
    this.abort = null
    this.status = 'stopped'
    this.broadcastStatus()
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private broadcast(channel: string, payload: unknown) {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(channel, payload)
    }
  }

  private broadcastStatus() {
    this.broadcast('realtime:status', { status: this.status })
  }

  private scheduleReconnect() {
    if (this.intentionalStop || this.sucursalId == null) return
    this.clearReconnect()
    const delay = Math.min(15000, 800 * 2 ** this.attempt)
    this.attempt += 1
    this.reconnectTimer = setTimeout(() => {
      void this.connect()
    }, delay)
  }

  private async connect(): Promise<void> {
    this.abort?.abort()
    this.clearReconnect()

    const token = this.getToken()
    if (!token || this.sucursalId == null) {
      this.status = 'idle'
      this.broadcastStatus()
      return
    }

    this.status = 'connecting'
    this.broadcastStatus()
    this.abort = new AbortController()

    try {
      const url = `${this.baseUrl}/api/v1/realtime/stream?sucursalId=${this.sucursalId}`
      const res = await fetch(url, {
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${token}`
        },
        signal: this.abort.signal
      })

      if (!res.ok || !res.body) {
        throw new Error(`SSE HTTP ${res.status}`)
      }

      this.status = 'live'
      this.attempt = 0
      this.broadcastStatus()

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const chunk of parts) {
          this.handleSseChunk(chunk)
        }
      }

      if (!this.intentionalStop) {
        this.status = 'error'
        this.broadcastStatus()
        this.scheduleReconnect()
      }
    } catch (err) {
      if (this.intentionalStop) return
      if ((err as Error)?.name === 'AbortError') return
      console.warn('[realtime] desconectado:', (err as Error).message)
      this.status = 'error'
      this.broadcastStatus()
      this.scheduleReconnect()
    }
  }

  private handleSseChunk(chunk: string) {
    const lines = chunk.split(/\r?\n/)
    let eventName = 'message'
    const dataLines: string[] = []
    for (const line of lines) {
      if (!line || line.startsWith(':')) continue
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim())
      }
    }
    if (!dataLines.length) return
    try {
      const data = JSON.parse(dataLines.join('\n')) as RealtimeEvent
      this.broadcast('realtime:event', {
        ...data,
        type: eventName === 'message' ? data.type : eventName
      })
    } catch {
      /* ignore malformed */
    }
  }
}
