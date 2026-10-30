import type {
  InventoryImportRow,
  InventoryMotivo,
  InventoryMovementTipo
} from '@core/types'

const HEADERS = ['SKU*', 'Cantidad*'] as const

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\*/g, '')
}

const HEADER_MAP: Record<string, 'sku' | 'cantidad'> = {
  sku: 'sku',
  codigo: 'sku',
  cantidad: 'cantidad',
  qty: 'cantidad',
  quantity: 'cantidad'
}

/** Solo 2 opciones en el combo; el motivo canónico va al API. */
export const MOVIMIENTO_OPTIONS: Array<{
  tipo: InventoryMovementTipo
  label: string
  motivo: InventoryMotivo
}> = [
  {
    tipo: 'entrada',
    label: 'Entrada (Compra/Devolución)',
    motivo: 'compra'
  },
  {
    tipo: 'salida',
    label: 'Salida (Cambio/Merma)',
    motivo: 'cambio'
  }
]

export function labelFromTipo(
  tipo: string | null | undefined,
  motivo?: string | null,
  origen?: string | null
): string {
  if (origen === 'transferencia') {
    return tipo === 'entrada'
      ? 'Entrada (Transferencia)'
      : 'Salida (Transferencia)'
  }
  if (origen === 'venta' || tipo === 'venta') {
    return 'Salida (Venta)'
  }
  const byTipo = MOVIMIENTO_OPTIONS.find((o) => o.tipo === tipo)
  if (byTipo) return byTipo.label
  if (motivo === 'compra' || motivo === 'devolucion') {
    return 'Entrada (Compra/Devolución)'
  }
  if (motivo === 'cambio' || motivo === 'merma' || motivo === 'venta') {
    // `venta` en motivo + origen manual/masivo = salidas antiguas de ajuste
    return 'Salida (Cambio/Merma)'
  }
  return tipo === 'entrada'
    ? 'Entrada (Compra/Devolución)'
    : tipo === 'salida'
      ? 'Salida (Cambio/Merma)'
      : '—'
}

export function motivoFromTipo(tipo: InventoryMovementTipo): InventoryMotivo {
  return (
    MOVIMIENTO_OPTIONS.find((o) => o.tipo === tipo)?.motivo ??
    (tipo === 'salida' ? 'cambio' : 'compra')
  )
}

export async function downloadInventoryTemplate(): Promise<void> {
  const XLSX = await import('xlsx')
  const example = ['SKU-001', '10']
  const example2 = ['SKU-002', '5']
  const sheet = XLSX.utils.aoa_to_sheet([
    HEADERS as unknown as string[],
    example,
    example2
  ])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Ajuste')
  XLSX.writeFile(book, 'plantilla-ajuste-inventario-mebsystore.xlsx')
}

export async function parseInventoryImportFile(
  file: File
): Promise<InventoryImportRow[]> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const book = XLSX.read(buffer, { type: 'array' })
  const sheet = book.Sheets[book.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: ''
  })

  const rows: InventoryImportRow[] = []
  raw.forEach((item, index) => {
    const mapped: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(item)) {
      const field = HEADER_MAP[normalizeHeader(key)]
      if (field) mapped[field] = value
    }

    const sku = String(mapped.sku ?? '').trim()
    if (!sku && (mapped.cantidad === '' || mapped.cantidad == null)) return

    rows.push({
      row: index + 2,
      sku,
      cantidad: mapped.cantidad as string | number
    })
  })

  return rows
}
