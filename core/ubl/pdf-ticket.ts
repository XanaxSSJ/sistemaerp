import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import { createWriteStream } from 'node:fs'
import { once } from 'node:events'
import type { Cliente, Empresa, Sucursal, Venta } from './entities'
import { formatPen } from '../money'
import type { SaleLineResult } from '../types'

export interface PdfTicketInput {
  empresa: Empresa
  sucursal: Sucursal
  cliente: Cliente | null
  venta: Venta
  items: SaleLineResult[]
  qrPayload: string
  outputPath: string
}

function pad(n: number): string {
  return String(n).padStart(8, '0')
}

export async function writeTicketPdf(input: PdfTicketInput): Promise<void> {
  const { empresa, sucursal, cliente, venta, items, qrPayload, outputPath } =
    input

  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    margin: 1,
    width: 140
  })
  const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '')
  const qrBuffer = Buffer.from(qrBase64, 'base64')

  const doc = new PDFDocument({
    size: [226, 600],
    margin: 16
  })

  const stream = createWriteStream(outputPath)
  doc.pipe(stream)

  doc.fontSize(12).font('Helvetica-Bold').text(empresa.nombreComercial, {
    align: 'center'
  })
  doc.fontSize(8).font('Helvetica').text(empresa.razonSocial, { align: 'center' })
  doc.text(`RUC: ${empresa.ruc}`, { align: 'center' })
  doc.text(sucursal.nombre, { align: 'center' })
  doc.text(sucursal.direccion, { align: 'center' })
  doc.moveDown(0.5)

  const esNv = venta.tipoComprobante === 'NV'
  const tipo =
    venta.tipoComprobante === '01'
      ? 'FACTURA ELECTRÓNICA'
      : venta.tipoComprobante === '03'
        ? 'BOLETA ELECTRÓNICA'
        : 'NOTA DE VENTA'
  doc.font('Helvetica-Bold').text(tipo, { align: 'center' })
  doc
    .font('Helvetica')
    .text(`${venta.serie}-${pad(venta.correlativo)}`, { align: 'center' })
  doc.moveDown(0.5)

  doc.text(`Fecha: ${(venta.createdAt ?? '').slice(0, 19).replace('T', ' ')}`)
  doc.text(`Cliente: ${cliente?.nombre ?? 'CLIENTES VARIOS'}`)
  if (cliente && !esNv) {
    doc.text(`Doc: ${cliente.tipoDocumento} ${cliente.numeroDocumento}`)
  }
  doc.moveDown(0.4)
  doc.text('--------------------------------')

  for (const item of items) {
    doc.text(`${item.cantidad} x ${item.descripcion}`)
    doc.text(
      `${formatPen(item.precioUnitario)}  →  ${formatPen(item.total)}`,
      { align: 'right' }
    )
  }

  doc.text('--------------------------------')
  doc.text(`Op. gravada: ${formatPen(venta.subtotal)}`)
  doc.text(`IGV: ${formatPen(venta.igv)}`)
  doc.font('Helvetica-Bold').text(`TOTAL: ${formatPen(venta.total)}`)
  doc.font('Helvetica').text(`Pago: ${venta.metodoPago}`)
  doc.moveDown(0.5)

  doc.image(qrBuffer, {
    fit: [120, 120],
    align: 'center'
  })
  doc.moveDown(0.3)
  doc.fontSize(7).text(
    esNv
      ? 'Documento interno — no válido para SUNAT'
      : 'Representación impresa del comprobante electrónico',
    {
      align: 'center'
    }
  )
  doc.text('MebsyStore — documento generado localmente', { align: 'center' })

  doc.end()
  await once(stream, 'finish')
}
