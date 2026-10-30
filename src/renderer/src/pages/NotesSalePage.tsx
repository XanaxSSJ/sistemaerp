import { useEffect, useMemo, useState } from 'react'
import {
  Search,
  Trash2,
  Keyboard,
  List,
  Plus,
  Minus,
  ArrowLeft,
  Banknote,
  Smartphone,
  Combine,
  ShoppingBag
} from 'lucide-react'
import type {
  ProductWithStock,
  SaleNoteRow,
  SaleResult,
  TopCategoryRow
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
import { useRealtimeRefresh } from '../hooks/useRealtime'
import { formatDateTime, todayIso } from '../lib/dates'
import { parseIpcError } from '../lib/errors'
import { calcIgvFromTotal, formatPen, roundMoney } from '../lib/money'
import { printSaleTicket } from '../lib/print-sale'
import { useCart, type NvMetodoPago } from '../store/cart'
import { useSession } from '../store/session'

const METODOS: Array<{
  value: NvMetodoPago
  label: string
  short: string
  Icon: typeof Banknote
}> = [
  { value: 'efectivo', label: 'Efectivo', short: 'Efectivo', Icon: Banknote },
  { value: 'yape', label: 'Yape / Plin', short: 'Yape', Icon: Smartphone },
  { value: 'mixto', label: 'Mixto', short: 'Mixto', Icon: Combine }
]

type ViewMode = 'pos' | 'list'
type BuscarPor = 'nota' | 'fecha'

export function NotesSalePage() {
  const { user, sucursal } = useSession()
  const cart = useCart()
  const [view, setView] = useState<ViewMode>('pos')

  const [query, setQuery] = useState('')
  const [categoriaId, setCategoriaId] = useState<number | null>(null)
  const [topCats, setTopCats] = useState<TopCategoryRow[]>([])
  const [products, setProducts] = useState<ProductWithStock[]>([])
  const [productsTotal, setProductsTotal] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastSale, setLastSale] = useState<SaleResult | null>(null)
  const [igvPct, setIgvPct] = useState(18)
  const [nextSerie, setNextSerie] = useState('NV01')
  const [nextCorrelativo, setNextCorrelativo] = useState(1)

  const [notes, setNotes] = useState<SaleNoteRow[]>([])
  const [notesTotal, setNotesTotal] = useState(0)
  const [notesPage, setNotesPage] = useState(1)
  const notesPageSize = 20
  const [notesLoading, setNotesLoading] = useState(false)
  const [notesError, setNotesError] = useState('')
  const [desde, setDesde] = useState(todayIso())
  const [hasta, setHasta] = useState(todayIso())
  const [buscarPor, setBuscarPor] = useState<BuscarPor>('nota')
  const [buscarTexto, setBuscarTexto] = useState('')
  const [fechaEmision, setFechaEmision] = useState('')
  const [vendedorId, setVendedorId] = useState('')
  const [vendors, setVendors] = useState<Array<{ id: number; nombre: string }>>(
    []
  )

  const totals = useMemo(() => {
    let opGravada = 0
    let igv = 0
    let total = 0
    for (const item of cart.items) {
      const lineTotal = item.precio * item.cantidad
      const b = calcIgvFromTotal(lineTotal, igvPct, item.afectacionIgv)
      opGravada += b.subtotal
      igv += b.igv
      total += b.total
    }
    const descuento = 0
    return {
      opGravada: roundMoney(opGravada),
      igv: roundMoney(igv),
      descuento,
      total: roundMoney(Math.max(0, total - descuento))
    }
  }, [cart.items, igvPct])

  const total = totals.total
  const efectivo = Number(cart.montoEfectivo) || 0
  const yape = Number(cart.montoYape) || 0
  const metodo = cart.metodoPago

  const pagado = useMemo(() => {
    if (metodo === 'efectivo') return roundMoney(efectivo)
    if (metodo === 'yape') return roundMoney(yape)
    return roundMoney(efectivo + yape)
  }, [metodo, efectivo, yape])

  const vuelto = roundMoney(Math.max(0, pagado - total))
  const falta = roundMoney(Math.max(0, total - pagado))

  const canPay = useMemo(() => {
    if (!cart.items.length || busy) return false
    if (metodo === 'efectivo') return efectivo + 0.001 >= total && efectivo > 0
    if (metodo === 'yape') return yape + 0.001 >= total && yape > 0
    return efectivo > 0 && yape > 0 && efectivo + yape + 0.001 >= total
  }, [cart.items.length, busy, metodo, efectivo, yape, total])

  const docLabel = `${nextSerie}-${String(nextCorrelativo).padStart(8, '0')}`
  const notesPages = Math.max(1, Math.ceil(notesTotal / notesPageSize))

  async function loadProducts(q?: string, catId?: number | null) {
    if (!sucursal) return
    const data = (await window.mebsy.products.list(
      sucursal.id,
      q || undefined,
      catId ?? undefined,
      undefined,
      { limit: 60, page: 1 }
    )) as { items: ProductWithStock[]; total: number; limit: number } | ProductWithStock[]
    // Compat: API nueva { items } o array legacy
    if (Array.isArray(data)) {
      setProducts(data)
      setProductsTotal(data.length)
    } else {
      setProducts(data.items)
      setProductsTotal(data.total)
    }
  }

  async function loadTopCategories() {
    if (!sucursal) return
    try {
      const rows = (await window.mebsy.sales.topCategories(
        sucursal.id,
        5
      )) as TopCategoryRow[]
      setTopCats(rows)
    } catch {
      setTopCats([])
    }
  }

  async function loadMeta() {
    if (!sucursal) return
    try {
      const [empresa, series] = await Promise.all([
        window.mebsy.company.get() as Promise<{ igvPorcentaje?: number }>,
        window.mebsy.branches.series(sucursal.id) as Promise<
          Array<{ tipoDocumento: string; serie: string; correlativo: number }>
        >
      ])
      if (empresa?.igvPorcentaje != null) setIgvPct(Number(empresa.igvPorcentaje))
      const nv = series.find((s) => s.tipoDocumento === 'NV')
      if (nv) {
        setNextSerie(nv.serie)
        setNextCorrelativo(Number(nv.correlativo) || 1)
      } else {
        setNextSerie(`NV${String(sucursal.id).padStart(2, '0')}`)
        setNextCorrelativo(1)
      }
    } catch {
      setNextSerie(`NV${String(sucursal.id).padStart(2, '0')}`)
    }
  }

  async function loadVendors() {
    if (!sucursal) return
    try {
      const rows = (await window.mebsy.sales.vendors(sucursal.id)) as Array<{
        id: number
        nombre: string
      }>
      setVendors(rows)
    } catch {
      if (user) setVendors([{ id: user.id, nombre: user.nombre }])
      else setVendors([])
    }
  }

  async function loadNotes(page = notesPage) {
    if (!sucursal) return
    if (desde && hasta && desde > hasta) {
      setNotesError('La fecha Desde no puede ser posterior a Hasta')
      return
    }
    setNotesLoading(true)
    setNotesError('')
    try {
      const data = (await window.mebsy.sales.list({
        sucursalId: sucursal.id,
        tipoComprobante: 'NV',
        desde: desde || undefined,
        hasta: hasta || undefined,
        usuarioId: vendedorId ? Number(vendedorId) : undefined,
        buscarPor,
        q: buscarPor === 'nota' ? buscarTexto || undefined : undefined,
        fechaEmision:
          buscarPor === 'fecha' ? fechaEmision || undefined : undefined,
        page,
        pageSize: notesPageSize
      })) as { items: SaleNoteRow[]; total: number; page: number }
      setNotes(data.items)
      setNotesTotal(data.total)
      setNotesPage(data.page)
    } catch (err) {
      setNotesError(parseIpcError(err))
    } finally {
      setNotesLoading(false)
    }
  }

  useEffect(() => {
    void loadMeta()
    void loadTopCategories()
  }, [sucursal?.id])

  useEffect(() => {
    if (!sucursal) return
    const t = setTimeout(() => {
      void loadProducts(query, categoriaId)
    }, 200)
    return () => clearTimeout(t)
  }, [query, categoriaId, sucursal?.id])

  useEffect(() => {
    if (view === 'list') {
      void loadVendors()
      void loadNotes(1)
    }
  }, [view, sucursal?.id])

  useRealtimeRefresh(
    ['stock.updated', 'product.changed', 'sale.created'],
    () => {
      void loadProducts(query, categoriaId)
      void loadMeta()
      void loadTopCategories()
      if (view === 'list') void loadNotes(notesPage)
    },
    200
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (view !== 'pos') return
      if (e.key === 'F2') {
        e.preventDefault()
        document.getElementById('nv-search')?.focus()
      }
      if (e.key === 'F9') {
        e.preventDefault()
        void checkout()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, busy, canPay, user?.id, sucursal?.id])

  async function checkout() {
    if (!user || !sucursal || !canPay || busy) return
    setBusy(true)
    setError('')
    try {
      const pagos: Array<{ metodo: 'efectivo' | 'yape'; monto: number }> = []
      if (metodo === 'efectivo') {
        pagos.push({ metodo: 'efectivo', monto: efectivo })
      } else if (metodo === 'yape') {
        pagos.push({ metodo: 'yape', monto: yape })
      } else {
        pagos.push({ metodo: 'efectivo', monto: efectivo })
        pagos.push({ metodo: 'yape', monto: yape })
      }

      const result = (await window.mebsy.sales.create({
        sucursalId: Number(sucursal.id),
        usuarioId: Number(user.id),
        clienteId: null,
        tipoComprobante: 'NV',
        metodoPago: metodo,
        pagos,
        items: cart.items.map((i) => ({
          productoId: Number(i.productoId),
          cantidad: Number(i.cantidad),
          precioUnitario: Number(i.precio)
        }))
      })) as SaleResult

      cart.clear()
      setLastSale(result)
      void printSaleTicket(result).finally(() => setLastSale(null))
      void Promise.all([
        loadProducts(query, categoriaId),
        loadMeta(),
        loadTopCategories()
      ])
      window.setTimeout(() => {
        document.getElementById('nv-search')?.focus()
      }, 50)
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setBusy(false)
    }
  }

  function metodoLabel(m: string) {
    if (m === 'yape') return 'Yape / Plin'
    if (m === 'mixto') return 'Mixto'
    if (m === 'efectivo') return 'Efectivo'
    return m
  }

  if (view === 'list') {
    return (
      <div>
        <PageHeader
          title="Notas de venta"
          subtitle={`${sucursal?.nombre ?? ''} · historial interno`}
          actions={
            <Button
              variant="dark"
              onClick={() => setView('pos')}
            >
              <Plus size={16} />
              Nueva nota
            </Button>
          }
        />

        <Card className="mb-4 p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Field label="Fecha inicio">
              <DateInput value={desde} onChange={setDesde} />
            </Field>
            <Field label="Fecha fin">
              <DateInput value={hasta} onChange={setHasta} />
            </Field>
            <Field label="Buscar por">
              <Select
                value={buscarPor}
                onChange={(e) => setBuscarPor(e.target.value as BuscarPor)}
              >
                <option value="nota">N° nota</option>
                <option value="fecha">Fecha de emisión</option>
              </Select>
            </Field>
            <Field label={buscarPor === 'nota' ? 'N° nota' : 'Fecha emisión'}>
              {buscarPor === 'nota' ? (
                <Input
                  placeholder="NV01-00000001"
                  value={buscarTexto}
                  onChange={(e) => setBuscarTexto(e.target.value)}
                  className="font-mono"
                />
              ) : (
                <DateInput value={fechaEmision} onChange={setFechaEmision} />
              )}
            </Field>
            <Field label="Vendedor">
              <Select
                value={vendedorId}
                onChange={(e) => setVendedorId(e.target.value)}
              >
                <option value="">Todos</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end gap-2">
              <Button
                className="flex-1"
                onClick={() => void loadNotes(1)}
                disabled={notesLoading}
              >
                Filtrar
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setDesde(todayIso())
                  setHasta(todayIso())
                  setBuscarPor('nota')
                  setBuscarTexto('')
                  setFechaEmision('')
                  setVendedorId('')
                  void (async () => {
                    setDesde(todayIso())
                    setHasta(todayIso())
                    setNotesLoading(true)
                    try {
                      const data = (await window.mebsy.sales.list({
                        sucursalId: sucursal!.id,
                        tipoComprobante: 'NV',
                        desde: todayIso(),
                        hasta: todayIso(),
                        page: 1,
                        pageSize: notesPageSize
                      })) as {
                        items: SaleNoteRow[]
                        total: number
                        page: number
                      }
                      setNotes(data.items)
                      setNotesTotal(data.total)
                      setNotesPage(data.page)
                    } catch (err) {
                      setNotesError(parseIpcError(err))
                    } finally {
                      setNotesLoading(false)
                    }
                  })()
                }}
              >
                Limpiar
              </Button>
            </div>
          </div>
        </Card>

        {notesError ? (
          <div className="mb-3">
            <Alert>{notesError}</Alert>
          </div>
        ) : null}

        <Card className="overflow-hidden">
          <Table>
            <thead>
              <tr>
                <Th>N° nota</Th>
                <Th>Fecha emisión</Th>
                <Th>Vendedor</Th>
                <Th>Pago</Th>
                <Th className="text-right">Total</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {notes.map((n) => (
                <tr key={n.id}>
                  <Td className="font-mono text-[13px]">
                    {n.serie}-{String(n.correlativo).padStart(8, '0')}
                  </Td>
                  <Td>{formatDateTime(n.createdAt)}</Td>
                  <Td>{n.usuarioNombre}</Td>
                  <Td>{metodoLabel(n.metodoPago)}</Td>
                  <Td className="text-right font-mono font-semibold">
                    {formatPen(n.total)}
                  </Td>
                  <Td>
                    <Badge tone={n.estado === 'completada' ? 'ok' : 'danger'}>
                      {n.estado}
                    </Badge>
                  </Td>
                </tr>
              ))}
              {!notesLoading && notes.length === 0 ? (
                <tr>
                  <Td colSpan={6} className="py-10 text-center text-[var(--ms-muted)]">
                    No hay notas de venta en el rango seleccionado
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
          <div className="flex items-center justify-between border-t border-[var(--ms-line)] px-3 py-2 text-sm">
            <span className="text-[var(--ms-muted)]">
              {notesLoading
                ? 'Cargando…'
                : `${notesTotal} registro${notesTotal === 1 ? '' : 's'}`}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={notesPage <= 1 || notesLoading}
                onClick={() => void loadNotes(notesPage - 1)}
              >
                Anterior
              </Button>
              <span className="font-mono text-[12px]">
                {notesPage}/{notesPages}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={notesPage >= notesPages || notesLoading}
                onClick={() => void loadNotes(notesPage + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </Card>

        <div className="mt-3">
          <Button variant="ghost" onClick={() => setView('pos')}>
            <ArrowLeft size={16} />
            Volver a cobrar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100%-0.25rem)] flex-col">
      <PageHeader
        title="Nota de venta"
        subtitle={`${sucursal?.nombre ?? ''} · venta interna (sin SUNAT)`}
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 text-[12px] text-[var(--ms-muted)] sm:flex">
              <Keyboard size={14} />
              <span className="font-mono">F2</span> buscar
              <span className="mx-1 text-[var(--ms-line-strong)]">·</span>
              <span className="font-mono">F9</span> cobrar
            </div>
            <Button variant="secondary" onClick={() => setView('list')}>
              <List size={16} />
              Notas de venta
            </Button>
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <div className="space-y-2 border-b border-[var(--ms-line)] bg-[var(--ms-panel)] p-3">
            <div className="relative">
              <Search
                size={15}
                className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--ms-muted)]"
              />
              <Input
                id="nv-search"
                className="border-[var(--ms-line-strong)] bg-white pl-9"
                placeholder="Código, barras o nombre de producto"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            {topCats.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setCategoriaId(null)}
                  className={`rounded-[6px] px-2.5 py-1 text-[12px] font-semibold transition ${
                    categoriaId == null
                      ? 'bg-[var(--ms-sidebar)] text-white'
                      : 'border border-[var(--ms-line)] bg-white text-[var(--ms-muted)] hover:border-[var(--ms-accent)] hover:text-[var(--ms-ink)]'
                  }`}
                >
                  Todas
                </button>
                {topCats.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setCategoriaId(categoriaId === c.id ? null : c.id)
                    }
                    className={`rounded-[6px] px-2.5 py-1 text-[12px] font-semibold transition ${
                      categoriaId === c.id
                        ? 'bg-[var(--ms-sidebar)] text-white'
                        : 'border border-[var(--ms-line)] bg-white text-[var(--ms-muted)] hover:border-[var(--ms-accent)] hover:text-[var(--ms-ink)]'
                    }`}
                  >
                    {c.nombre}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 overflow-auto p-3 md:grid-cols-3">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => cart.addProduct(p)}
                className="border border-[var(--ms-line)] bg-white p-3 text-left transition hover:border-[var(--ms-accent)] hover:bg-[var(--ms-accent-soft)]"
              >
                <div className="font-mono text-[11px] font-medium text-[var(--ms-accent-hover)]">
                  {p.codigo}
                </div>
                <div className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug">
                  {p.nombre}
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <span className="font-mono text-[14px] font-semibold">
                    {formatPen(p.precio)}
                  </span>
                  <span
                    className={`text-[11px] ${
                      p.stock <= p.stockMinimo
                        ? 'font-semibold text-[var(--ms-danger)]'
                        : 'text-[var(--ms-muted)]'
                    }`}
                  >
                    {p.stock} uds
                  </span>
                </div>
              </button>
            ))}
            {products.length === 0 ? (
              <p className="col-span-full py-12 text-center text-sm text-[var(--ms-muted)]">
                No hay productos para esta búsqueda
              </p>
            ) : productsTotal > products.length ? (
              <p className="col-span-full pt-1 text-center text-[11px] text-[var(--ms-muted)]">
                Mostrando {products.length} de {productsTotal}. Afina la búsqueda o
                categoría para encontrar el resto.
              </p>
            ) : null}
          </div>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--ms-line)] bg-[var(--ms-sidebar)] px-3 py-2.5 text-white">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold tracking-[0.1em] text-white/55 uppercase">
                Nota de venta
              </div>
              <div className="truncate font-mono text-[16px] font-semibold tracking-tight">
                {docLabel}
              </div>
            </div>
            <div className="shrink-0 rounded-[6px] bg-white/10 px-2.5 py-1 text-right">
              <div className="text-[10px] font-semibold tracking-[0.08em] text-white/55 uppercase">
                Ítems
              </div>
              <div className="font-mono text-[15px] font-semibold">
                {cart.items.reduce((s, i) => s + i.cantidad, 0)}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {cart.items.length === 0 ? (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ms-panel)] text-[var(--ms-muted)]">
                  <ShoppingBag size={22} />
                </div>
                <p className="text-sm font-medium text-[var(--ms-ink)]">
                  Carrito vacío
                </p>
                <p className="max-w-[220px] text-[12px] text-[var(--ms-muted)]">
                  Busca o elige un producto para comenzar la venta
                </p>
              </div>
            ) : (
              <ul>
                {cart.items.map((item) => (
                  <li
                    key={item.productoId}
                    className="group flex items-center gap-2 border-b border-[var(--ms-line)] px-3 py-2.5 transition hover:bg-[var(--ms-panel)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold leading-snug">
                        {item.nombre}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-[var(--ms-muted)]">
                        {formatPen(item.precio)} c/u
                      </div>
                    </div>
                    <div className="flex items-center overflow-hidden rounded-[6px] border border-[var(--ms-line)] bg-white">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center text-[var(--ms-muted)] hover:bg-[var(--ms-panel)] hover:text-[var(--ms-ink)]"
                        onClick={() =>
                          cart.setQty(item.productoId, item.cantidad - 1)
                        }
                        aria-label="Restar"
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={item.stock}
                        className="h-8 w-10 border-x border-[var(--ms-line)] bg-transparent text-center font-mono text-[13px] outline-none"
                        value={item.cantidad}
                        onChange={(e) =>
                          cart.setQty(item.productoId, Number(e.target.value))
                        }
                      />
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center text-[var(--ms-muted)] hover:bg-[var(--ms-panel)] hover:text-[var(--ms-ink)] disabled:opacity-40"
                        disabled={item.cantidad >= item.stock}
                        onClick={() =>
                          cart.setQty(item.productoId, item.cantidad + 1)
                        }
                        aria-label="Sumar"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="w-[78px] text-right font-mono text-[13px] font-semibold">
                      {formatPen(item.precio * item.cantidad)}
                    </div>
                    <button
                      type="button"
                      className="rounded-[6px] p-1.5 text-[var(--ms-muted)] opacity-70 transition hover:bg-[var(--ms-danger-soft)] hover:text-[var(--ms-danger)] group-hover:opacity-100"
                      onClick={() => cart.remove(item.productoId)}
                      aria-label="Quitar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1.5 border-t border-[var(--ms-line)] bg-[var(--ms-panel)] p-2.5">
            {error ? <Alert>{error}</Alert> : null}
            {lastSale ? (
              <div className="rounded-[6px] border border-[var(--ms-ok)]/25 bg-[var(--ms-ok-soft)] px-2 py-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="ok">Registrada</Badge>
                  <span className="font-mono text-[11px] font-semibold text-[var(--ms-ok)]">
                    {lastSale.serie}-
                    {String(lastSale.correlativo).padStart(8, '0')}
                  </span>
                  <span className="ml-auto font-mono text-[12px] font-semibold text-[var(--ms-ok)]">
                    {formatPen(lastSale.total)}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-3 gap-1">
              {METODOS.map((m) => {
                const active = metodo === m.value
                const Icon = m.Icon
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => cart.setMetodoPago(m.value)}
                    className={`flex h-8 items-center justify-center gap-1 rounded-[6px] border text-[10px] font-semibold transition ${
                      active
                        ? 'border-[var(--ms-sidebar)] bg-[var(--ms-sidebar)] text-white'
                        : 'border-[var(--ms-line)] bg-white text-[var(--ms-muted)] hover:border-[var(--ms-line-strong)] hover:text-[var(--ms-ink)]'
                    }`}
                  >
                    <Icon size={12} />
                    {m.short}
                  </button>
                )
              })}
            </div>

            {metodo === 'mixto' ? (
              <div className="grid grid-cols-2 gap-1.5">
                <div className="min-w-0">
                  <div className="mb-0.5 flex items-center justify-between gap-1">
                    <span className="text-[11px] font-semibold">Efectivo</span>
                    {total > 0 ? (
                      <button
                        type="button"
                        className="text-[10px] font-semibold text-[var(--ms-accent-hover)] hover:underline"
                        onClick={() =>
                          cart.setMontoEfectivo(
                            String(roundMoney(Math.max(0, total - yape)))
                          )
                        }
                      >
                        Exacto
                      </button>
                    ) : null}
                  </div>
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 font-mono text-[11px] text-[var(--ms-muted)]">
                      S/
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      className="h-8 bg-white pl-7 font-mono text-[13px] font-semibold"
                      value={cart.montoEfectivo}
                      onChange={(e) => cart.setMontoEfectivo(e.target.value)}
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="mb-0.5 flex items-center justify-between gap-1">
                    <span className="text-[11px] font-semibold">Yape / Plin</span>
                    {total > 0 ? (
                      <button
                        type="button"
                        className="text-[10px] font-semibold text-[var(--ms-accent-hover)] hover:underline"
                        onClick={() =>
                          cart.setMontoYape(
                            String(roundMoney(Math.max(0, total - efectivo)))
                          )
                        }
                      >
                        Exacto
                      </button>
                    ) : null}
                  </div>
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 font-mono text-[11px] text-[var(--ms-muted)]">
                      S/
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      className="h-8 bg-white pl-7 font-mono text-[13px] font-semibold"
                      value={cart.montoYape}
                      onChange={(e) => cart.setMontoYape(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ) : metodo === 'efectivo' ? (
              <div className="min-w-0">
                <div className="mb-0.5 flex items-center justify-between gap-1">
                  <span className="text-[11px] font-semibold">Efectivo</span>
                  {total > 0 ? (
                    <button
                      type="button"
                      className="text-[10px] font-semibold text-[var(--ms-accent-hover)] hover:underline"
                      onClick={() => cart.setMontoEfectivo(String(total))}
                    >
                      Exacto
                    </button>
                  ) : null}
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 font-mono text-[11px] text-[var(--ms-muted)]">
                    S/
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    className="h-8 bg-white pl-7 font-mono text-[13px] font-semibold"
                    value={cart.montoEfectivo}
                    onChange={(e) => cart.setMontoEfectivo(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="min-w-0">
                <div className="mb-0.5 flex items-center justify-between gap-1">
                  <span className="text-[11px] font-semibold">Yape / Plin</span>
                  {total > 0 ? (
                    <button
                      type="button"
                      className="text-[10px] font-semibold text-[var(--ms-accent-hover)] hover:underline"
                      onClick={() => cart.setMontoYape(String(total))}
                    >
                      Exacto
                    </button>
                  ) : null}
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 font-mono text-[11px] text-[var(--ms-muted)]">
                    S/
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    className="h-8 bg-white pl-7 font-mono text-[13px] font-semibold"
                    value={cart.montoYape}
                    onChange={(e) => cart.setMontoYape(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="rounded-[6px] border border-[var(--ms-line)] bg-white px-2.5 py-1.5">
              <div className="space-y-0.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[var(--ms-muted)]">Op. gravada</span>
                  <span className="font-mono">{formatPen(totals.opGravada)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ms-muted)]">IGV ({igvPct}%)</span>
                  <span className="font-mono">{formatPen(totals.igv)}</span>
                </div>
                {totals.descuento > 0.001 ? (
                  <div className="flex justify-between">
                    <span className="text-[var(--ms-muted)]">Descuento</span>
                    <span className="font-mono">
                      -{formatPen(totals.descuento)}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="mt-1 flex items-center justify-between border-t border-[var(--ms-line)] pt-1">
                <span className="text-[10px] font-semibold tracking-[0.06em] text-[var(--ms-muted)] uppercase">
                  Total
                </span>
                <span className="font-mono text-[18px] font-semibold leading-none tracking-tight">
                  {formatPen(total)}
                </span>
              </div>

              {metodo === 'mixto' && (efectivo > 0 || yape > 0) ? (
                <div className="mt-1 flex justify-between gap-2 border-t border-dashed border-[var(--ms-line)] pt-1 text-[11px]">
                  <span className="text-[var(--ms-muted)]">
                    Ef. <span className="font-mono font-semibold text-[var(--ms-ink)]">{formatPen(efectivo)}</span>
                  </span>
                  <span className="text-[var(--ms-muted)]">
                    Yape <span className="font-mono font-semibold text-[var(--ms-ink)]">{formatPen(yape)}</span>
                  </span>
                </div>
              ) : null}

              {cart.items.length > 0 && pagado > 0 ? (
                <div
                  className={`mt-1 flex items-center justify-between rounded-[4px] px-2 py-1 ${
                    falta > 0.001
                      ? 'bg-[var(--ms-danger-soft)] text-[var(--ms-danger)]'
                      : 'bg-[var(--ms-ok-soft)] text-[var(--ms-ok)]'
                  }`}
                >
                  <span className="text-[11px] font-semibold">
                    {falta > 0.001 ? 'Falta' : 'Vuelto'}
                  </span>
                  <span className="font-mono text-[13px] font-semibold">
                    {formatPen(falta > 0.001 ? falta : vuelto)}
                  </span>
                </div>
              ) : null}
            </div>

            <Button
              className="h-9 w-full text-[13px]"
              size="md"
              variant="dark"
              disabled={busy || !canPay}
              onClick={() => void checkout()}
            >
              {busy
                ? 'Procesando…'
                : canPay
                  ? `Cobrar ${formatPen(total)}  ·  F9`
                  : cart.items.length === 0
                    ? 'Agrega productos'
                    : 'Completa el pago'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
