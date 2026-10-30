import { BrowserWindow, app } from 'electron'
import { writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { SaleTicketPrint } from '../../core/types'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatPen(n: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN'
  }).format(n)
}

function pad(n: number): string {
  return String(n).padStart(8, '0')
}

function tipoLabel(tipo: string): string {
  if (tipo === '01') return 'FACTURA ELECTRÓNICA'
  if (tipo === '03') return 'BOLETA ELECTRÓNICA'
  return 'NOTA DE VENTA'
}

function buildTicketHtml(ticket: SaleTicketPrint): string {
  const esNv = ticket.tipoComprobante === 'NV'
  const fecha = (ticket.createdAt || '').slice(0, 19).replace('T', ' ')
  const itemsHtml = ticket.items
    .map(
      (item) => `
      <div class="line">
        <div>${escapeHtml(String(item.cantidad))} x ${escapeHtml(item.descripcion)}</div>
        <div class="right">${escapeHtml(formatPen(item.precioUnitario))} → ${escapeHtml(formatPen(item.total))}</div>
      </div>`
    )
    .join('')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Ticket ${escapeHtml(ticket.serie)}-${pad(ticket.correlativo)}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 4mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 72mm;
      background: #fff;
      color: #000;
      font: 11px/1.35 Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .wrap { padding: 2mm; width: 72mm; }
    .c { text-align: center; }
    .b { font-weight: 700; }
    .muted { font-size: 10px; }
    .sep { margin: 6px 0; border-top: 1px dashed #000; }
    .line { margin: 4px 0; }
    .right { text-align: right; }
    .tot { font-size: 13px; font-weight: 700; margin-top: 4px; }
    .foot { margin-top: 8px; font-size: 9px; text-align: center; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="c b">${escapeHtml(ticket.empresaNombre || ticket.empresaRazonSocial)}</div>
    <div class="c muted">${escapeHtml(ticket.empresaRazonSocial)}</div>
    <div class="c">RUC: ${escapeHtml(ticket.empresaRuc)}</div>
    <div class="c">${escapeHtml(ticket.sucursalNombre)}</div>
    <div class="c muted">${escapeHtml(ticket.sucursalDireccion)}</div>
    <div class="sep"></div>
    <div class="c b">${escapeHtml(tipoLabel(String(ticket.tipoComprobante)))}</div>
    <div class="c b">${escapeHtml(ticket.serie)}-${pad(ticket.correlativo)}</div>
    <div class="sep"></div>
    <div>Fecha: ${escapeHtml(fecha)}</div>
    <div>Cliente: ${escapeHtml(ticket.clienteNombre || 'CLIENTES VARIOS')}</div>
    ${
      ticket.clienteDocumento && !esNv
        ? `<div>Doc: ${escapeHtml(ticket.clienteDocumento)}</div>`
        : ''
    }
    <div class="sep"></div>
    ${itemsHtml}
    <div class="sep"></div>
    <div class="right">Op. gravada: ${escapeHtml(formatPen(ticket.subtotal))}</div>
    <div class="right">IGV: ${escapeHtml(formatPen(ticket.igv))}</div>
    <div class="right tot">TOTAL: ${escapeHtml(formatPen(ticket.total))}</div>
    <div>Pago: ${escapeHtml(ticket.metodoPago)}</div>
    <div class="foot">
      ${
        esNv
          ? 'Documento interno — no válido para SUNAT'
          : 'Representación impresa del comprobante electrónico'
      }<br/>MebsyStore
    </div>
  </div>
</body>
</html>`
}

async function runPrintDialog(
  win: BrowserWindow
): Promise<{ ok: boolean; canceled?: boolean }> {
  return new Promise((resolve) => {
    win.webContents.print(
      {
        silent: false,
        printBackground: true,
        margins: {
          marginType: 'custom',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0
        },
        pageSize: {
          width: 80000,
          height: 297000
        }
      },
      (success, failureReason) => {
        const canceled =
          typeof failureReason === 'string' && /cancel/i.test(failureReason)
        resolve({ ok: Boolean(success), canceled })
      }
    )
  })
}

/**
 * Imprime ticket como HTML (notas de venta / fallback).
 * Ventana visible un instante: en Windows el diálogo de impresión falla
 * o no aparece si el BrowserWindow está totalmente oculto.
 */
export async function printTicketHtml(
  ticket: SaleTicketPrint
): Promise<{ ok: boolean; canceled?: boolean }> {
  if (!ticket?.serie) {
    console.error('[MebsyStore] Ticket HTML sin serie')
    return { ok: false }
  }

  const html = buildTicketHtml(ticket)
  const win = new BrowserWindow({
    show: true,
    width: 360,
    height: 640,
    autoHideMenuBar: true,
    title: 'Imprimiendo nota de venta…',
    webPreferences: { sandbox: true }
  })

  try {
    await win.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
    )
    // Delay fijo tras loadURL (evita carrera con did-finish-load)
    await new Promise((r) => setTimeout(r, 150))
    return await runPrintDialog(win)
  } catch (err) {
    console.error('[MebsyStore] Error al imprimir ticket HTML:', err)
    return { ok: false }
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

/**
 * Descarga el PDF ticket de Nubefact y abre el diálogo de impresión.
 * La ventana se muestra un instante: Chromium deja pageSize vacío si el PDF
 * se imprime totalmente oculto.
 */
export async function printPdfFromUrl(
  pdfUrl: string
): Promise<{ ok: boolean; canceled?: boolean }> {
  const url = pdfUrl?.trim()
  if (!url) return { ok: false }

  let tmpPath: string | null = null
  const win = new BrowserWindow({
    show: true,
    width: 420,
    height: 640,
    autoHideMenuBar: true,
    title: 'Imprimiendo comprobante…',
    webPreferences: {
      sandbox: true,
      plugins: true
    }
  })

  try {
    // Descarga en paralelo a la creación de la ventana de impresión
    const download = (async () => {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(30000)
      })
      if (!res.ok) {
        throw new Error(`No se pudo descargar PDF Nubefact (${res.status})`)
      }
      const buf = Buffer.from(await res.arrayBuffer())
      const path = join(
        app.getPath('temp'),
        `mebsy-nubefact-${Date.now()}.pdf`
      )
      await writeFile(path, buf)
      return path
    })()

    tmpPath = await download

    await win.loadURL(pathToFileURL(tmpPath).href)
    // Delay fijo: el plugin PDF de Chromium necesita montar el documento
    await new Promise((r) => setTimeout(r, 280))

    return await runPrintDialog(win)
  } catch (err) {
    console.error('[MebsyStore] Error al imprimir PDF Nubefact:', err)
    return { ok: false }
  } finally {
    if (!win.isDestroyed()) win.destroy()
    if (tmpPath) {
      void unlink(tmpPath).catch(() => undefined)
    }
  }
}
