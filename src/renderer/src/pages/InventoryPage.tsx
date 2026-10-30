import { FormEvent, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type {
  InventoryImportValidateResult,
  InventoryMovementTipo,
  InventoryStockEstado,
  InventoryStockRow
} from '@core/types'
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  Td,
  Textarea,
  Th
} from '../components/ui'
import { useRealtimeRefresh } from '../hooks/useRealtime'
import { parseIpcError } from '../lib/errors'
import {
  downloadInventoryTemplate,
  motivoFromTipo,
  MOVIMIENTO_OPTIONS,
  parseInventoryImportFile
} from '../lib/inventory-import'
import { useSession } from '../store/session'

type StockResponse = {
  items: InventoryStockRow[]
  total: number
  page: number
  pageSize: number
}

function estadoBadge(estado: InventoryStockRow['estado']) {
  if (estado === 'bajo') return <Badge tone="danger">Bajo</Badge>
  if (estado === 'medio') return <Badge tone="warn">Medio</Badge>
  return <Badge tone="ok">Normal</Badge>
}

export function InventoryPage() {
  const { sucursal } = useSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const estadoParam = searchParams.get('estado')
  const estadoFiltro: InventoryStockEstado | '' =
    estadoParam === 'bajo' ||
    estadoParam === 'medio' ||
    estadoParam === 'normal'
      ? estadoParam
      : ''
  const [items, setItems] = useState<InventoryStockRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustTarget, setAdjustTarget] = useState<InventoryStockRow | null>(
    null
  )
  const [tipo, setTipo] = useState<InventoryMovementTipo>('entrada')
  const [cantidad, setCantidad] = useState('1')
  const [observaciones, setObservaciones] = useState('')
  const [saving, setSaving] = useState(false)

  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkTipo, setBulkTipo] = useState<InventoryMovementTipo>('entrada')
  const [bulkObs, setBulkObs] = useState('')
  const [bulkFile, setBulkFile] = useState<File | null>(null)
  const [bulkRows, setBulkRows] = useState<
    Array<{ row: number; sku: string; cantidad: number | string }>
  >([])
  const [validateResult, setValidateResult] =
    useState<InventoryImportValidateResult | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkResultMsg, setBulkResultMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function reload(
    nextPage = page,
    q = query,
    estado: InventoryStockEstado | '' = estadoFiltro
  ) {
    if (!sucursal) return
    setLoading(true)
    setError('')
    try {
      const data = (await window.mebsy.inventory.stock({
        sucursalId: sucursal.id,
        q: q || undefined,
        estado: estado || undefined,
        page: nextPage,
        pageSize
      })) as StockResponse
      setItems(data.items)
      setTotal(data.total)
      setPage(data.page)
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload(1, query, estadoFiltro)
  }, [sucursal?.id, estadoFiltro])

  useRealtimeRefresh(['stock.updated', 'product.changed'], () => {
    void reload(page, query, estadoFiltro)
  })

  function setEstadoFiltro(next: InventoryStockEstado | '') {
    const params = new URLSearchParams(searchParams)
    if (next) params.set('estado', next)
    else params.delete('estado')
    setSearchParams(params, { replace: true })
  }

  function openAdjust(row: InventoryStockRow) {
    setAdjustTarget(row)
    setTipo('entrada')
    setCantidad('1')
    setObservaciones('')
    setError('')
    setAdjustOpen(true)
  }

  async function submitAdjust(e: FormEvent) {
    e.preventDefault()
    if (!sucursal || !adjustTarget) return
    setSaving(true)
    setError('')
    try {
      await window.mebsy.inventory.adjust({
        productoId: adjustTarget.id,
        sucursalId: sucursal.id,
        tipo,
        motivo: motivoFromTipo(tipo),
        cantidad: Number(cantidad),
        observaciones: observaciones.trim() || null
      })
      setMsg('Movimiento registrado')
      setAdjustOpen(false)
      await reload(page, query)
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setSaving(false)
    }
  }

  async function onPickFile(file: File | null) {
    setBulkFile(file)
    setValidateResult(null)
    setBulkResultMsg('')
    setBulkRows([])
    if (!file || !sucursal) return
    setBulkBusy(true)
    setError('')
    try {
      const rows = await parseInventoryImportFile(file)
      setBulkRows(rows)
      const result = (await window.mebsy.inventory.importValidate({
        sucursalId: sucursal.id,
        tipo: bulkTipo,
        motivo: motivoFromTipo(bulkTipo),
        rows
      })) as InventoryImportValidateResult
      setValidateResult(result)
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setBulkBusy(false)
    }
  }

  async function revalidateBulk() {
    if (!sucursal || !bulkRows.length) return
    setBulkBusy(true)
    try {
      const result = (await window.mebsy.inventory.importValidate({
        sucursalId: sucursal.id,
        tipo: bulkTipo,
        motivo: motivoFromTipo(bulkTipo),
        rows: bulkRows
      })) as InventoryImportValidateResult
      setValidateResult(result)
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setBulkBusy(false)
    }
  }

  async function runBulkImport() {
    if (!sucursal || !bulkRows.length) return
    setBulkBusy(true)
    setError('')
    setBulkResultMsg('')
    try {
      const result = (await window.mebsy.inventory.import({
        sucursalId: sucursal.id,
        tipo: bulkTipo,
        motivo: motivoFromTipo(bulkTipo),
        observaciones: bulkObs.trim() || null,
        idempotencyKey: crypto.randomUUID(),
        rows: bulkRows
      })) as {
        lote: { codigo: string }
        movimientosRegistrados: number
        productosProcesados: number
      }
      setBulkResultMsg(
        `Lote ${result.lote.codigo}: ${result.movimientosRegistrados} movimientos · ${result.productosProcesados} productos`
      )
      setMsg(`Ajuste masivo registrado (${result.lote.codigo})`)
      setValidateResult(null)
      setBulkFile(null)
      setBulkRows([])
      await reload(1, query)
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setBulkBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div>
      <PageHeader
        title="Inventario"
        subtitle={sucursal?.nombre ?? ''}
        actions={
          <Button type="button" onClick={() => setBulkOpen(true)}>
            Ajuste masivo
          </Button>
        }
      />

      <div className="mb-4 space-y-2">
        {error ? <Alert>{error}</Alert> : null}
        {msg ? <Alert tone="ok">{msg}</Alert> : null}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-[var(--ms-line)] bg-[var(--ms-panel)] p-3 sm:flex-row sm:items-center">
          <Input
            className="flex-1"
            placeholder="Buscar por nombre, SKU o código de barras…"
            value={query}
            onChange={(e) => {
              const v = e.target.value
              setQuery(v)
              setPage(1)
              void reload(1, v, estadoFiltro)
            }}
          />
          <Select
            className="sm:w-44"
            value={estadoFiltro}
            onChange={(e) => {
              const v = e.target.value as InventoryStockEstado | ''
              setPage(1)
              setEstadoFiltro(v)
            }}
            aria-label="Filtrar por estado de stock"
          >
            <option value="">Todos los estados</option>
            <option value="bajo">Stock bajo</option>
            <option value="medio">Stock medio</option>
            <option value="normal">Stock normal</option>
          </Select>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-[var(--ms-muted)]">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-sm text-[var(--ms-muted)]">
            {query || estadoFiltro
              ? 'Sin resultados para los filtros aplicados.'
              : 'No hay productos en el inventario.'}
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Producto</Th>
                <Th>SKU</Th>
                <Th>Stock actual</Th>
                <Th>Estado</Th>
                <Th>Ajuste</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <Td>{p.nombre}</Td>
                  <Td className="font-mono text-xs">{p.codigo}</Td>
                  <Td className="font-mono font-semibold">{p.stock}</Td>
                  <Td>{estadoBadge(p.estado)}</Td>
                  <Td>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => openAdjust(p)}
                    >
                      Ajustar
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        {total > pageSize ? (
          <div className="flex items-center justify-between border-t border-[var(--ms-line)] px-3 py-2 text-sm">
            <span className="text-[var(--ms-muted)]">
              {total} productos · pág. {page}/{totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => void reload(page - 1, query)}
              >
                Anterior
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => void reload(page + 1, query)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent
          title="Ajuste de stock"
          description="Registrar movimiento manual"
          className="w-[min(480px,calc(100vw-2rem))]"
        >
          {adjustTarget ? (
            <form className="space-y-3" onSubmit={submitAdjust}>
              <div className="rounded-[6px] border border-[var(--ms-line)] bg-[var(--ms-panel)] p-3 text-sm">
                <div className="font-semibold text-[var(--ms-ink)]">
                  {adjustTarget.nombre}
                </div>
                <div className="mt-1 font-mono text-xs text-[var(--ms-muted)]">
                  SKU {adjustTarget.codigo}
                  {adjustTarget.codigoBarras
                    ? ` · ${adjustTarget.codigoBarras}`
                    : ''}
                </div>
                <div className="mt-1">
                  Stock actual:{' '}
                  <span className="font-mono font-semibold">
                    {adjustTarget.stock}
                  </span>
                </div>
                <div className="mt-1 text-[var(--ms-muted)]">
                  Sucursal: {sucursal?.nombre}
                </div>
              </div>

              <Field label="Tipo de movimiento">
                <Select
                  value={tipo}
                  onChange={(e) =>
                    setTipo(e.target.value as InventoryMovementTipo)
                  }
                  required
                >
                  {MOVIMIENTO_OPTIONS.map((o) => (
                    <option key={o.tipo} value={o.tipo}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Cantidad">
                <Input
                  type="number"
                  min={0.001}
                  step="any"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  required
                />
              </Field>

              <Field label="Observaciones">
                <Textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={2}
                  placeholder="Detalle opcional…"
                />
              </Field>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => setAdjustOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Guardando…' : 'Registrar movimiento'}
                </Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent
          title="Ajuste masivo"
          description="Importar movimientos desde Excel o CSV"
          className="w-[min(640px,calc(100vw-2rem))]"
        >
          <div className="mb-4 space-y-2 rounded-[6px] border border-[var(--ms-line)] bg-[var(--ms-panel)] p-3 text-sm text-[var(--ms-muted)]">
            <p className="font-semibold text-[var(--ms-ink)]">
              Instrucciones para el ajuste masivo
            </p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>
                Descarga la plantilla con las columnas requeridas: SKU y
                Cantidad.
              </li>
              <li>
                Completa el archivo con los SKU de los productos y las
                cantidades correspondientes.
              </li>
              <li>
                Selecciona el tipo de movimiento: Entrada (Compra/Devolución) o
                Salida (Cambio/Merma).
              </li>
              <li>
                Selecciona el archivo y revisa los datos antes de confirmar la
                operación.
              </li>
              <li>
                Los SKU deben existir en el catálogo y corresponder al
                inventario de la sucursal activa.
              </li>
            </ol>
          </div>

          <div className="mb-3 rounded-[6px] border border-[var(--ms-line)] px-3 py-2 text-sm">
            Sucursal activa:{' '}
            <span className="font-semibold">{sucursal?.nombre}</span>
          </div>

          <div className="mb-3">
            <Field label="Tipo de movimiento">
              <Select
                value={bulkTipo}
                onChange={(e) => {
                  setBulkTipo(e.target.value as InventoryMovementTipo)
                  setValidateResult(null)
                }}
              >
                {MOVIMIENTO_OPTIONS.map((o) => (
                  <option key={o.tipo} value={o.tipo}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Observaciones del lote">
            <Textarea
              value={bulkObs}
              onChange={(e) => setBulkObs(e.target.value)}
              rows={2}
              placeholder="Opcional…"
            />
          </Field>

          <div className="mb-4 mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void downloadInventoryTemplate()}
            >
              Descargar plantilla
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileRef.current?.click()}
            >
              Seleccionar archivo
            </Button>
            {bulkRows.length ? (
              <Button
                type="button"
                variant="secondary"
                disabled={bulkBusy}
                onClick={() => void revalidateBulk()}
              >
                Revalidar
              </Button>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {bulkFile ? (
            <div className="mb-3 flex items-center justify-between rounded-[6px] border border-[var(--ms-line)] px-3 py-2 text-sm">
              <div>
                <div className="font-medium">{bulkFile.name}</div>
                <div className="text-xs text-[var(--ms-muted)]">
                  {(bulkFile.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void onPickFile(null)}
              >
                Quitar
              </Button>
            </div>
          ) : null}

          {validateResult ? (
            <div className="mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                <div className="rounded-[6px] border border-[var(--ms-line)] p-2">
                  <div className="text-[10px] uppercase text-[var(--ms-muted)]">
                    Filas
                  </div>
                  <div className="font-mono font-semibold">
                    {validateResult.total}
                  </div>
                </div>
                <div className="rounded-[6px] border border-[var(--ms-line)] p-2">
                  <div className="text-[10px] uppercase text-[var(--ms-muted)]">
                    Válidos
                  </div>
                  <div className="font-mono font-semibold text-[var(--ms-ok)]">
                    {validateResult.valid}
                  </div>
                </div>
                <div className="rounded-[6px] border border-[var(--ms-line)] p-2">
                  <div className="text-[10px] uppercase text-[var(--ms-muted)]">
                    Errores
                  </div>
                  <div className="font-mono font-semibold text-[var(--ms-danger)]">
                    {validateResult.invalid}
                  </div>
                </div>
                <div className="rounded-[6px] border border-[var(--ms-line)] p-2">
                  <div className="text-[10px] uppercase text-[var(--ms-muted)]">
                    SKU no hallados
                  </div>
                  <div className="font-mono font-semibold">
                    {validateResult.skuNotFound}
                  </div>
                </div>
                <div className="rounded-[6px] border border-[var(--ms-line)] p-2">
                  <div className="text-[10px] uppercase text-[var(--ms-muted)]">
                    Cant. inválidas
                  </div>
                  <div className="font-mono font-semibold">
                    {validateResult.invalidQty}
                  </div>
                </div>
                <div className="rounded-[6px] border border-[var(--ms-line)] p-2">
                  <div className="text-[10px] uppercase text-[var(--ms-muted)]">
                    Stock insuf.
                  </div>
                  <div className="font-mono font-semibold">
                    {validateResult.insufficientStock}
                  </div>
                </div>
              </div>

              {validateResult.errors.length ? (
                <div className="max-h-40 overflow-auto rounded-[6px] border border-[var(--ms-line)]">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Fila</Th>
                        <Th>SKU</Th>
                        <Th>Error</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {validateResult.errors.map((err, i) => (
                        <tr key={`${err.row}-${err.field}-${i}`}>
                          <Td className="font-mono text-xs">{err.row}</Td>
                          <Td className="font-mono text-xs">{err.sku || '—'}</Td>
                          <Td className="text-[var(--ms-danger)]">
                            {err.message}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : null}
            </div>
          ) : null}

          {bulkResultMsg ? <Alert tone="ok">{bulkResultMsg}</Alert> : null}

          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={bulkBusy}
              onClick={() => setBulkOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                bulkBusy ||
                !validateResult ||
                validateResult.invalid > 0 ||
                validateResult.valid === 0
              }
              onClick={() => void runBulkImport()}
            >
              {bulkBusy ? 'Procesando…' : 'Importar y registrar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
