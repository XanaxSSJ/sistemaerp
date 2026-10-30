import type { SaleResult } from '@core/types'

/**
 * Impresión tras emitir:
 * - Factura/Boleta con PDF Nubefact → solo ese PDF (nunca ticket local)
 * - Nota de venta → ticket HTML propio
 */
export async function printSaleTicket(sale: SaleResult): Promise<void> {
  try {
    const nubefactPdf =
      sale.nubefactPdf?.trim() || sale.nubefactEnlace?.trim() || ''

    // CPE (01/03): únicamente representación Nubefact
    if (nubefactPdf && /^https?:\/\//i.test(nubefactPdf)) {
      const result = await window.mebsy.invoices.printPdf(nubefactPdf)
      if (!result.ok && !result.canceled) {
        console.error(
          '[MebsyStore] No se pudo imprimir el PDF Nubefact (sin fallback local)'
        )
      }
      return
    }

    const tipo = String(sale.ticket?.tipoComprobante ?? '')
    if (tipo === '01' || tipo === '03') {
      console.error(
        '[MebsyStore] CPE sin URL de PDF Nubefact; no se imprime ticket local'
      )
      return
    }

    // NV (y solo NV): ticket HTML
    if (!sale.ticket) {
      console.error('[MebsyStore] Venta sin datos de ticket para imprimir')
      return
    }

    const result = await window.mebsy.invoices.printTicket(sale.ticket)
    if (!result.ok && !result.canceled) {
      console.error('[MebsyStore] Impresión de ticket HTML no completada')
    }
  } catch (err) {
    console.error('[MebsyStore] No se pudo imprimir el ticket:', err)
  }
}
