import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import type { TransferHistoryRow } from '@core/types'
import {
  Alert,
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

type Branch = { id: number; codigo: string; nombre: string; activa: boolean }

type ListResponse = {
  items: TransferHistoryRow[]
  total: number
  page: number
  pageSize: number
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

export function TransfersHistoryPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [items, setItems] = useState<TransferHistoryRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [origenId, setOrigenId] = useState('')
  const [destinoId, setDestinoId] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    void window.mebsy.branches.list().then((rows) => {
      setBranches(rows as Branch[])
    })
    void reload(1)
  }, [])

  async function reload(nextPage = page) {
    if (desde && hasta && desde > hasta) {
      setError('La fecha Desde no puede ser posterior a Hasta')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = (await window.mebsy.transfers.list({
        origenId: origenId ? Number(origenId) : undefined,
        destinoId: destinoId ? Number(destinoId) : undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
        q: query || undefined,
        page: nextPage,
        pageSize
      })) as ListResponse
      setItems(data.items)
      setTotal(data.total)
      setPage(data.page)
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setLoading(false)
    }
  }

  function clearFilters() {
    setOrigenId('')
    setDestinoId('')
    setDesde('')
    setHasta('')
    setQuery('')
    setPage(1)
    void (async () => {
      setLoading(true)
      try {
        const data = (await window.mebsy.transfers.list({
          page: 1,
          pageSize
        })) as ListResponse
        setItems(data.items)
        setTotal(data.total)
        setPage(data.page)
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
        title="Historial de transferencias"
        subtitle="Movimientos de stock entre sucursales"
        actions={
          <Button asChild size="sm">
            <Link to="/transferencias">
              <Plus className="size-3.5" />
              Nueva transferencia
            </Link>
          </Button>
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Origen">
            <Select
              value={origenId}
              onChange={(e) => setOrigenId(e.target.value)}
            >
              <option value="">Todos</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.codigo} — {b.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Destino">
            <Select
              value={destinoId}
              onChange={(e) => setDestinoId(e.target.value)}
            >
              <option value="">Todos</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.codigo} — {b.nombre}
                </option>
              ))}
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
            No hay transferencias para los filtros seleccionados.
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Producto</Th>
                <Th>Desde</Th>
                <Th>Hacia</Th>
                <Th>Cantidad</Th>
                <Th>Usuario</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.itemId}>
                  <Td className="whitespace-nowrap text-xs">
                    {formatDate(m.createdAt)}
                    <div className="font-mono text-[10px] text-[var(--ms-muted)]">
                      {m.codigo}
                    </div>
                  </Td>
                  <Td>
                    <div>{m.productoNombre}</div>
                    <div className="font-mono text-[10px] text-[var(--ms-muted)]">
                      {m.productoSku}
                    </div>
                  </Td>
                  <Td>{m.sucursalOrigenNombre}</Td>
                  <Td>{m.sucursalDestinoNombre}</Td>
                  <Td className="font-mono font-semibold">{m.cantidad}</Td>
                  <Td>{m.usuarioNombre ?? `Usuario #${m.usuarioId}`}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        {total > pageSize ? (
          <div className="flex items-center justify-between border-t border-[var(--ms-line)] px-3 py-2 text-sm">
            <span className="text-[var(--ms-muted)]">
              {total} registros · pág. {page}/{totalPages}
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
