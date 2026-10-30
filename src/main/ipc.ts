import { ipcMain, shell } from 'electron'
import type {
  AdjustStockInput,
  CreateSaleInput,
  CreateTransferInput,
  InventoryImportRow,
  InventoryMotivo,
  InventoryMovementTipo,
  InventoryMovementsQuery,
  SaleTicketPrint,
  TransfersListQuery
} from '../../core/types'
import type { ApiClient } from './cloud/api-client'
import type { RealtimeClient } from './cloud/realtime-client'
import { createCloudSale } from './cloud/sale-orchestrator'
import { printPdfFromUrl, printTicketHtml } from './print-ticket'

export function registerIpcHandlers(
  api: ApiClient,
  apiUrl: string,
  realtime: RealtimeClient
): void {
  ipcMain.handle('app:mode', () => ({ mode: 'cloud' as const, apiUrl }))

  ipcMain.handle('auth:login', async (_e, username: string, password: string) => {
    const result = await api.login(username, password)
    return {
      user: result.user,
      sucursales: result.sucursales
    }
  })

  ipcMain.handle('auth:logout', () => {
    realtime.unsubscribe()
    api.setToken(null)
    return { ok: true }
  })

  ipcMain.handle('realtime:subscribe', (_e, sucursalId: number) => {
    realtime.subscribe(sucursalId)
    return { ok: true, status: realtime.getStatus() }
  })

  ipcMain.handle('realtime:unsubscribe', () => {
    realtime.unsubscribe()
    return { ok: true }
  })

  ipcMain.handle('realtime:status', () => ({ status: realtime.getStatus() }))

  ipcMain.handle('users:list', async () => api.usersList())
  ipcMain.handle(
    'users:create',
    async (
      _e,
      input: {
        username: string
        password: string
        nombre: string
        rol: 'admin' | 'cajero'
        sucursalIds: number[]
      }
    ) => api.usersCreate(input)
  )
  ipcMain.handle(
    'users:assignBranches',
    async (_e, userId: number, sucursalIds: number[]) =>
      api.usersAssignBranches(userId, sucursalIds)
  )

  ipcMain.handle('company:get', async () => api.companyGet())
  ipcMain.handle('company:update', async (_e, input) => api.companyUpdate(input))

  ipcMain.handle('branches:list', async () => api.branchesList())
  ipcMain.handle('branches:create', async (_e, input) => api.branchesCreate(input))
  ipcMain.handle(
    'branches:update',
    async (
      _e,
      id: number,
      input: {
        codigo?: string
        nombre?: string
        direccion?: string
        telefono?: string | null
        activa?: boolean
        nubefactRuta?: string | null
        nubefactToken?: string | null
      }
    ) => api.branchesUpdate(id, input)
  )
  ipcMain.handle('branches:series', async (_e, sucursalId: number) =>
    api.branchesSeries(sucursalId)
  )
  ipcMain.handle(
    'branches:updateSeries',
    async (
      _e,
      sucursalId: number,
      items: Array<{
        tipoDocumento: string
        serie: string
        correlativo: number
      }>
    ) => api.branchesUpdateSeries(sucursalId, items)
  )

  ipcMain.handle(
    'products:list',
    async (
      _e,
      sucursalId: number,
      query?: string,
      categoriaId?: number,
      marcaId?: number,
      opts?: { limit?: number; page?: number }
    ) => api.productsList(sucursalId, query, categoriaId, marcaId, opts)
  )
  ipcMain.handle(
    'products:catalog',
    async (
      _e,
      input?: {
        q?: string
        page?: number
        pageSize?: number
        includeInactive?: boolean
      }
    ) => api.productsCatalog(input)
  )
  ipcMain.handle('products:create', async (_e, input) => api.productsCreate(input))
  ipcMain.handle('products:update', async (_e, id: number, input) =>
    api.productsUpdate(id, input)
  )
  ipcMain.handle('products:delete', async (_e, id: number) =>
    api.productsDelete(id)
  )
  ipcMain.handle('products:importValidate', async (_e, rows: unknown[]) =>
    api.productsImportValidate(rows)
  )
  ipcMain.handle('products:import', async (_e, rows: unknown[]) =>
    api.productsImport(rows)
  )

  ipcMain.handle('categories:list', async (_e, query?: string) =>
    api.categoriesList(query)
  )
  ipcMain.handle('categories:create', async (_e, nombre: string) =>
    api.categoriesCreate(nombre)
  )
  ipcMain.handle('categories:update', async (_e, id: number, nombre: string) =>
    api.categoriesUpdate(id, nombre)
  )
  ipcMain.handle('categories:delete', async (_e, id: number) =>
    api.categoriesDelete(id)
  )

  ipcMain.handle('brands:list', async (_e, query?: string) =>
    api.brandsList(query)
  )
  ipcMain.handle('brands:create', async (_e, nombre: string) =>
    api.brandsCreate(nombre)
  )
  ipcMain.handle('brands:update', async (_e, id: number, nombre: string) =>
    api.brandsUpdate(id, nombre)
  )
  ipcMain.handle('brands:delete', async (_e, id: number) => api.brandsDelete(id))

  ipcMain.handle('customers:list', async (_e, query?: string) =>
    api.customersList(query)
  )
  ipcMain.handle('customers:create', async (_e, input) =>
    api.customersCreate(input)
  )
  ipcMain.handle('identity:ruc', async (_e, ruc: string) => api.identityRuc(ruc))
  ipcMain.handle('identity:dni', async (_e, dni: string) => api.identityDni(dni))

  ipcMain.handle(
    'inventory:stock',
    async (
      _e,
      input: {
        sucursalId: number
        q?: string
        estado?: 'bajo' | 'medio' | 'normal'
        page?: number
        pageSize?: number
      }
    ) => api.inventoryStock(input)
  )
  ipcMain.handle('inventory:adjust', async (_e, input: AdjustStockInput) =>
    api.inventoryAdjust(input)
  )
  ipcMain.handle(
    'inventory:importValidate',
    async (
      _e,
      input: {
        sucursalId: number
        tipo: InventoryMovementTipo
        motivo: InventoryMotivo
        rows: InventoryImportRow[]
      }
    ) => api.inventoryImportValidate(input)
  )
  ipcMain.handle(
    'inventory:import',
    async (
      _e,
      input: {
        sucursalId: number
        tipo: InventoryMovementTipo
        motivo: InventoryMotivo
        observaciones?: string | null
        idempotencyKey?: string | null
        rows: InventoryImportRow[]
      }
    ) => api.inventoryImport(input)
  )
  ipcMain.handle(
    'inventory:lots',
    async (_e, sucursalId: number, q?: string) =>
      api.inventoryLots(sucursalId, q)
  )
  ipcMain.handle(
    'inventory:movements',
    async (_e, query: InventoryMovementsQuery) => api.inventoryMovements(query)
  )

  ipcMain.handle('transfers:create', async (_e, input: CreateTransferInput) =>
    api.transfersCreate(input)
  )
  ipcMain.handle('transfers:list', async (_e, query: TransfersListQuery) =>
    api.transfersList(query ?? {})
  )

  ipcMain.handle('sales:create', async (_e, input: CreateSaleInput) =>
    createCloudSale(api, input)
  )
  ipcMain.handle(
    'sales:list',
    async (
      _e,
      query?: {
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
      }
    ) => api.salesList(query ?? {})
  )
  ipcMain.handle(
    'sales:topCategories',
    async (_e, sucursalId: number, limit?: number) =>
      api.salesTopCategories(sucursalId, limit ?? 5)
  )
  ipcMain.handle('sales:vendors', async (_e, sucursalId: number) =>
    api.salesVendors(sucursalId)
  )
  ipcMain.handle(
    'sales:byProduct',
    async (
      _e,
      query: {
        productoId: number
        sucursalId: number
        desde?: string
        hasta?: string
        page?: number
        pageSize?: number
      }
    ) => api.salesByProduct(query)
  )
  ipcMain.handle(
    'dashboard:summary',
    async (_e, sucursalId: number, timeZone?: string) =>
      api.dashboardSummary(sucursalId, timeZone)
  )

  ipcMain.handle(
    'invoices:list',
    async (
      _e,
      query?: {
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
      }
    ) => api.invoicesList(query ?? {})
  )
  ipcMain.handle('invoices:open', async (_e, path: string) => {
    if (!path) return false
    if (/^https?:\/\//i.test(path)) {
      await shell.openExternal(path)
      return true
    }
    await shell.openPath(path)
    return true
  })
  ipcMain.handle('invoices:printTicket', async (_e, ticket: SaleTicketPrint) => {
    if (!ticket?.serie) return { ok: false }
    return printTicketHtml(ticket)
  })
  ipcMain.handle('invoices:printPdf', async (_e, pdfUrl: string) => {
    if (!pdfUrl?.trim()) return { ok: false }
    return printPdfFromUrl(pdfUrl.trim())
  })
}
