import type { SaleResult } from '../../../core/types'

/**
 * Imprime el comprobante:
 * - CPE (01/03) SEE → ticket HTML local
 * - NV → ticket HTML
 * - Fallback: PDF autenticado de la API
 */
export async function printSaleTicket(sale: SaleResult): Promise<void> {
  try {
    if (sale.ticket) {
      await window.mebsy.invoices.printTicket(sale.ticket)
      return
    }

    if (sale.comprobanteId && sale.pdfPath) {
      await window.mebsy.invoices.printPdfAuth(sale.comprobanteId)
      return
    }

    console.warn('[MebsyCore] Sin ticket/PDF para imprimir')
  } catch (err) {
    console.error('[MebsyCore] Error al imprimir:', err)
  }
}
