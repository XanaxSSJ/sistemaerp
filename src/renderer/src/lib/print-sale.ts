import type { SaleResult } from '@core/types'

/**
 * Imprime el comprobante:
 * - CPE (01/03) con PDF SEE → PDF de la API (mismo que «Ver» en lista)
 * - NV o sin PDF → ticket HTML local
 */
export async function printSaleTicket(sale: SaleResult): Promise<void> {
  try {
    const hasCpePdf = Boolean(sale.comprobanteId && sale.pdfPath)
    if (hasCpePdf) {
      await window.mebsy.invoices.printPdfAuth(sale.comprobanteId!)
      return
    }

    if (sale.ticket) {
      await window.mebsy.invoices.printTicket(sale.ticket)
      return
    }

    console.warn('[MebsyCore] Sin ticket/PDF para imprimir')
  } catch (err) {
    console.error('[MebsyCore] Error al imprimir:', err)
  }
}
