import type {
  AdjustStockInput,
  CreateSaleInput,
  CreateTransferInput,
  InventoryImportRow,
  InventoryMotivo,
  InventoryMovementTipo,
  InventoryMovementsQuery,
  SessionUser,
  TransferStockInput,
  TransfersListQuery
} from '../../../core/types'

export interface CloudConfig {
  baseUrl: string
  token?: string
}

export class ApiClient {
  private token: string | null = null

  constructor(private readonly baseUrl: string) {}

  setToken(token: string | null) {
    this.token = token
  }

  getToken() {
    return this.token
  }

  private async request<T>(
    path: string,
    init: RequestInit & { json?: unknown } = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(init.headers as Record<string, string>)
    }
    if (init.json !== undefined) {
      headers['Content-Type'] = 'application/json'
    }
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body
    })

    const text = await res.text()
    const data = text ? JSON.parse(text) : null

    if (!res.ok) {
      const message =
        data?.error?.message || data?.message || `HTTP ${res.status}`
      const code = data?.error?.code || 'HTTP_ERROR'
      throw new Error(JSON.stringify({ code, message }))
    }

    return data as T
  }

  async login(username: string, password: string) {
    const result = await this.request<{
      user: SessionUser
      token: string
      sucursales: Array<{
        id: number
        codigo: string
        nombre: string
        direccion: string
        telefono: string | null
        activa: boolean
      }>
    }>('/api/v1/auth/login', {
      method: 'POST',
      json: { username, password }
    })
    this.token = result.token
    // Normalizar IDs numéricos (evita fallos string vs number)
    result.user = {
      ...result.user,
      id: Number(result.user.id),
      sucursalIds: (result.user.sucursalIds ?? []).map(Number)
    }
    result.sucursales = (result.sucursales ?? []).map((s) => ({
      ...s,
      id: Number(s.id)
    }))
    return result
  }

  usersList() {
    return this.request('/api/v1/users')
  }

  usersCreate(input: {
    username: string
    password: string
    nombre: string
    rol: 'admin' | 'cajero'
    sucursalIds: number[]
  }) {
    return this.request('/api/v1/users', {
      method: 'POST',
      json: {
        ...input,
        sucursalIds: input.sucursalIds.map(Number)
      }
    })
  }

  usersAssignBranches(userId: number, sucursalIds: number[]) {
    return this.request(`/api/v1/users/${Number(userId)}/branches`, {
      method: 'PUT',
      json: { sucursalIds: sucursalIds.map(Number) }
    })
  }

  sucursales() {
    return this.request('/api/v1/branches')
  }

  companyGet() {
    return this.request('/api/v1/company')
  }

  companyUpdate(input: Record<string, unknown>) {
    return this.request('/api/v1/company', { method: 'PATCH', json: input })
  }

  companyUploadCertificate(input: {
    fileName: string
    contentBase64: string
    password: string
  }) {
    return this.request('/api/v1/company/certificate', {
      method: 'POST',
      json: input
    })
  }

  async invoicesPdfBuffer(comprobanteId: number): Promise<ArrayBuffer> {
    const headers: Record<string, string> = { Accept: 'application/pdf' }
    if (this.token) headers.Authorization = `Bearer ${this.token}`
    const res = await fetch(
      `${this.baseUrl}/api/v1/invoices/${comprobanteId}/pdf`,
      { headers, signal: AbortSignal.timeout(30000) }
    )
    if (!res.ok) {
      throw new Error(`No se pudo descargar PDF (${res.status})`)
    }
    return res.arrayBuffer()
  }

  branchesList() {
    return this.request('/api/v1/branches')
  }

  branchesCreate(input: {
    codigo: string
    nombre: string
    direccion: string
    telefono?: string
  }) {
    return this.request('/api/v1/branches', { method: 'POST', json: input })
  }

  branchesUpdate(
    id: number,
    input: {
      codigo?: string
      nombre?: string
      direccion?: string
      telefono?: string | null
      activa?: boolean
    }
  ) {
    return this.request(`/api/v1/branches/${Number(id)}`, {
      method: 'PATCH',
      json: input
    })
  }

  branchesSeries(sucursalId: number) {
    return this.request(`/api/v1/branches/${sucursalId}/series`)
  }

  branchesUpdateSeries(
    sucursalId: number,
    items: Array<{
      tipoDocumento: string
      serie: string
      correlativo: number
    }>
  ) {
    return this.request(`/api/v1/branches/${Number(sucursalId)}/series`, {
      method: 'PUT',
      json: { items }
    })
  }

  productsList(
    sucursalId: number,
    query?: string,
    categoriaId?: number,
    marcaId?: number,
    opts?: { limit?: number; page?: number }
  ) {
    const params = new URLSearchParams()
    params.set('sucursalId', String(sucursalId))
    if (query) params.set('q', query)
    if (categoriaId != null) params.set('categoriaId', String(categoriaId))
    if (marcaId != null) params.set('marcaId', String(marcaId))
    const limit = opts?.limit ?? 60
    params.set('pageSize', String(limit))
    params.set('page', String(opts?.page ?? 1))
    return this.request(`/api/v1/products?${params.toString()}`)
  }

  productsCatalog(input?: {
    q?: string
    page?: number
    pageSize?: number
    includeInactive?: boolean
  }) {
    const params = new URLSearchParams()
    if (input?.q) params.set('q', input.q)
    if (input?.page) params.set('page', String(input.page))
    if (input?.pageSize) params.set('pageSize', String(input.pageSize))
    if (input?.includeInactive) params.set('includeInactive', '1')
    const qs = params.toString()
    return this.request(`/api/v1/products${qs ? `?${qs}` : ''}`)
  }

  productsGet(id: number) {
    return this.request(`/api/v1/products/${Number(id)}`)
  }

  productsCreate(input: Record<string, unknown>) {
    return this.request('/api/v1/products', { method: 'POST', json: input })
  }

  productsUpdate(id: number, input: Record<string, unknown>) {
    return this.request(`/api/v1/products/${Number(id)}`, {
      method: 'PATCH',
      json: input
    })
  }

  productsDelete(id: number) {
    return this.request(`/api/v1/products/${Number(id)}`, { method: 'DELETE' })
  }

  productsImportValidate(rows: unknown[]) {
    return this.request('/api/v1/products/import/validate', {
      method: 'POST',
      json: { rows }
    })
  }

  productsImport(rows: unknown[]) {
    return this.request('/api/v1/products/import', {
      method: 'POST',
      json: { rows }
    })
  }

  categoriesList(query?: string) {
    const q = query ? `?q=${encodeURIComponent(query)}` : ''
    return this.request(`/api/v1/categories${q}`)
  }

  categoriesCreate(nombre: string) {
    return this.request('/api/v1/categories', {
      method: 'POST',
      json: { nombre }
    })
  }

  categoriesUpdate(id: number, nombre: string) {
    return this.request(`/api/v1/categories/${Number(id)}`, {
      method: 'PATCH',
      json: { nombre }
    })
  }

  categoriesDelete(id: number) {
    return this.request(`/api/v1/categories/${Number(id)}`, { method: 'DELETE' })
  }

  brandsList(query?: string) {
    const q = query ? `?q=${encodeURIComponent(query)}` : ''
    return this.request(`/api/v1/brands${q}`)
  }

  brandsCreate(nombre: string) {
    return this.request('/api/v1/brands', { method: 'POST', json: { nombre } })
  }

  brandsUpdate(id: number, nombre: string) {
    return this.request(`/api/v1/brands/${Number(id)}`, {
      method: 'PATCH',
      json: { nombre }
    })
  }

  brandsDelete(id: number) {
    return this.request(`/api/v1/brands/${Number(id)}`, { method: 'DELETE' })
  }

  customersList(query?: string) {
    const q = query ? `?q=${encodeURIComponent(query)}` : ''
    return this.request(`/api/v1/customers${q}`)
  }

  customersCreate(input: Record<string, unknown>) {
    return this.request('/api/v1/customers', { method: 'POST', json: input })
  }

  identityRuc(ruc: string) {
    return this.request(`/api/v1/identity/ruc/${encodeURIComponent(ruc)}`)
  }

  identityDni(dni: string) {
    return this.request(`/api/v1/identity/dni/${encodeURIComponent(dni)}`)
  }

  inventoryStock(input: {
    sucursalId: number
    q?: string
    estado?: 'bajo' | 'medio' | 'normal'
    page?: number
    pageSize?: number
  }) {
    const params = new URLSearchParams()
    params.set('sucursalId', String(input.sucursalId))
    if (input.q) params.set('q', input.q)
    if (input.estado) params.set('estado', input.estado)
    if (input.page) params.set('page', String(input.page))
    if (input.pageSize) params.set('pageSize', String(input.pageSize))
    return this.request(`/api/v1/inventory/stock?${params}`)
  }

  dashboardSummary(sucursalId: number, timeZone?: string) {
    const params = new URLSearchParams()
    params.set('sucursalId', String(sucursalId))
    if (timeZone) params.set('timeZone', timeZone)
    return this.request(`/api/v1/dashboard/summary?${params}`)
  }

  inventoryAdjust(input: AdjustStockInput) {
    return this.request('/api/v1/inventory/adjust', {
      method: 'POST',
      json: {
        productoId: input.productoId,
        sucursalId: input.sucursalId,
        tipo: input.tipo,
        motivo: input.motivo,
        cantidad: input.cantidad,
        observaciones: input.observaciones
      }
    })
  }

  inventoryImportValidate(input: {
    sucursalId: number
    tipo: InventoryMovementTipo
    motivo: InventoryMotivo
    rows: InventoryImportRow[]
  }) {
    return this.request('/api/v1/inventory/import/validate', {
      method: 'POST',
      json: input
    })
  }

  inventoryImport(input: {
    sucursalId: number
    tipo: InventoryMovementTipo
    motivo: InventoryMotivo
    observaciones?: string | null
    idempotencyKey?: string | null
    rows: InventoryImportRow[]
  }) {
    return this.request('/api/v1/inventory/import', {
      method: 'POST',
      json: input
    })
  }

  inventoryTransfer(input: TransferStockInput) {
    return this.request('/api/v1/inventory/transfer', {
      method: 'POST',
      json: {
        productoId: input.productoId,
        sucursalOrigenId: input.sucursalOrigenId,
        sucursalDestinoId: input.sucursalDestinoId,
        cantidad: input.cantidad
      }
    })
  }

  inventoryLots(sucursalId: number, q?: string) {
    const params = new URLSearchParams({ sucursalId: String(sucursalId) })
    if (q) params.set('q', q)
    return this.request(`/api/v1/inventory/lots?${params}`)
  }

  inventoryMovements(query: InventoryMovementsQuery) {
    const params = new URLSearchParams()
    params.set('sucursalId', String(query.sucursalId))
    if (query.lote) params.set('lote', query.lote)
    if (query.tipo) params.set('tipo', query.tipo)
    if (query.desde) params.set('desde', query.desde)
    if (query.hasta) params.set('hasta', query.hasta)
    if (query.q) params.set('q', query.q)
    if (query.page) params.set('page', String(query.page))
    if (query.pageSize) params.set('pageSize', String(query.pageSize))
    return this.request(`/api/v1/inventory/movements?${params}`)
  }

  transfersCreate(input: CreateTransferInput) {
    return this.request('/api/v1/transfers', {
      method: 'POST',
      json: input
    })
  }

  transfersList(query: TransfersListQuery = {}) {
    const params = new URLSearchParams()
    if (query.origenId != null) params.set('origenId', String(query.origenId))
    if (query.destinoId != null)
      params.set('destinoId', String(query.destinoId))
    if (query.desde) params.set('desde', query.desde)
    if (query.hasta) params.set('hasta', query.hasta)
    if (query.q) params.set('q', query.q)
    if (query.page) params.set('page', String(query.page))
    if (query.pageSize) params.set('pageSize', String(query.pageSize))
    const qs = params.toString()
    return this.request(`/api/v1/transfers${qs ? `?${qs}` : ''}`)
  }

  salesCreate(input: CreateSaleInput) {
    return this.request('/api/v1/sales', {
      method: 'POST',
      json: {
        sucursalId: Number(input.sucursalId),
        clienteId:
          input.clienteId == null ? null : Number(input.clienteId),
        tipoComprobante: input.tipoComprobante,
        metodoPago: input.metodoPago,
        pagos: input.pagos?.map((p) => ({
          metodo: p.metodo,
          monto: Number(p.monto)
        })),
        items: input.items.map((item) => ({
          productoId: Number(item.productoId),
          cantidad: Number(item.cantidad),
          precioUnitario:
            item.precioUnitario === undefined
              ? undefined
              : Number(item.precioUnitario)
        })),
        serie: input.serie,
        observaciones: input.observaciones ?? null,
        referenciaPago: input.referenciaPago ?? null,
        fechaEmision: input.fechaEmision ?? null
      }
    })
  }

  salesList(query: {
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
  } = {}) {
    const params = new URLSearchParams()
    if (query.sucursalId != null)
      params.set('sucursalId', String(query.sucursalId))
    if (query.tipoComprobante)
      params.set('tipoComprobante', query.tipoComprobante)
    if (query.desde) params.set('desde', query.desde)
    if (query.hasta) params.set('hasta', query.hasta)
    if (query.usuarioId != null)
      params.set('usuarioId', String(query.usuarioId))
    if (query.buscarPor) params.set('buscarPor', query.buscarPor)
    if (query.q) params.set('q', query.q)
    if (query.fechaEmision) params.set('fechaEmision', query.fechaEmision)
    if (query.page) params.set('page', String(query.page))
    if (query.pageSize) params.set('pageSize', String(query.pageSize))
    const qs = params.toString()
    return this.request(`/api/v1/sales${qs ? `?${qs}` : ''}`)
  }

  salesTopCategories(sucursalId: number, limit = 5) {
    return this.request(
      `/api/v1/sales/top-categories?sucursalId=${Number(sucursalId)}&limit=${limit}`
    )
  }

  salesVendors(sucursalId: number) {
    return this.request(
      `/api/v1/sales/vendors?sucursalId=${Number(sucursalId)}`
    )
  }

  salesByProduct(query: {
    productoId: number
    sucursalId: number
    desde?: string
    hasta?: string
    page?: number
    pageSize?: number
  }) {
    const params = new URLSearchParams()
    params.set('productoId', String(query.productoId))
    params.set('sucursalId', String(query.sucursalId))
    if (query.desde) params.set('desde', query.desde)
    if (query.hasta) params.set('hasta', query.hasta)
    if (query.page) params.set('page', String(query.page))
    if (query.pageSize) params.set('pageSize', String(query.pageSize))
    return this.request(`/api/v1/sales/by-product?${params}`)
  }

  invoicesList(query: {
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
  } = {}) {
    const params = new URLSearchParams()
    if (query.sucursalId != null)
      params.set('sucursalId', String(query.sucursalId))
    if (query.tipoDocumento) params.set('tipoDocumento', query.tipoDocumento)
    if (query.desde) params.set('desde', query.desde)
    if (query.hasta) params.set('hasta', query.hasta)
    if (query.usuarioId != null)
      params.set('usuarioId', String(query.usuarioId))
    if (query.buscarPor) params.set('buscarPor', query.buscarPor)
    if (query.q) params.set('q', query.q)
    if (query.fechaEmision) params.set('fechaEmision', query.fechaEmision)
    if (query.page) params.set('page', String(query.page))
    if (query.pageSize) params.set('pageSize', String(query.pageSize))
    const qs = params.toString()
    return this.request(`/api/v1/invoices${qs ? `?${qs}` : ''}`)
  }

  invoicesAttachDocuments(
    comprobanteId: number,
    input: {
      xmlPath?: string | null
      pdfPath?: string | null
      hash?: string | null
      estado?: string
    }
  ) {
    return this.request(`/api/v1/invoices/${Number(comprobanteId)}/documents`, {
      method: 'PATCH',
      json: input
    })
  }

  async health() {
    return this.request<{ ok: boolean; service: string }>('/health')
  }
}
