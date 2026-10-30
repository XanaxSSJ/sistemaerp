import { BrowserWindow, app } from 'electron'
import { writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { SaleTicketPrint } from '../../core/types'
import { amountInWordsPen } from './amount-in-words'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(n: number): string {
  return `S/ ${n.toFixed(2)}`
}

function pad(n: number): string {
  return String(n).padStart(8, '0')
}

function up(value: string): string {
  return value.trim().toUpperCase()
}

function tipoLabel(tipo: string): string {
  if (tipo === '01') return 'FACTURA ELECTRONICA'
  if (tipo === '03') return 'BOLETA ELECTRONICA'
  return 'NOTA DE VENTA'
}

function pagoLabel(metodo: string): string {
  return `${up(metodo || 'EFECTIVO')} (CONTADO)`
}

function labeled(label: string, value: string): string {
  return `<div class="row"><span class="lbl">${escapeHtml(label)}:</span> ${escapeHtml(value)}</div>`
}

function buildTicketHtml(ticket: SaleTicketPrint): string {
  const esNv = ticket.tipoComprobante === 'NV'
  const fecha = up((ticket.createdAt || '').slice(0, 19).replace('T', ' '))
  const clienteNombre = up(ticket.clienteNombre || 'CLIENTES VARIOS')
  const pago = pagoLabel(ticket.metodoPago)

  const itemsHtml = ticket.items
    .map((item) => {
      const um = up(item.unidad || 'NIU')
      const sku = up(item.codigo || '')
      return `
      <tr>
        <td class="cant">${escapeHtml(String(item.cantidad))}</td>
        <td class="desc">
          ${escapeHtml(up(item.descripcion))}<br/>
          <span class="meta">UM: ${escapeHtml(um)}${sku ? ` &nbsp; COD: ${escapeHtml(sku)}` : ''}</span>
        </td>
        <td class="num">${escapeHtml(money(item.precioUnitario))}</td>
        <td class="num">${escapeHtml(money(item.total))}</td>
      </tr>`
    })
    .join('')

  const qrSection =
    !esNv && ticket.qr?.startsWith('data:image')
      ? `<div class="qr"><img src="${ticket.qr.replace(/"/g, '')}" width="120" height="120" alt="QR" /></div>`
      : ''

  const foot = esNv
    ? 'Documento interno — no válido para SUNAT<br/>MebsyCore'
    : 'Representación impresa del comprobante electrónico<br/>MebsyCore — SEE del contribuyente'

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Ticket ${escapeHtml(ticket.serie)}-${pad(ticket.correlativo)}</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0; width: 74mm;
      background: #fff; color: #111;
      font: 10px/1.35 Helvetica, Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .wrap { padding: 2mm; width: 74mm; }
    .c { text-align: center; }
    .b { font-weight: 700; }
    .muted { font-size: 9px; color: #333; }
    .sep { margin: 6px 0; border-top: 1px solid #222; }
    .row { margin: 1px 0; word-break: break-word; }
    .lbl { font-weight: 700; }
    table.items { width: 100%; border-collapse: collapse; table-layout: fixed; }
    table.items th {
      font-size: 8px; font-weight: 700; text-align: left;
      padding: 0 0 3px; border: 0;
    }
    table.items th.num, table.items td.num { text-align: right; }
    table.items td { vertical-align: top; padding: 2px 0 4px; font-size: 9px; }
    table.items td.cant { width: 12%; }
    table.items td.desc { width: 46%; }
    table.items td.num { width: 21%; }
    .meta { font-size: 8px; color: #333; }
    .totales { width: 100%; margin-top: 2px; }
    .totales .line {
      display: flex; justify-content: space-between; gap: 8px; margin: 2px 0;
    }
    .totales .total { font-weight: 700; font-size: 11px; }
    .foot { margin-top: 8px; font-size: 8px; text-align: center; color: #333; }
    .qr { margin-top: 8px; text-align: center; }
    .qr img { display: inline-block; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="c b" style="font-size:12px">${escapeHtml(ticket.empresaNombre || ticket.empresaRazonSocial)}</div>
    <div class="c muted">${escapeHtml(ticket.empresaRazonSocial)}</div>
    <div class="c">RUC: ${escapeHtml(ticket.empresaRuc)}</div>
    <div class="c">${escapeHtml(ticket.sucursalNombre)}</div>
    <div class="c muted">${escapeHtml(ticket.sucursalDireccion)}</div>
    <div style="height:6px"></div>
    <div class="c b">${escapeHtml(tipoLabel(String(ticket.tipoComprobante)))}</div>
    <div class="c b">${escapeHtml(up(ticket.serie))}-${pad(ticket.correlativo)}</div>
    <div style="height:6px"></div>
    ${labeled('CLIENTE', clienteNombre)}
    ${
      ticket.clienteDocumento
        ? labeled('DOC', up(ticket.clienteDocumento))
        : ''
    }
    ${labeled('FECHA', fecha)}
    ${labeled('MONEDA', 'PEN')}
    ${labeled('FORMA DE PAGO', pago)}
    <div class="sep"></div>
    <table class="items">
      <thead>
        <tr>
          <th>CANT.</th>
          <th>DESCRIPCION</th>
          <th class="num">P/U</th>
          <th class="num">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    <div class="sep"></div>
    <div class="totales">
      <div class="line"><span>GRAVADA</span><span>${escapeHtml(money(ticket.subtotal))}</span></div>
      <div class="line"><span>IGV</span><span>${escapeHtml(money(ticket.igv))}</span></div>
      <div class="line total"><span>TOTAL</span><span>${escapeHtml(money(ticket.total))}</span></div>
    </div>
    <div class="sep"></div>
    ${labeled('IMPORTE EN LETRAS', amountInWordsPen(ticket.total))}
    ${labeled('FORMAS DE PAGO', pago)}
    <div class="foot">${foot}</div>
    ${qrSection}
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
    console.error('[MebsyCore] Ticket HTML sin serie')
    return { ok: false }
  }

  const withQr = await enrichTicketQr(ticket)
  const html = buildTicketHtml(withQr)
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
    await new Promise((r) => setTimeout(r, 150))
    return await runPrintDialog(win)
  } catch (err) {
    console.error('[MebsyCore] Error al imprimir ticket HTML:', err)
    return { ok: false }
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

/** Si hay payload QR texto, lo convierte a data URL PNG. */
async function enrichTicketQr(
  ticket: SaleTicketPrint
): Promise<SaleTicketPrint> {
  const raw = ticket.qr?.trim()
  if (!raw || raw.startsWith('data:image')) return ticket
  try {
    const QRCode = (await import('qrcode')).default
    const dataUrl = await QRCode.toDataURL(raw, {
      margin: 1,
      width: 160,
      errorCorrectionLevel: 'M'
    })
    return { ...ticket, qr: dataUrl }
  } catch {
    return { ...ticket, qr: null }
  }
}

async function printPdfBuffer(
  buf: Buffer
): Promise<{ ok: boolean; canceled?: boolean }> {
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
    tmpPath = join(app.getPath('temp'), `mebsy-cpe-${Date.now()}.pdf`)
    await writeFile(tmpPath, buf)
    await win.loadURL(pathToFileURL(tmpPath).href)
    await new Promise((r) => setTimeout(r, 280))
    return await runPrintDialog(win)
  } catch (err) {
    console.error('[MebsyCore] Error al imprimir PDF:', err)
    return { ok: false }
  } finally {
    if (!win.isDestroyed()) win.destroy()
    if (tmpPath) {
      void unlink(tmpPath).catch(() => undefined)
    }
  }
}

/** Descarga PDF por URL pública e imprime. */
export async function printPdfFromUrl(
  pdfUrl: string
): Promise<{ ok: boolean; canceled?: boolean }> {
  const url = pdfUrl?.trim()
  if (!url) return { ok: false }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return printPdfBuffer(Buffer.from(await res.arrayBuffer()))
  } catch (err) {
    console.error('[MebsyCore] Error al descargar PDF:', err)
    return { ok: false }
  }
}

/** Imprime PDF ya descargado (API autenticada). */
export async function printPdfFromBuffer(
  buf: Buffer
): Promise<{ ok: boolean; canceled?: boolean }> {
  return printPdfBuffer(buf)
}
