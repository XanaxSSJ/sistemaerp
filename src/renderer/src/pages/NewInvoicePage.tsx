import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Banknote,
  Minus,
  Plus,
  Search,
  Smartphone,
  Trash2
} from 'lucide-react'
import type {
  AfectacionIgv,
  ProductWithStock,
  SaleResult
} from '@core/types'
import {
  Alert,
  Button,
  Card,
  DateInput,
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
import { todayIso } from '../lib/dates'
import { parseIpcError } from '../lib/errors'
import { calcIgvFromTotal, formatPen, roundMoney } from '../lib/money'
import { printSaleTicket } from '../lib/print-sale'
import { useSession } from '../store/session'

type TipoCpe = '01' | '03'
type MetodoCpe = 'efectivo' | 'yape'

type SerieRow = {
  tipoDocumento: string
  serie: string
  correlativo: number
}

type CartLine = {
  productoId: number
  codigo: string
  nombre: string
  precio: number
  cantidad: number
  stock: number
  afectacionIgv: AfectacionIgv
}

type CatOpt = { id: number; nombre: string }
type BrandOpt = { id: number; nombre: string }

function digitsOnly(v: string) {
  return v.replace(/\D/g, '')
}

export function NewInvoicePage() {
  const { user, sucursal } = useSession()

  const [tipo, setTipo] = useState<TipoCpe>('03')
  const [series, setSeries] = useState<SerieRow[]>([])
  const [serie, setSerie] = useState('')
  const [fechaEmision, setFechaEmision] = useState(todayIso())
  const [igvPct, setIgvPct] = useState(18)

  const [docNumero, setDocNumero] = useState('')
  const [razonSocial, setRazonSocial] = useState('')
  const [direccion, setDireccion] = useState('')
  const [lookupBusy, setLookupBusy] = useState(false)
  const [lookupMsg, setLookupMsg] = useState('')
  const clienteCache = useRef<Map<string, number>>(new Map())

  const [cart, setCart] = useState<CartLine[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQ, setPickerQ] = useState('')
  const [pickerCat, setPickerCat] = useState('')
  const [pickerMarca, setPickerMarca] = useState('')
  const [pickerProducts, setPickerProducts] = useState<ProductWithStock[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [categories, setCategories] = useState<CatOpt[]>([])
  const [brands, setBrands] = useState<BrandOpt[]>([])

  const [metodo, setMetodo] = useState<MetodoCpe>('efectivo')
  const [montoPago, setMontoPago] = useState('')
  const [referenciaPago, setReferenciaPago] = useState('')
  const [observaciones, setObservaciones] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lastSale, setLastSale] = useState<SaleResult | null>(null)

  const docLen = tipo === '01' ? 11 : 8
  const docLabel = tipo === '01' ? 'RUC' : 'DNI'

  const seriesForTipo = useMemo(
    () => series.filter((s) => s.tipoDocumento === tipo),
    [series, tipo]
  )

  const lines = useMemo(() => {
    return cart.map((line) => {
      const lineTotal = roundMoney(line.precio * line.cantidad)
      const br = calcIgvFromTotal(lineTotal, igvPct, line.afectacionIgv)
      return { ...line, ...br }
    })
  }, [cart, igvPct])

  const subtotal = roundMoney(lines.reduce((s, l) => s + l.subtotal, 0))
  const igv = roundMoney(lines.reduce((s, l) => s + l.igv, 0))
  const total = roundMoney(lines.reduce((s, l) => s + l.total, 0))

  const montoNum =
    metodo === 'yape' ? total : Number(montoPago.replace(',', '.')) || 0
  const vuelto =
    metodo === 'efectivo' ? roundMoney(Math.max(0, montoNum - total)) : 0

  const canEmit = useMemo(() => {
    if (busy || !cart.length || !serie) return false
    if (digitsOnly(docNumero).length !== docLen) return false
    if (!razonSocial.trim()) return false
    if (montoNum + 0.001 < total || montoNum <= 0) return false
    return true
  }, [busy, cart.length, serie, docNumero, docLen, razonSocial, montoNum, total])

  useEffect(() => {
    if (!sucursal) return
    void (async () => {
      try {
        const [empresa, serieRows] = await Promise.all([
          window.mebsy.company.get() as Promise<{ igvPorcentaje?: number }>,
          window.mebsy.branches.series(sucursal.id) as Promise<SerieRow[]>
        ])
        if (empresa?.igvPorcentaje != null) setIgvPct(Number(empresa.igvPorcentaje))
        setSeries(serieRows)
      } catch (err) {
        setError(parseIpcError(err))
      }
    })()
  }, [sucursal])

  useEffect(() => {
    const first = seriesForTipo[0]
    setSerie(first?.serie ?? '')
  }, [seriesForTipo])

  useEffect(() => {
    setDocNumero('')
    setRazonSocial('')
    setDireccion('')
    setLookupMsg('')
  }, [tipo])

  useEffect(() => {
    setMontoPago(total > 0 ? String(total) : '')
  }, [total, metodo])

  useEffect(() => {
    if (metodo === 'efectivo') setReferenciaPago('')
  }, [metodo])

  useEffect(() => {
    const n = digitsOnly(docNumero)
    if (n.length !== docLen) return
    let cancelled = false
    void (async () => {
      setLookupBusy(true)
      setLookupMsg('')
      try {
        if (tipo === '01') {
          const data = (await window.mebsy.identity.ruc(n)) as {
            razonSocial?: string
            direccion?: string | null
          }
          if (cancelled) return
          setRazonSocial(data.razonSocial || '')
          setDireccion(data.direccion || '')
          setLookupMsg('Datos obtenidos de PeruAPI')
        } else {
          const data = (await window.mebsy.identity.dni(n)) as {
            nombre?: string
          }
          if (cancelled) return
          setRazonSocial(data.nombre || '')
          setLookupMsg('Nombre obtenido de PeruAPI')
        }
      } catch (err) {
        if (!cancelled) setLookupMsg(parseIpcError(err))
      } finally {
        if (!cancelled) setLookupBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [docNumero, docLen, tipo])

  useEffect(() => {
    if (!pickerOpen) return
    void (async () => {
      try {
        const [cats, marks] = await Promise.all([
          window.mebsy.categories.list() as Promise<CatOpt[]>,
          window.mebsy.brands.list() as Promise<BrandOpt[]>
        ])
        setCategories(cats)
        setBrands(marks)
      } catch {
        /* ignore */
      }
    })()
  }, [pickerOpen])

  useEffect(() => {
    if (!pickerOpen || !sucursal) return
    const t = window.setTimeout(() => {
      void loadPickerProducts()
    }, 200)
    return () => window.clearTimeout(t)
  }, [pickerOpen, pickerQ, pickerCat, pickerMarca, sucursal?.id])

  async function loadPickerProducts() {
    if (!sucursal) return
    setPickerLoading(true)
    try {
      const data = (await window.mebsy.products.list(
        sucursal.id,
        pickerQ.trim() || undefined,
        pickerCat ? Number(pickerCat) : undefined,
        pickerMarca ? Number(pickerMarca) : undefined,
        { limit: 80, page: 1 }
      )) as
        | { items: ProductWithStock[]; total: number; limit: number }
        | ProductWithStock[]
      setPickerProducts(Array.isArray(data) ? data : data.items)
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setPickerLoading(false)
    }
  }

  function addProduct(p: ProductWithStock) {
    if (p.stock <= 0) return
    setCart((prev) => {
      const existing = prev.find((l) => l.productoId === p.id)
      if (existing) {
        if (existing.cantidad >= p.stock) return prev
        return prev.map((l) =>
          l.productoId === p.id
            ? { ...l, cantidad: l.cantidad + 1, stock: p.stock }
            : l
        )
      }
      return [
        ...prev,
        {
          productoId: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
          precio: Number(p.precio),
          cantidad: 1,
          stock: Number(p.stock),
          afectacionIgv: p.afectacionIgv
        }
      ]
    })
  }

  function setQty(productoId: number, qty: number) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.productoId !== productoId) return l
          const cantidad = Math.max(0, Math.min(l.stock, Math.floor(qty)))
          return { ...l, cantidad }
        })
        .filter((l) => l.cantidad > 0)
    )
  }

  function removeLine(productoId: number) {
    setCart((prev) => prev.filter((l) => l.productoId !== productoId))
  }

  async function resolveClienteId(): Promise<number> {
    const numero = digitsOnly(docNumero)
    const tipoDoc = tipo === '01' ? '6' : '1'
    const cacheKey = `${tipoDoc}:${numero}`
    const cached = clienteCache.current.get(cacheKey)
    if (cached) return cached

    const existing = (await window.mebsy.customers.list(numero)) as Array<{
      id: number
      tipoDocumento: string
      numeroDocumento: string
    }>
    const match = existing.find(
      (c) =>
        c.numeroDocumento === numero &&
        (c.tipoDocumento === tipoDoc ||
          c.tipoDocumento === String(Number(tipoDoc)))
    )
    if (match) {
      clienteCache.current.set(cacheKey, match.id)
      return match.id
    }

    const created = (await window.mebsy.customers.create({
      tipoDocumento: tipoDoc,
      numeroDocumento: numero,
      nombre: razonSocial.trim(),
      direccion: direccion.trim() || undefined
    })) as { id: number }
    clienteCache.current.set(cacheKey, created.id)
    return created.id
  }

  async function emit() {
    if (!user || !sucursal || !canEmit) return
    setBusy(true)
    setError('')
    setLastSale(null)
    try {
      const clienteId = await resolveClienteId()
      const result = (await window.mebsy.sales.create({
        sucursalId: Number(sucursal.id),
        usuarioId: Number(user.id),
        clienteId,
        tipoComprobante: tipo,
        metodoPago: metodo,
        serie,
        observaciones: observaciones.trim() || null,
        referenciaPago:
          metodo === 'yape' ? referenciaPago.trim() || null : null,
        fechaEmision,
        pagos: [
          {
            metodo,
            monto: metodo === 'yape' ? total : montoNum
          }
        ],
        items: cart.map((l) => ({
          productoId: l.productoId,
          cantidad: l.cantidad,
          precioUnitario: l.precio
        }))
      })) as SaleResult

      setCart([])
      setObservaciones('')
      setReferenciaPago('')
      setDocNumero('')
      setRazonSocial('')
      setDireccion('')
      setLookupMsg('')
      setMetodo('efectivo')
      setMontoPago('')

      // Avance local del correlativo; recarga de series en background (no bloquea impresión)
      setSeries((prev) =>
        prev.map((s) =>
          s.serie === result.serie &&
          String(s.tipoDocumento) === String(tipo)
            ? { ...s, correlativo: Number(result.correlativo) + 1 }
            : s
        )
      )
      void window.mebsy.branches
        .series(sucursal.id)
        .then((rows) => setSeries(rows as SerieRow[]))
        .catch(() => undefined)

      setLastSale(result)
      void printSaleTicket(result).finally(() => setLastSale(null))
      if (result.seeError) {
        setError(
          `Comprobante ${result.serie}-${String(result.correlativo).padStart(8, '0')} guardado. SUNAT: ${result.seeError}`
        )
      } else {
        setError('')
      }
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Nuevo comprobante"
        subtitle={`${sucursal?.nombre ?? ''} · ${user?.nombre ?? ''}`}
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {lastSale ? (
        <Alert tone={lastSale.seeError ? 'warn' : 'ok'}>
          {lastSale.serie}-{String(lastSale.correlativo).padStart(8, '0')}
          {lastSale.seeError
            ? ` emitido. SUNAT: ${lastSale.seeError}`
            : ' — abriendo impresión…'}
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <h2 className="text-sm font-semibold tracking-tight">Datos generales</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Sucursal">
                <Input value={sucursal?.nombre ?? ''} readOnly />
              </Field>
              <Field label="Vendedor">
                <Input value={user?.nombre ?? ''} readOnly />
              </Field>
              <Field label="Tipo">
                <Select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoCpe)}
                >
                  <option value="03">Boleta</option>
                  <option value="01">Factura</option>
                </Select>
              </Field>
              <Field label="Serie">
                <Select
                  value={serie}
                  onChange={(e) => setSerie(e.target.value)}
                  disabled={!seriesForTipo.length}
                >
                  {!seriesForTipo.length ? (
                    <option value="">Sin serie configurada</option>
                  ) : (
                    seriesForTipo.map((s) => (
                      <option key={s.serie} value={s.serie}>
                        {s.serie}
                      </option>
                    ))
                  )}
                </Select>
              </Field>
              <Field label="Moneda">
                <Input value="PEN" readOnly />
              </Field>
              <Field label="Fecha emisión">
                <DateInput value={fechaEmision} onChange={setFechaEmision} />
              </Field>
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <h2 className="text-sm font-semibold tracking-tight">Cliente</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={docLabel}>
                <Input
                  value={docNumero}
                  inputMode="numeric"
                  maxLength={docLen}
                  placeholder={docLen === 11 ? '11 dígitos' : '8 dígitos'}
                  onChange={(e) => setDocNumero(digitsOnly(e.target.value).slice(0, docLen))}
                />
              </Field>
              <Field label="Razón social / Nombre">
                <Input
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value)}
                  disabled={lookupBusy}
                />
              </Field>
              <Field label="Dirección" className="sm:col-span-2">
                <Input
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder={tipo === '03' ? 'Opcional (DNI no trae dirección)' : ''}
                />
              </Field>
            </div>
            {lookupBusy ? (
              <p className="text-xs text-[var(--ms-muted)]">Consultando PeruAPI…</p>
            ) : lookupMsg ? (
              <p className="text-xs text-[var(--ms-muted)]">{lookupMsg}</p>
            ) : null}
          </Card>

          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold tracking-tight">Productos</h2>
              <Button type="button" variant="dark" size="sm" onClick={() => setPickerOpen(true)}>
                <Plus size={14} />
                Agregar productos
              </Button>
            </div>
            {cart.length === 0 ? (
              <p className="text-sm text-[var(--ms-muted)]">
                Aún no hay productos en el comprobante.
              </p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Código</Th>
                    <Th>Producto</Th>
                    <Th className="text-right">Cant.</Th>
                    <Th className="text-right">P.U.</Th>
                    <Th className="text-right">Total</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.productoId}>
                      <Td className="font-mono text-xs">{l.codigo}</Td>
                      <Td>{l.nombre}</Td>
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => setQty(l.productoId, l.cantidad - 1)}
                          >
                            <Minus size={14} />
                          </Button>
                          <span className="min-w-[1.5rem] text-center text-sm">
                            {l.cantidad}
                          </span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={l.cantidad >= l.stock}
                            onClick={() => setQty(l.productoId, l.cantidad + 1)}
                          >
                            <Plus size={14} />
                          </Button>
                        </div>
                      </Td>
                      <Td className="text-right">{formatPen(l.precio)}</Td>
                      <Td className="text-right font-medium">{formatPen(l.total)}</Td>
                      <Td className="text-right">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeLine(l.productoId)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <h2 className="text-sm font-semibold tracking-tight">Formas de pago</h2>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={metodo === 'efectivo' ? 'dark' : 'secondary'}
                onClick={() => setMetodo('efectivo')}
              >
                <Banknote size={16} />
                Efectivo
              </Button>
              <Button
                type="button"
                variant={metodo === 'yape' ? 'dark' : 'secondary'}
                onClick={() => setMetodo('yape')}
              >
                <Smartphone size={16} />
                Yape / Plin
              </Button>
            </div>
            <Field label="Monto recibido">
              <Input
                inputMode="decimal"
                value={metodo === 'yape' ? (total > 0 ? String(total) : '') : montoPago}
                readOnly={metodo === 'yape'}
                onChange={(e) => {
                  if (metodo === 'efectivo') setMontoPago(e.target.value)
                }}
              />
            </Field>
            {metodo === 'yape' ? (
              <Field label="Referencia (opcional)">
                <Input
                  value={referenciaPago}
                  placeholder="Nº operación"
                  onChange={(e) => setReferenciaPago(e.target.value)}
                />
              </Field>
            ) : null}
            {metodo === 'efectivo' && vuelto > 0 ? (
              <p className="text-sm">
                Vuelto: <strong>{formatPen(vuelto)}</strong>
              </p>
            ) : null}
          </Card>

          <Card className="space-y-3 p-4">
            <h2 className="text-sm font-semibold tracking-tight">Resumen</h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--ms-muted)]">Op. gravada</span>
                <span>{formatPen(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ms-muted)]">IGV ({igvPct}%)</span>
                <span>{formatPen(igv)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>{formatPen(total)}</span>
              </div>
              {metodo === 'efectivo' ? (
                <div className="flex justify-between">
                  <span className="text-[var(--ms-muted)]">Vuelto</span>
                  <span>{formatPen(vuelto)}</span>
                </div>
              ) : null}
            </div>
            <Field label="Observaciones">
              <Textarea
                rows={3}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              />
            </Field>
            <Button
              type="button"
              variant="dark"
              className="w-full"
              disabled={!canEmit}
              onClick={() => void emit()}
            >
              {busy ? 'Emitiendo…' : 'Emitir comprobante'}
            </Button>
          </Card>
        </div>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent
          title="Agregar productos"
          description="Busca por código o nombre y filtra por categoría o marca."
          className="w-[min(720px,calc(100vw-2rem))]"
        >
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr]">
              <Field label="Buscar">
                <div className="relative">
                  <Search
                    size={14}
                    className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[var(--ms-muted)]"
                  />
                  <Input
                    className="pl-8"
                    value={pickerQ}
                    onChange={(e) => setPickerQ(e.target.value)}
                    placeholder="Código, barras o nombre"
                  />
                </div>
              </Field>
              <Field label="Categoría">
                <Select
                  value={pickerCat}
                  onChange={(e) => setPickerCat(e.target.value)}
                >
                  <option value="">Todas</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Marca">
                <Select
                  value={pickerMarca}
                  onChange={(e) => setPickerMarca(e.target.value)}
                >
                  <option value="">Todas</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nombre}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="max-h-[50vh] overflow-auto rounded-[6px] border border-[var(--ms-line)]">
              {pickerLoading ? (
                <p className="p-4 text-sm text-[var(--ms-muted)]">Cargando…</p>
              ) : pickerProducts.length === 0 ? (
                <p className="p-4 text-sm text-[var(--ms-muted)]">Sin productos</p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Código</Th>
                      <Th>Nombre</Th>
                      <Th className="text-right">Stock</Th>
                      <Th className="text-right">Precio</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pickerProducts.map((p) => {
                      const inCart =
                        cart.find((c) => c.productoId === p.id)?.cantidad ?? 0
                      const disabled = p.stock <= 0 || inCart >= p.stock
                      return (
                        <tr
                          key={p.id}
                          className={
                            disabled
                              ? 'opacity-50'
                              : 'cursor-pointer hover:bg-[var(--ms-bg)]'
                          }
                          onClick={() => {
                            if (!disabled) addProduct(p)
                          }}
                        >
                          <Td className="font-mono text-xs">{p.codigo}</Td>
                          <Td>
                            <div>{p.nombre}</div>
                            <div className="text-xs text-[var(--ms-muted)]">
                              {p.marcaNombre} · {p.categoriaNombre}
                            </div>
                          </Td>
                          <Td className="text-right">{p.stock}</Td>
                          <Td className="text-right">{formatPen(Number(p.precio))}</Td>
                        </tr>
                      )
                    })}
                  </tbody>
                </Table>
              )}
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="secondary" onClick={() => setPickerOpen(false)}>
                Listo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
