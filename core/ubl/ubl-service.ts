import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Cliente, Empresa, Sucursal, Venta } from './entities'
import { sha256Hex } from '../crypto'
import type { SaleLineResult } from '../types'
import { buildQrPayload, buildUblInvoiceXml } from './build-xml'
import { writeTicketPdf } from './pdf-ticket'

export interface InvoiceDocumentPaths {
  xmlPath: string | null
  pdfPath: string | null
  hash: string | null
}

export interface GenerateInvoiceInput {
  empresa: Empresa
  sucursal: Sucursal
  cliente: Cliente | null
  venta: Venta
  items: SaleLineResult[]
  igvPorcentaje: number
}

/** Stub para envío futuro a SUNAT/OSE. */
export interface ISunatSender {
  send(xmlPath: string): Promise<{ accepted: boolean; cdrPath?: string }>
}

export class LocalOnlySunatSender implements ISunatSender {
  async send(): Promise<{ accepted: boolean }> {
    return { accepted: false }
  }
}

export class UblInvoiceService {
  constructor(private readonly documentsDir: string) {
    mkdirSync(documentsDir, { recursive: true })
  }

  generateAndPersist(input: GenerateInvoiceInput): InvoiceDocumentPaths {
    const xml = buildUblInvoiceXml(input)
    const hash = sha256Hex(xml)
    const baseName = `${input.venta.serie}-${String(input.venta.correlativo).padStart(8, '0')}`
    const folder = join(
      this.documentsDir,
      String(input.venta.sucursalId),
      input.venta.tipoComprobante
    )
    mkdirSync(folder, { recursive: true })

    const xmlPath = join(folder, `${baseName}.xml`)
    const pdfPath = join(folder, `${baseName}.pdf`)

    writeFileSync(xmlPath, xml, 'utf8')

    const qrPayload = buildQrPayload(input)
    // PDF async se resuelve de forma síncrona vía deasync-like: lanzamos y esperamos en caller
    // Para mantener API sync del sale service, escribimos PDF en fire-and-forget controlado.
    void writeTicketPdf({
      ...input,
      qrPayload,
      outputPath: pdfPath
    }).catch((err) => {
      console.error('Error escribiendo PDF:', err)
    })

    return { xmlPath, pdfPath, hash }
  }

  async generateAndPersistAsync(
    input: GenerateInvoiceInput
  ): Promise<InvoiceDocumentPaths> {
    const xml = buildUblInvoiceXml(input)
    const hash = sha256Hex(xml)
    const baseName = `${input.venta.serie}-${String(input.venta.correlativo).padStart(8, '0')}`
    const folder = join(
      this.documentsDir,
      String(input.venta.sucursalId),
      input.venta.tipoComprobante
    )
    mkdirSync(folder, { recursive: true })

    const xmlPath = join(folder, `${baseName}.xml`)
    const pdfPath = join(folder, `${baseName}.pdf`)

    writeFileSync(xmlPath, xml, 'utf8')
    await writeTicketPdf({
      ...input,
      qrPayload: buildQrPayload(input),
      outputPath: pdfPath
    })

    return { xmlPath, pdfPath, hash }
  }

  /** Solo ticket PDF (notas de venta / copia de impresión). */
  async generateTicketOnly(
    input: GenerateInvoiceInput
  ): Promise<{ pdfPath: string }> {
    const baseName = `${input.venta.serie}-${String(input.venta.correlativo).padStart(8, '0')}`
    const folder = join(
      this.documentsDir,
      String(input.venta.sucursalId),
      input.venta.tipoComprobante
    )
    mkdirSync(folder, { recursive: true })
    const pdfPath = join(folder, `${baseName}.pdf`)
    await writeTicketPdf({
      ...input,
      qrPayload: buildQrPayload(input),
      outputPath: pdfPath
    })
    return { pdfPath }
  }
}
