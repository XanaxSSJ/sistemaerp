/** Entidades mínimas para generación UBL/PDF local (sin SQLite). */

export interface Empresa {
  id: number
  ruc: string
  razonSocial: string
  nombreComercial: string
  direccion: string
  ubigeo?: string | null
  distrito?: string | null
  provincia?: string | null
  departamento?: string | null
  igvPorcentaje?: number
  certificadoPath?: string | null
  certificadoPasswordEnc?: string | null
  updatedAt?: string
}

export interface Sucursal {
  id: number
  codigo: string
  nombre: string
  direccion: string
  telefono?: string | null
  activa?: boolean
  createdAt?: string
}

export interface Cliente {
  id: number
  tipoDocumento: string
  numeroDocumento: string
  nombre: string
  direccion?: string | null
  email?: string | null
  telefono?: string | null
  createdAt?: string
}

export interface Venta {
  id: number
  sucursalId: number
  usuarioId?: number
  clienteId?: number | null
  tipoComprobante: string
  serie: string
  correlativo: number
  moneda: string
  subtotal: number
  igv: number
  total: number
  metodoPago: string
  estado?: string
  createdAt: string
}
