import { useEffect, useState } from 'react'
import type {
  InventoryLot,
  InventoryMovementRow,
  InventoryMovementTipo
} from '@core/types'
import {
  Alert,
  Badge,
  Button,
  Card,
  DateInput,
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  Td,
  Th
} from '../components/ui'
import { parseIpcError } from '../lib/errors'
import { labelFromTipo } from '../lib/inventory-import'
import { useSession } from '../store/session'

type MovementsResponse = {
  items: InventoryMovementRow[]
  total: number
  page: number
  pageSize: number
  kpis: { entradas: number; salidas: number }
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function InventoryReportPage() {
  const { sucursal } = useSession()
  const [items, setItems] = useState<InventoryMovementRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [kpis, setKpis] = useState({ entradas: 0, salidas: 0 })
  const [lots, setLots] = useState<InventoryLot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [lote, setLote] = useState('')
  const [tipo, setTipo] = useState<InventoryMovementTipo | 'todos'>('todos')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [query, setQuery] = useState('')

  async function reload(nextPage = page) {
    if (!sucursal) return
    if (desde && hasta && desde > hasta) {
      setError('La fecha Desde no puede ser posterior a Hasta')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = (await window.mebsy.inventory.movements({
        sucursalId: sucursal.id,
        lote: lote || undefined,
        tipo,
        desde: desde || undefined,
        hasta: hasta || undefined,
        q: query || undefined,
        page: nextPage,
        pageSize
      })) as MovementsResponse
      setItems(data.items)
      setTotal(data.total)
      setPage(data.page)
      setKpis(data.kpis)
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setLoading(false)
    }
  }

  async function loadLots() {
    if (!sucursal) return
    try {
      const rows = (await window.mebsy.inventory.lots(
        sucursal.id
      )) as InventoryLot[]
      setLots(rows)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void loadLots()
    void reload(1)
  }, [sucursal?.id])

  function clearFilters() {
    setLote('')
    setTipo('todos')
    setDesde('')
    setHasta('')
    setQuery('')
    setPage(1)
    void (async () => {
      if (!sucursal) return
      setLoading(true)
      try {
        const data = (await window.mebsy.inventory.movements({
          sucursalId: sucursal.id,
          tipo: 'todos',
          page: 1,
          pageSize
        })) as MovementsResponse
        setItems(data.items)
        setTotal(data.total)
        setPage(data.page)
        setKpis(data.kpis)
      } catch (err) {
        setError(parseIpcError(err))
      } finally {
        setLoading(false)
      }
    })()
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div>
      <PageHeader
        title="Reportes de inventario"
        subtitle={`Historial de movimientos · ${sucursal?.nombre ?? ''}`}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ms-muted)]">
            Entradas
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold text-[var(--ms-ok)]">
            {kpis.entradas}
          </div>
          <div className="text-xs text-[var(--ms-muted)]">unidades</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ms-muted)]">
            Salidas
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold text-[var(--ms-danger)]">
            {kpis.salidas}
          </div>
          <div className="text-xs text-[var(--ms-muted)]">unidades</div>
        </Card>
      </div>

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Lote">
            <Select value={lote} onChange={(e) => setLote(e.target.value)}>
              <option value="">Todos</option>
              {lots.map((l) => (
                <option key={l.id} value={l.codigo}>
                  {l.codigo}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tipo">
            <Select
              value={tipo}
              onChange={(e) =>
                setTipo(e.target.value as InventoryMovementTipo | 'todos')
              }
            >
              <option value="todos">Todos</option>
              <option value="entrada">Entrada (Compra/Devolución)</option>
              <option value="salida">Salida (Cambio/Merma)</option>
            </Select>
          </Field>
          <Field label="Desde">
            <DateInput value={desde} onChange={setDesde} />
          </Field>
          <Field label="Hasta">
            <DateInput value={hasta} onChange={setHasta} />
          </Field>
          <Field label="Buscar producto">
            <Input
              placeholder="Nombre / SKU…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              setPage(1)
              void reload(1)
            }}
          >
            Buscar
          </Button>
          <Button type="button" variant="secondary" onClick={clearFilters}>
            Limpiar filtros
          </Button>
        </div>
      </Card>

      {error ? (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-[var(--ms-muted)]">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-sm text-[var(--ms-muted)]">
            No hay movimientos para los filtros seleccionados.
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Lote</Th>
                <Th>Producto</Th>
                <Th>Movimiento</Th>
                <Th>Cantidad</Th>
                <Th>Origen</Th>
                <Th>Usuario</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <Td className="whitespace-nowrap text-xs">
                    {formatDate(m.createdAt)}
                  </Td>
                  <Td className="font-mono text-xs">
                    {m.loteCodigo ??
                      m.transferenciaCodigo ??
                      '—'}
                  </Td>
                  <Td>
                    <div>{m.productoNombre}</div>
                    <div className="font-mono text-[10px] text-[var(--ms-muted)]">
                      {m.productoSku}
                    </div>
                  </Td>
                  <Td>
                    {m.tipo === 'entrada' ? (
                      <Badge tone="ok">
                        {labelFromTipo(m.tipo, m.motivo, m.origen)}
                      </Badge>
                    ) : (
                      <Badge tone="danger">
                        {labelFromTipo(m.tipo, m.motivo, m.origen)}
                      </Badge>
                    )}
                    {m.origen === 'transferencia' && m.motivo ? (
                      <div className="mt-0.5 text-xs text-[var(--ms-muted)]">
                        {m.motivo}
                      </div>
                    ) : null}
                    {m.observaciones ? (
                      <div className="mt-0.5 text-xs text-[var(--ms-muted)]">
                        {m.observaciones}
                      </div>
                    ) : null}
                  </Td>
                  <Td className="font-mono font-semibold">{m.cantidad}</Td>
                  <Td>
                    {m.origen === 'transferencia' ? (
                      <Badge tone="accent">Transferencia</Badge>
                    ) : m.origen === 'masivo' ? (
                      <Badge tone="accent">Masivo</Badge>
                    ) : m.origen === 'manual' ? (
                      <Badge tone="neutral">Manual</Badge>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td>{m.usuarioNombre ?? `Usuario #${m.usuarioId}`}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        {total > pageSize ? (
          <div className="flex items-center justify-between border-t border-[var(--ms-line)] px-3 py-2 text-sm">
            <span className="text-[var(--ms-muted)]">
              {total} movimientos · pág. {page}/{totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => void reload(page - 1)}
              >
                Anterior
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => void reload(page + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
