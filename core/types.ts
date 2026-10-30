export type RolUsuario = 'admin' | 'cajero'
export type TipoComprobante = '01' | '03' | 'NV'
export type MetodoPago = 'efectivo' | 'tarjeta' | 'yape' | 'mixto'

export interface SalePaymentLine {
  metodo: 'efectivo' | 'yape'
  monto: number
}
export type AfectacionIgv = '10' | '20' | '30'
export type TipoDocumentoIdentidad = '1' | '6' | '4' | '7' | '0'

export interface SessionUser {
  id: number
  username: string
  nombre: string
  rol: RolUsuario
  sucursalIds: number[]
}

export interface CartItemInput {
  productoId: number
  cantidad: number
  precioUnitario?: number
}

export interface CreateSaleInput {
  sucursalId: number
  usuarioId: number
  clienteId?: number | null
  tipoComprobante: TipoComprobante
  metodoPago: MetodoPago
  /** Montos recibidos (efectivo/yape). Requerido para NV; sum ≥ total. */
  pagos?: SalePaymentLine[]
  items: CartItemInput[]
  /** Serie elegida (CPE); si se omite usa la primera de la sucursal+tipo. */
  serie?: string
  observaciones?: string | null
  referenciaPago?: string | null
  /** ISO date (yyyy-mm-dd) para fecha de emisión CPE. */
  fechaEmision?: string | null
}

export interface SalesListQuery {
  sucursalId?: number
  tipoComprobante?: TipoComprobante
  desde?: string
  hasta?: string
  usuarioId?: number
  buscarPor?: 'nota' | 'fecha'
  q?: string
  fechaEmision?: string
  page?: number
  pageSize?: number
}

export interface SaleNoteRow {
  id: number
  sucursalId: number
  serie: string
  correlativo: number
  tipoComprobante: string
  subtotal: number
  igv: number
  total: number
  metodoPago: string
  estado: string
  usuarioId: number
  usuarioNombre: string
  createdAt: string
}

export interface TopCategoryRow {
  id: number
  nombre: string
  cantidadVendida: number
}

export interface SaleLineResult {
  productoId: number
  codigo: string
  descripcion: string
  cantidad: number
  precioUnitario: number
  subtotal: number
  igv: number
  total: number
  afectacionIgv: AfectacionIgv
}

/** Datos para imprimir ticket térmico/HTML (evita imprimir PDF en Chromium). */
export interface SaleTicketPrint {
  tipoComprobante: TipoComprobante | string
  serie: string
  correlativo: number
  subtotal: number
  igv: number
  total: number
  metodoPago: string
  createdAt: string
  empresaNombre: string
  empresaRazonSocial: string
  empresaRuc: string
  sucursalNombre: string
  sucursalDireccion: string
  clienteNombre: string | null
  clienteDocumento: string | null
  items: Array<{
    descripcion: string
    cantidad: number
    precioUnitario: number
    total: number
  }>
}

export interface SaleResult {
  ventaId: number
  serie: string
  correlativo: number
  subtotal: number
  igv: number
  total: number
  items: SaleLineResult[]
  comprobanteId: number
  xmlPath: string | null
  pdfPath: string | null
  /** Presente si SEE falló (venta igual se guardó). */
  seeError?: string | null
  /** Payload de impresión inmediata tras emitir (NV o fallback local). */
  ticket?: SaleTicketPrint
}

export interface ProductWithStock {
  id: number
  codigo: string
  codigoBarras?: string | null
  nombre: string
  descripcion: string | null
  precio: number
  unidad: string
  afectacionIgv: AfectacionIgv
  categoriaId?: number
  marcaId?: number
  categoriaNombre?: string
  marcaNombre?: string
  activo: boolean
  stock: number
  stockMinimo: number
}

export interface TransferStockInput {
  productoId: number
  sucursalOrigenId: number
  sucursalDestinoId: number
  cantidad: number
  usuarioId: number
}

export type InventoryMovementTipo = 'entrada' | 'salida'
/** Motivos de inventario. `venta` solo lo genera el POS (no UI de ajustes). */
export type InventoryMotivo =
  | 'compra'
  | 'devolucion'
  | 'cambio'
  | 'merma'
  | 'venta'
export type InventoryOrigen = 'manual' | 'masivo' | 'transferencia' | 'venta'

export interface CreateTransferInput {
  sucursalOrigenId: number
  sucursalDestinoId: number
  motivo: string
  items: Array<{ productoId: number; cantidad: number }>
  idempotencyKey?: string | null
}

export interface TransferHistoryRow {
  itemId: number
  transferenciaId: number
  codigo: string
  createdAt: string
  productoId: number
  productoNombre: string
  productoSku: string
  sucursalOrigenId: number
  sucursalOrigenNombre: string
  sucursalDestinoId: number
  sucursalDestinoNombre: string
  cantidad: number
  motivo: string
  usuarioId: number
  usuarioNombre: string | null
}

export interface TransfersListQuery {
  origenId?: number
  destinoId?: number
  desde?: string
  hasta?: string
  q?: string
  page?: number
  pageSize?: number
}
export type InventoryStockEstado = 'bajo' | 'medio' | 'normal'

export interface AdjustStockInput {
  productoId: number
  sucursalId: number
  tipo: InventoryMovementTipo
  motivo: InventoryMotivo
  cantidad: number
  observaciones?: string | null
  usuarioId?: number
}

export interface InventoryStockRow {
  id: number
  codigo: string
  codigoBarras: string | null
  nombre: string
  stock: number
  stockMinimo: number
  estado: InventoryStockEstado
}

export interface DashboardSummary {
  moneda: string
  timezone: string
  ventasUltimos7Dias: {
    total: number
    cambioPorcentaje: number | null
  }
  ventasHoy: {
    total: number
    operaciones: number
  }
  productosStockBajo: number
  tendencia: Array<{
    fecha: string
    total: number
    operaciones: number
  }>
}

export interface InventoryImportRow {
  row: number
  sku: string
  cantidad: number | string
}

export interface InventoryImportValidateResult {
  total: number
  valid: number
  invalid: number
  skuNotFound: number
  invalidQty: number
  insufficientStock: number
  duplicates: number
  errors: Array<{
    row: number
    sku: string
    field: string
    message: string
  }>
}

export interface InventoryLot {
  id: number
  codigo: string
  sucursalId: number
  tipo: InventoryMovementTipo
  motivo: InventoryMotivo
  observaciones: string | null
  usuarioId: number
  usuarioNombre?: string
  filasProcesadas: number
  movimientosRegistrados: number
  estado: string
  createdAt: string
}

export interface InventoryImportResult {
  lote: InventoryLot
  movimientosRegistrados: number
  productosProcesados: number
}

export interface InventoryMovementRow {
  id: number
  createdAt: string
  loteId: number | null
  loteCodigo: string | null
  transferenciaId?: number | null
  transferenciaCodigo?: string | null
  productoId: number
  productoNombre: string
  productoSku: string
  tipo: InventoryMovementTipo
  cantidad: number
  motivo: InventoryMotivo | string | null
  observaciones: string | null
  origen: InventoryOrigen | string | null
  usuarioId: number
  usuarioNombre: string | null
  sucursalId: number
}

export interface InventoryMovementsQuery {
  sucursalId: number
  lote?: string
  tipo?: InventoryMovementTipo | 'todos'
  desde?: string
  hasta?: string
  q?: string
  page?: number
  pageSize?: number
}

export interface ProductSalesQuery {
  productoId: number
  sucursalId: number
  desde?: string
  hasta?: string
  page?: number
  pageSize?: number
}

export interface ProductSaleLine {
  ventaId: number
  ventaItemId: number
  createdAt: string
  tipoComprobante: string
  serie: string
  correlativo: number
  cantidad: number
  precioUnitario: number
  total: number
}
