export type ImportRow = {
  row: number
  nombre: string
  sku: string
  codigoBarras: string | null
  descripcion: string | null
  precio: number | string
  categoria: string
  marca: string
}

const HEADERS = [
  'Nombre*',
  'SKU*',
  'Código de barras',
  'Descripción',
  'Precio*',
  'Categoría*',
  'Marca*'
] as const

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\*/g, '')
}

const HEADER_MAP: Record<string, keyof Omit<ImportRow, 'row'>> = {
  nombre: 'nombre',
  sku: 'sku',
  'codigo de barras': 'codigoBarras',
  'codigo barras': 'codigoBarras',
  barcode: 'codigoBarras',
  descripcion: 'descripcion',
  precio: 'precio',
  categoria: 'categoria',
  marca: 'marca'
}

export async function downloadProductTemplate(): Promise<void> {
  const XLSX = await import('xlsx')
  const example = [
    'Ejemplo Producto',
    'SKU-001',
    '7750000000000',
    'Fila de ejemplo — reemplazar o eliminar',
    '10.50',
    'General',
    'Sin marca'
  ]
  const sheet = XLSX.utils.aoa_to_sheet([HEADERS as unknown as string[], example])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Productos')
  XLSX.writeFile(book, 'plantilla-productos-mebsystore.xlsx')
}

export async function parseProductImportFile(file: File): Promise<ImportRow[]> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const book = XLSX.read(buffer, { type: 'array' })
  const sheet = book.Sheets[book.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: ''
  })

  const rows: ImportRow[] = []
  raw.forEach((item, index) => {
    const mapped: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(item)) {
      const field = HEADER_MAP[normalizeHeader(key)]
      if (field) mapped[field] = value
    }

    const nombre = String(mapped.nombre ?? '').trim()
    const sku = String(mapped.sku ?? '').trim()
    const descripcion = String(mapped.descripcion ?? '').trim()
    // Saltar fila de ejemplo de la plantilla
    if (
      descripcion.toLowerCase().includes('fila de ejemplo') ||
      (!nombre && !sku)
    ) {
      return
    }

    rows.push({
      row: index + 2,
      nombre,
      sku,
      codigoBarras: String(mapped.codigoBarras ?? '').trim() || null,
      descripcion: descripcion || null,
      precio: mapped.precio as string | number,
      categoria: String(mapped.categoria ?? '').trim(),
      marca: String(mapped.marca ?? '').trim()
    })
  })

  return rows
}
