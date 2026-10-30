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
  nubefact?: {
    ok: boolean
    enlace: string | null
    pdfUrl: string | null
    xmlUrl: string | null
    aceptada: boolean | null
    sunatDescription: string | null
    hash: string | null
    error: string | null
  } | null
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
      ? `${sale.cliente.tipoDocumento} ${sale.cliente.numeroDocumento}`
      : null,
    items: sale.items.map((i) => ({
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
): Promise<SaleResult & { nubefactError?: string | null }> {
  const sale = (await api.salesCreate(input)) as CloudSaleResponse

  // Nota de venta: solo ticket HTML propio
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
      nubefactError: null,
      ticket: buildTicketPrint(sale)
    }
  }

  // Factura/Boleta: solo Nubefact (sin ticket HTML ni UBL local de impresión)
  const nubefactPdf =
    sale.nubefact?.pdfUrl || sale.nubefact?.enlace || null
  const nubefactOk = Boolean(sale.nubefact?.ok && nubefactPdf)

  if (nubefactOk) {
    return {
      ventaId: sale.ventaId,
      serie: sale.serie,
      correlativo: sale.correlativo,
      subtotal: sale.subtotal,
      igv: sale.igv,
      total: sale.total,
      items: sale.items,
      comprobanteId: sale.comprobanteId,
      xmlPath: sale.nubefact?.xmlUrl ?? null,
      pdfPath: nubefactPdf,
      nubefactError: null,
      nubefactEnlace: sale.nubefact?.enlace ?? null,
      nubefactPdf,
      ticket: undefined
    }
  }

  if (sale.nubefact?.error) {
    try {
      await api.invoicesAttachDocuments(sale.comprobanteId, {
        estado: 'error_nubefact'
      })
    } catch (err) {
      console.error('[MebsyStore] No se pudo marcar error Nubefact:', err)
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
    xmlPath: sale.nubefact?.xmlUrl ?? null,
    pdfPath: nubefactPdf,
    nubefactError:
      sale.nubefact?.error ??
      (nubefactPdf ? null : 'Nubefact no devolvió PDF del comprobante'),
    nubefactEnlace: sale.nubefact?.enlace ?? null,
    nubefactPdf,
    ticket: undefined
  }
}
