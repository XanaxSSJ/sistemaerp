import { Fragment, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ProductSaleLine } from '@core/types'
import {
  Alert,
  Button,
  Card,
  DateInput,
  Field,
  Input,
  PageHeader,
  Table,
  Td,
  Th
} from '../components/ui'
import { formatDateTime } from '../lib/dates'
import { parseIpcError } from '../lib/errors'
import { useSession } from '../store/session'

type CatalogProduct = {
  id: number
  codigo: string
  nombre: string
  categoriaNombre: string
  marcaNombre: string
}

type CatalogResponse = {
  items: CatalogProduct[]
  total: number
  page: number
  pageSize: number
}

type SalesResponse = {
  items: ProductSaleLine[]
  total: number
  page: number
  pageSize: number
}

function comprobanteLabel(tipo: string, serie: string, correlativo: number) {
  const kind =
    tipo === '01'
      ? 'Factura'
      : tipo === '03'
        ? 'Boleta'
        : tipo === 'NV'
          ? 'Nota de venta'
          : tipo
  return `${kind} ${serie}-${String(correlativo).padStart(8, '0')}`
}

export function ProductsReportPage() {
  const { sucursal } = useSession()
  const [items, setItems] = useState<CatalogProduct[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [query, setQuery] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [salesByProduct, setSalesByProduct] = useState<
    Record<
      number,
      {
        items: ProductSaleLine[]
        total: number
        page: number
        loading: boolean
        error: string
      }
    >
  >({})

  async function reload(nextPage = page) {
    setLoading(true)
    setError('')
    try {
      const data = (await window.mebsy.products.catalog({
        q: query || undefined,
        page: nextPage,
        pageSize
      })) as CatalogResponse
      setItems(data.items)
      setTotal(data.total)
      setPage(data.page)
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setLoading(false)
    }
  }

  async function loadSales(productoId: number, nextPage = 1) {
    if (!sucursal) return
    if (desde && hasta && desde > hasta) {
      setSalesByProduct((prev) => ({
        ...prev,
        [productoId]: {
          items: [],
          total: 0,
          page: 1,
          loading: false,
          error: 'La fecha Desde no puede ser posterior a Hasta'
        }
      }))
      return
    }
    setSalesByProduct((prev) => ({
      ...prev,
      [productoId]: {
        items: prev[productoId]?.items ?? [],
        total: prev[productoId]?.total ?? 0,
        page: nextPage,
        loading: true,
        error: ''
      }
    }))
    try {
      const data = (await window.mebsy.sales.byProduct({
        productoId,
        sucursalId: sucursal.id,
        desde: desde || undefined,
        hasta: hasta || undefined,
        page: nextPage,
        pageSize: 15
      })) as SalesResponse
      setSalesByProduct((prev) => ({
        ...prev,
        [productoId]: {
          items: data.items,
          total: data.total,
          page: data.page,
          loading: false,
          error: ''
        }
      }))
    } catch (err) {
      setSalesByProduct((prev) => ({
        ...prev,
        [productoId]: {
          items: [],
          total: 0,
          page: 1,
          loading: false,
          error: parseIpcError(err)
        }
      }))
    }
  }

  async function toggleExpand(productoId: number) {
    if (expandedId === productoId) {
      setExpandedId(null)
      return
    }
    setExpandedId(productoId)
    await loadSales(productoId, 1)
  }

  useEffect(() => {
    void reload(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial
  }, [])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div>
      <PageHeader
        title="Reporte Productos"
        subtitle={`Ventas por producto · ${sucursal?.nombre ?? ''}`}
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Buscar producto">
            <Input
              placeholder="Nombre / SKU…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          <Field label="Desde">
            <DateInput value={desde} onChange={setDesde} />
          </Field>
          <Field label="Hasta">
            <DateInput value={hasta} onChange={setHasta} />
          </Field>
          <div className="flex items-end gap-2">
            <Button
              type="button"
              onClick={() => {
                setPage(1)
                void reload(1).then(() => {
                  if (expandedId != null) void loadSales(expandedId, 1)
                })
              }}
            >
              Buscar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setQuery('')
                setDesde('')
                setHasta('')
                setExpandedId(null)
                setSalesByProduct({})
                setPage(1)
                void reload(1)
              }}
            >
              Limpiar
            </Button>
          </div>
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
            No hay productos para mostrar.
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-10" />
                <Th>SKU</Th>
                <Th>Producto</Th>
                <Th>Categoría</Th>
                <Th>Marca</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const open = expandedId === p.id
                const sales = salesByProduct[p.id]
                return (
                  <Fragment key={p.id}>
                    <tr
                      className="cursor-pointer hover:bg-black/[0.03]"
                      onClick={() => void toggleExpand(p.id)}
                    >
                      <Td className="w-10 text-[var(--ms-muted)]">
                        {open ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </Td>
                      <Td className="font-mono text-xs">{p.codigo}</Td>
                      <Td className="font-medium">{p.nombre}</Td>
                      <Td className="text-sm text-[var(--ms-muted)]">
                        {p.categoriaNombre || '—'}
                      </Td>
                      <Td className="text-sm text-[var(--ms-muted)]">
                        {p.marcaNombre || '—'}
                      </Td>
                    </tr>
                    {open ? (
                      <tr>
                        <Td
                          colSpan={5}
                          className="bg-[var(--ms-panel)] p-0"
                        >
                          <div className="border-t border-[var(--ms-line)] px-4 py-3">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ms-muted)]">
                              Ventas · stock descontado
                              {desde || hasta
                                ? ` · filtro ${desde || '…'} → ${hasta || '…'}`
                                : ''}
                            </div>
                            {sales?.loading ? (
                              <div className="py-2 text-sm text-[var(--ms-muted)]">
                                Cargando ventas…
                              </div>
                            ) : sales?.error ? (
                              <Alert>{sales.error}</Alert>
                            ) : !sales?.items.length ? (
                              <div className="py-2 text-sm text-[var(--ms-muted)]">
                                Sin ventas registradas para este producto
                                {sucursal ? ` en ${sucursal.nombre}` : ''}.
                              </div>
                            ) : (
                              <>
                                <div className="overflow-x-auto rounded border border-[var(--ms-line)]">
                                  <table className="w-full text-left text-sm">
                                    <thead>
                                      <tr className="border-b border-[var(--ms-line)] text-[10px] uppercase tracking-wide text-[var(--ms-muted)]">
                                        <th className="px-3 py-2 font-semibold">
                                          Fecha / hora
                                        </th>
                                        <th className="px-3 py-2 font-semibold">
                                          Comprobante
                                        </th>
                                        <th className="px-3 py-2 font-semibold">
                                          Cantidad
                                        </th>
                                        <th className="px-3 py-2 font-semibold">
                                          Precio unit.
                                        </th>
                                        <th className="px-3 py-2 font-semibold">
                                          Total
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sales.items.map((s) => (
                                        <tr
                                          key={s.ventaItemId}
                                          className="border-b border-[var(--ms-line)] last:border-0"
                                        >
                                          <td className="whitespace-nowrap px-3 py-2 text-xs">
                                            {formatDateTime(s.createdAt)}
                                          </td>
                                          <td className="px-3 py-2 font-mono text-xs">
                                            {comprobanteLabel(
                                              s.tipoComprobante,
                                              s.serie,
                                              s.correlativo
                                            )}
                                          </td>
                                          <td className="px-3 py-2 font-mono font-semibold text-[var(--ms-danger)]">
                                            −{s.cantidad}
                                          </td>
                                          <td className="px-3 py-2 font-mono text-xs">
                                            {s.precioUnitario.toFixed(2)}
                                          </td>
                                          <td className="px-3 py-2 font-mono text-xs">
                                            {s.total.toFixed(2)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                {sales.total > 15 ? (
                                  <div className="mt-2 flex items-center justify-between text-xs text-[var(--ms-muted)]">
                                    <span>
                                      {sales.total} ventas · pág. {sales.page}/
                                      {Math.max(
                                        1,
                                        Math.ceil(sales.total / 15)
                                      )}
                                    </span>
                                    <div className="flex gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        disabled={sales.page <= 1}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          void loadSales(p.id, sales.page - 1)
                                        }}
                                      >
                                        Anterior
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        disabled={
                                          sales.page >=
                                          Math.ceil(sales.total / 15)
                                        }
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          void loadSales(p.id, sales.page + 1)
                                        }}
                                      >
                                        Siguiente
                                      </Button>
                                    </div>
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                        </Td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
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
                onClick={() => {
                  setExpandedId(null)
                  void reload(page - 1)
                }}
              >
                Anterior
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => {
                  setExpandedId(null)
                  void reload(page + 1)
                }}
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
