import type {
  CreateSaleInput,
  SaleLineResult,
  SaleResult,
  SaleTicketPrint
} from '../../../core/types'
import type { ApiClient } from './api-client'

type CloudSaleResponse = {
  ventaId: number
  serie: string
  correlativo: number
  subtotal: number
  igv: number
  total: number
  comprobanteId: number
  tipoComprobante: '01' | '03' | 'NV'
  sucursalId: number
  metodoPago: string
  createdAt: string
  igvPorcentaje: number
  items: SaleLineResult[]
  empresa: {
    id: number
    ruc: string
    razonSocial: string
    nombreComercial: string
    direccion: string
  }
  sucursal: {
    id: number
    codigo: string
    nombre: string
    direccion: string
    telefono: string | null
  }
  cliente: {
    id: number
    tipoDocumento: string
    numeroDocumento: string
    nombre: string
    direccion: string | null
  } | null
  see?: {
    ok: boolean
    aceptada: boolean | null
    sunatDescription: string | null
    hash: string | null
    xmlPath: string | null
    cdrPath: string | null
    pdfPath: string | null
    pdfUrl: string | null
    qr: string | null
    error: string | null
  } | null
}

function docTipoLabel(tipo: string): string {
  const t = String(tipo)
  if (t === '1' || t === '01') return 'DNI'
  if (t === '6' || t === '06') return 'RUC'
  if (t === '4' || t === '04') return 'C.E.'
  return `DOC ${t}`
}

function buildTicketPrint(sale: CloudSaleResponse): SaleTicketPrint {
  return {
    tipoComprobante: sale.tipoComprobante,
    serie: sale.serie,
    correlativo: sale.correlativo,
    subtotal: sale.subtotal,
    igv: sale.igv,
    total: sale.total,
    metodoPago: sale.metodoPago,
    createdAt: sale.createdAt,
    empresaNombre: sale.empresa.nombreComercial || sale.empresa.razonSocial,
    empresaRazonSocial: sale.empresa.razonSocial,
    empresaRuc: sale.empresa.ruc,
    sucursalNombre: sale.sucursal.nombre,
    sucursalDireccion: sale.sucursal.direccion,
    clienteNombre: sale.cliente?.nombre ?? null,
    clienteDocumento: sale.cliente
      ? `${docTipoLabel(sale.cliente.tipoDocumento)} ${sale.cliente.numeroDocumento}`
      : null,
    qr: sale.see?.qr ?? null,
    items: sale.items.map((i) => ({
      codigo: i.codigo,
      unidad: i.unidad || 'NIU',
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      precioUnitario: i.precioUnitario,
      total: i.total
    }))
  }
}

export async function createCloudSale(
  api: ApiClient,
  input: CreateSaleInput
): Promise<SaleResult & { seeError?: string | null }> {
  const sale = (await api.salesCreate(input)) as CloudSaleResponse
  const ticket = buildTicketPrint(sale)

  if (sale.tipoComprobante === 'NV' || input.tipoComprobante === 'NV') {
    return {
      ventaId: sale.ventaId,
      serie: sale.serie,
      correlativo: sale.correlativo,
      subtotal: sale.subtotal,
      igv: sale.igv,
      total: sale.total,
      items: sale.items,
      comprobanteId: sale.comprobanteId,
      xmlPath: null,
      pdfPath: null,
      seeError: null,
      ticket
    }
  }

  if (!sale.see) {
    return {
      ventaId: sale.ventaId,
      serie: sale.serie,
      correlativo: sale.correlativo,
      subtotal: sale.subtotal,
      igv: sale.igv,
      total: sale.total,
      items: sale.items,
      comprobanteId: sale.comprobanteId,
      xmlPath: null,
      pdfPath: null,
      seeError: 'Sin respuesta SEE (revisá Empresa → SEE)',
      ticket
    }
  }

  return {
    ventaId: sale.ventaId,
    serie: sale.serie,
    correlativo: sale.correlativo,
    subtotal: sale.subtotal,
    igv: sale.igv,
    total: sale.total,
    items: sale.items,
    comprobanteId: sale.comprobanteId,
    xmlPath: sale.see.xmlPath,
    pdfPath: sale.see.pdfUrl ?? sale.see.pdfPath,
    seeError: sale.see.ok ? null : sale.see.error,
    ticket
  }
}
