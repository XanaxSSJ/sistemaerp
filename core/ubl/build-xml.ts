import { create } from 'xmlbuilder2'
import type { Cliente, Empresa, Sucursal, Venta } from './entities'
import type { SaleLineResult } from '../types'

export interface UblBuildInput {
  empresa: Empresa
  sucursal: Sucursal
  cliente: Cliente | null
  venta: Venta
  items: SaleLineResult[]
  igvPorcentaje: number
}

function padCorrelativo(n: number): string {
  return String(n).padStart(8, '0')
}

function clienteTipoDoc(cliente: Cliente | null, tipoComprobante: string): string {
  if (cliente) return cliente.tipoDocumento
  return tipoComprobante === '01' ? '6' : '1'
}

function clienteNumDoc(cliente: Cliente | null): string {
  if (cliente) return cliente.numeroDocumento
  return '00000000'
}

function clienteNombre(cliente: Cliente | null): string {
  if (cliente) return cliente.nombre
  return 'CLIENTES VARIOS'
}

/** Genera XML UBL 2.1 Invoice alineado a catálogos SUNAT (sin firma). */
export function buildUblInvoiceXml(input: UblBuildInput): string {
  const { empresa, venta, items, igvPorcentaje, cliente } = input
  const issueDate = (venta.createdAt ?? new Date().toISOString()).slice(0, 10)
  const invoiceId = `${venta.serie}-${padCorrelativo(venta.correlativo)}`
  const ublVersion = '2.1'
  const customizationId = '2.0'

  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('Invoice', {
      xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
      'xmlns:cac':
        'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
      'xmlns:cbc':
        'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
      'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
      'xmlns:ext':
        'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2'
    })

  doc
    .ele('ext:UBLExtensions')
    .ele('ext:UBLExtension')
    .ele('ext:ExtensionContent')
    .up()
    .up()
    .up()

  doc.ele('cbc:UBLVersionID').txt(ublVersion).up()
  doc.ele('cbc:CustomizationID').txt(customizationId).up()
  doc.ele('cbc:ID').txt(invoiceId).up()
  doc.ele('cbc:IssueDate').txt(issueDate).up()
  doc.ele('cbc:InvoiceTypeCode', { listID: '0101' }).txt(venta.tipoComprobante).up()
  doc.ele('cbc:DocumentCurrencyCode').txt(venta.moneda).up()

  // Emisor
  const supplier = doc.ele('cac:AccountingSupplierParty').ele('cac:Party')
  supplier
    .ele('cac:PartyIdentification')
    .ele('cbc:ID', { schemeID: '6' })
    .txt(empresa.ruc)
    .up()
    .up()
  supplier
    .ele('cac:PartyLegalEntity')
    .ele('cbc:RegistrationName')
    .txt(empresa.razonSocial)
    .up()
    .ele('cac:RegistrationAddress')
    .ele('cbc:AddressTypeCode')
    .txt('0000')
    .up()
    .up()
    .up()
  supplier.up().up()

  // Cliente
  const customer = doc.ele('cac:AccountingCustomerParty').ele('cac:Party')
  customer
    .ele('cac:PartyIdentification')
    .ele('cbc:ID', { schemeID: clienteTipoDoc(cliente, venta.tipoComprobante) })
    .txt(clienteNumDoc(cliente))
    .up()
    .up()
  customer
    .ele('cac:PartyLegalEntity')
    .ele('cbc:RegistrationName')
    .txt(clienteNombre(cliente))
    .up()
    .up()
  customer.up().up()

  // Totales de impuestos
  const taxTotal = doc.ele('cac:TaxTotal')
  taxTotal.ele('cbc:TaxAmount', { currencyID: venta.moneda }).txt(venta.igv.toFixed(2)).up()
  const taxSub = taxTotal.ele('cac:TaxSubtotal')
  taxSub
    .ele('cbc:TaxableAmount', { currencyID: venta.moneda })
    .txt(venta.subtotal.toFixed(2))
    .up()
  taxSub
    .ele('cbc:TaxAmount', { currencyID: venta.moneda })
    .txt(venta.igv.toFixed(2))
    .up()
  const taxCat = taxSub.ele('cac:TaxCategory')
  taxCat.ele('cbc:Percent').txt(String(igvPorcentaje)).up()
  taxCat
    .ele('cac:TaxScheme')
    .ele('cbc:ID')
    .txt('1000')
    .up()
    .ele('cbc:Name')
    .txt('IGV')
    .up()
    .ele('cbc:TaxTypeCode')
    .txt('VAT')
    .up()
    .up()
  taxCat.up()
  taxSub.up()
  taxTotal.up()

  // Legal monetary total
  const legal = doc.ele('cac:LegalMonetaryTotal')
  legal
    .ele('cbc:LineExtensionAmount', { currencyID: venta.moneda })
    .txt(venta.subtotal.toFixed(2))
    .up()
  legal
    .ele('cbc:TaxInclusiveAmount', { currencyID: venta.moneda })
    .txt(venta.total.toFixed(2))
    .up()
  legal
    .ele('cbc:PayableAmount', { currencyID: venta.moneda })
    .txt(venta.total.toFixed(2))
    .up()
  legal.up()

  items.forEach((item, index) => {
    const line = doc.ele('cac:InvoiceLine')
    line.ele('cbc:ID').txt(String(index + 1)).up()
    line
      .ele('cbc:InvoicedQuantity', { unitCode: 'NIU' })
      .txt(String(item.cantidad))
      .up()
    line
      .ele('cbc:LineExtensionAmount', { currencyID: venta.moneda })
      .txt(item.subtotal.toFixed(2))
      .up()

    const pricing = line.ele('cac:PricingReference').ele('cac:AlternativeConditionPrice')
    pricing
      .ele('cbc:PriceAmount', { currencyID: venta.moneda })
      .txt(item.precioUnitario.toFixed(2))
      .up()
    pricing.ele('cbc:PriceTypeCode').txt('01').up()
    pricing.up().up()

    const lineTax = line.ele('cac:TaxTotal')
    lineTax
      .ele('cbc:TaxAmount', { currencyID: venta.moneda })
      .txt(item.igv.toFixed(2))
      .up()
    const lineSub = lineTax.ele('cac:TaxSubtotal')
    lineSub
      .ele('cbc:TaxableAmount', { currencyID: venta.moneda })
      .txt(item.subtotal.toFixed(2))
      .up()
    lineSub
      .ele('cbc:TaxAmount', { currencyID: venta.moneda })
      .txt(item.igv.toFixed(2))
      .up()
    const lineCat = lineSub.ele('cac:TaxCategory')
    lineCat.ele('cbc:Percent').txt(String(igvPorcentaje)).up()
    lineCat.ele('cbc:TaxExemptionReasonCode').txt(item.afectacionIgv).up()
    lineCat
      .ele('cac:TaxScheme')
      .ele('cbc:ID')
      .txt('1000')
      .up()
      .ele('cbc:Name')
      .txt('IGV')
      .up()
      .ele('cbc:TaxTypeCode')
      .txt('VAT')
      .up()
      .up()
    lineCat.up()
    lineSub.up()
    lineTax.up()

    line
      .ele('cac:Item')
      .ele('cbc:Description')
      .txt(item.descripcion)
      .up()
      .ele('cac:SellersItemIdentification')
      .ele('cbc:ID')
      .txt(item.codigo)
      .up()
      .up()
      .up()

    line
      .ele('cac:Price')
      .ele('cbc:PriceAmount', { currencyID: venta.moneda })
      .txt((item.subtotal / item.cantidad).toFixed(2))
      .up()
      .up()

    line.up()
  })

  return doc.end({ prettyPrint: true })
}

export function buildQrPayload(input: UblBuildInput): string {
  const { empresa, venta, cliente } = input
  const parts = [
    empresa.ruc,
    venta.tipoComprobante,
    venta.serie,
    padCorrelativo(venta.correlativo),
    venta.igv.toFixed(2),
    venta.total.toFixed(2),
    (venta.createdAt ?? new Date().toISOString()).slice(0, 10),
    clienteTipoDoc(cliente, venta.tipoComprobante),
    clienteNumDoc(cliente)
  ]
  return parts.join('|')
}
