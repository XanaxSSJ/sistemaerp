import { contextBridge, ipcRenderer } from 'electron'
import type {
  AdjustStockInput,
  CreateSaleInput,
  CreateTransferInput,
  InventoryImportRow,
  InventoryMotivo,
  InventoryMovementTipo,
  InventoryMovementsQuery,
  SaleTicketPrint,
  SessionUser,
  TransfersListQuery
} from '../../core/types'

const api = {
  app: {
    mode: () =>
      ipcRenderer.invoke('app:mode') as Promise<{
        mode: 'cloud'
        apiUrl: string
      }>
  },
  auth: {
    login: (username: string, password: string) =>
      ipcRenderer.invoke('auth:login', username, password) as Promise<{
        user: SessionUser
        sucursales: Array<{
          id: number
          codigo: string
          nombre: string
          direccion: string
        }>
      }>,
    logout: () => ipcRenderer.invoke('auth:logout') as Promise<{ ok: boolean }>
  },
  realtime: {
    subscribe: (sucursalId: number) =>
      ipcRenderer.invoke('realtime:subscribe', sucursalId) as Promise<{
        ok: boolean
        status: string
      }>,
    unsubscribe: () =>
      ipcRenderer.invoke('realtime:unsubscribe') as Promise<{ ok: boolean }>,
    status: () =>
      ipcRenderer.invoke('realtime:status') as Promise<{ status: string }>,
    onEvent: (handler: (event: {
      type: string
      sucursalIds?: number[]
      at?: string
      meta?: Record<string, unknown>
    }) => void) => {
      const listener = (_e: unknown, event: {
        type: string
        sucursalIds?: number[]
        at?: string
        meta?: Record<string, unknown>
      }) => handler(event)
      ipcRenderer.on('realtime:event', listener)
      return () => {
        ipcRenderer.removeListener('realtime:event', listener)
      }
    },
    onStatus: (
      handler: (payload: {
        status: 'idle' | 'connecting' | 'live' | 'error' | 'stopped'
      }) => void
    ) => {
      const listener = (
        _e: unknown,
        payload: {
          status: 'idle' | 'connecting' | 'live' | 'error' | 'stopped'
        }
      ) => handler(payload)
      ipcRenderer.on('realtime:status', listener)
      return () => {
        ipcRenderer.removeListener('realtime:status', listener)
      }
    }
  },
  users: {
    list: () => ipcRenderer.invoke('users:list'),
    create: (input: {
      username: string
      password: string
      nombre: string
      rol: 'admin' | 'cajero'
      sucursalIds: number[]
    }) => ipcRenderer.invoke('users:create', input),
    assignBranches: (userId: number, sucursalIds: number[]) =>
      ipcRenderer.invoke('users:assignBranches', userId, sucursalIds)
  },
  company: {
    get: () => ipcRenderer.invoke('company:get'),
    update: (input: Record<string, unknown>) =>
      ipcRenderer.invoke('company:update', input),
    uploadCertificate: (input: {
      fileName: string
      contentBase64: string
      password: string
    }) => ipcRenderer.invoke('company:uploadCertificate', input)
  },
  branches: {
    list: () => ipcRenderer.invoke('branches:list'),
    create: (input: {
      codigo: string
      nombre: string
      direccion: string
      telefono?: string
    }) => ipcRenderer.invoke('branches:create', input),
    update: (
      id: number,
      input: {
        codigo?: string
        nombre?: string
        direccion?: string
        telefono?: string | null
        activa?: boolean
      }
    ) => ipcRenderer.invoke('branches:update', id, input),
    series: (sucursalId: number) =>
      ipcRenderer.invoke('branches:series', sucursalId),
    updateSeries: (
      sucursalId: number,
      items: Array<{
        tipoDocumento: string
        serie: string
        correlativo: number
      }>
    ) => ipcRenderer.invoke('branches:updateSeries', sucursalId, items)
  },
  products: {
    list: (
      sucursalId: number,
      query?: string,
      categoriaId?: number,
      marcaId?: number,
      opts?: { limit?: number; page?: number }
    ) =>
      ipcRenderer.invoke(
        'products:list',
        sucursalId,
        query,
        categoriaId,
        marcaId,
        opts
      ),
    catalog: (input?: {
      q?: string
      page?: number
      pageSize?: number
      includeInactive?: boolean
    }) => ipcRenderer.invoke('products:catalog', input),
    create: (input: Record<string, unknown>) =>
      ipcRenderer.invoke('products:create', input),
    update: (id: number, input: Record<string, unknown>) =>
      ipcRenderer.invoke('products:update', id, input),
    delete: (id: number) => ipcRenderer.invoke('products:delete', id),
    importValidate: (rows: unknown[]) =>
      ipcRenderer.invoke('products:importValidate', rows),
    import: (rows: unknown[]) => ipcRenderer.invoke('products:import', rows)
  },
  categories: {
    list: (query?: string) => ipcRenderer.invoke('categories:list', query),
    create: (nombre: string) => ipcRenderer.invoke('categories:create', nombre),
    update: (id: number, nombre: string) =>
      ipcRenderer.invoke('categories:update', id, nombre),
    delete: (id: number) => ipcRenderer.invoke('categories:delete', id)
  },
  brands: {
    list: (query?: string) => ipcRenderer.invoke('brands:list', query),
    create: (nombre: string) => ipcRenderer.invoke('brands:create', nombre),
    update: (id: number, nombre: string) =>
      ipcRenderer.invoke('brands:update', id, nombre),
    delete: (id: number) => ipcRenderer.invoke('brands:delete', id)
  },
  customers: {
    list: (query?: string) => ipcRenderer.invoke('customers:list', query),
    create: (input: Record<string, unknown>) =>
      ipcRenderer.invoke('customers:create', input)
  },
  identity: {
    ruc: (ruc: string) => ipcRenderer.invoke('identity:ruc', ruc),
    dni: (dni: string) => ipcRenderer.invoke('identity:dni', dni)
  },
  inventory: {
    stock: (input: {
      sucursalId: number
      q?: string
      estado?: 'bajo' | 'medio' | 'normal'
      page?: number
      pageSize?: number
    }) => ipcRenderer.invoke('inventory:stock', input),
    adjust: (input: AdjustStockInput) =>
      ipcRenderer.invoke('inventory:adjust', input),
    importValidate: (input: {
      sucursalId: number
      tipo: InventoryMovementTipo
      motivo: InventoryMotivo
      rows: InventoryImportRow[]
    }) => ipcRenderer.invoke('inventory:importValidate', input),
    import: (input: {
      sucursalId: number
      tipo: InventoryMovementTipo
      motivo: InventoryMotivo
      observaciones?: string | null
      idempotencyKey?: string | null
      rows: InventoryImportRow[]
    }) => ipcRenderer.invoke('inventory:import', input),
    lots: (sucursalId: number, q?: string) =>
      ipcRenderer.invoke('inventory:lots', sucursalId, q),
    movements: (query: InventoryMovementsQuery) =>
      ipcRenderer.invoke('inventory:movements', query)
  },
  transfers: {
    create: (input: CreateTransferInput) =>
      ipcRenderer.invoke('transfers:create', input),
    list: (query: TransfersListQuery = {}) =>
      ipcRenderer.invoke('transfers:list', query)
  },
  sales: {
    create: (input: CreateSaleInput) => ipcRenderer.invoke('sales:create', input),
    list: (query?: {
      sucursalId?: number
      tipoComprobante?: '01' | '03' | 'NV'
      desde?: string
      hasta?: string
      usuarioId?: number
      buscarPor?: 'nota' | 'fecha'
      q?: string
      fechaEmision?: string
      page?: number
      pageSize?: number
    }) => ipcRenderer.invoke('sales:list', query),
    topCategories: (sucursalId: number, limit?: number) =>
      ipcRenderer.invoke('sales:topCategories', sucursalId, limit),
    vendors: (sucursalId: number) =>
      ipcRenderer.invoke('sales:vendors', sucursalId),
    byProduct: (query: {
      productoId: number
      sucursalId: number
      desde?: string
      hasta?: string
      page?: number
      pageSize?: number
    }) => ipcRenderer.invoke('sales:byProduct', query)
  },
  dashboard: {
    summary: (sucursalId: number, timeZone?: string) =>
      ipcRenderer.invoke('dashboard:summary', sucursalId, timeZone)
  },
  invoices: {
    list: (query?: {
      sucursalId?: number
      tipoDocumento?: '01' | '03'
      desde?: string
      hasta?: string
      usuarioId?: number
      buscarPor?: 'comprobante' | 'fecha' | 'cliente'
      q?: string
      fechaEmision?: string
      page?: number
      pageSize?: number
    }) => ipcRenderer.invoke('invoices:list', query),
    open: (path: string) => ipcRenderer.invoke('invoices:open', path),
    openPdfAuth: (comprobanteId: number) =>
      ipcRenderer.invoke('invoices:openPdfAuth', comprobanteId) as Promise<boolean>,
    printTicket: (ticket: SaleTicketPrint) =>
      ipcRenderer.invoke('invoices:printTicket', ticket) as Promise<{
        ok: boolean
        canceled?: boolean
      }>,
    printPdf: (pdfUrl: string) =>
      ipcRenderer.invoke('invoices:printPdf', pdfUrl) as Promise<{
        ok: boolean
        canceled?: boolean
      }>,
    printPdfAuth: (comprobanteId: number) =>
      ipcRenderer.invoke('invoices:printPdfAuth', comprobanteId) as Promise<{
        ok: boolean
        canceled?: boolean
      }>
  }
}

contextBridge.exposeInMainWorld('mebsy', api)

export type MebsyApi = typeof api
