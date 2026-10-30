import { useEffect, useState } from 'react'
import {
  Ban,
  Eye,
  FileBarChart,
  MoreHorizontal,
  RefreshCw,
  Search
} from 'lucide-react'
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
import { parseIpcError } from '../lib/errors'
import { useSession } from '../store/session'

interface InvoiceRow {
  id: number
  tipoDocumento: string
  serie: string
  correlativo: number
  subtotal: number
  igv: number
  total: number
  metodoPago: string
  estado: string
  xmlPath: string | null
  pdfPath: string | null
  sunatAceptada: boolean | null
  sunatDescription: string | null
  createdAt: string
  clienteNombre: string | null
  clienteDocumento: string | null
  usuarioId: number
  usuarioNombre: string
}

type BuscarPor = 'comprobante' | 'fecha' | 'cliente'
type TipoDoc = '' | '01' | '03'

function toIsoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayIso() {
  return toIsoDate(new Date())
}

/** Rango inicial amplio para no ocultar comprobantes recientes. */
function defaultDesdeIso() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return toIsoDate(d)
}

function formatPen(n: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN'
  }).format(n)
}

function formatDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function tipoLabel(tipo: string) {
  if (tipo === '01') return 'Factura'
  if (tipo === '03') return 'Boleta'
  return tipo
}

function estadoTone(
  estado: string,
  aceptada: boolean | null
): 'ok' | 'warn' | 'danger' | 'accent' | 'neutral' {
  if (aceptada === true || estado === 'aceptado_sunat') return 'ok'
  if (estado.includes('error') || estado.includes('anul')) return 'danger'
  if (estado === 'rechazado_sunat' || estado.includes('see')) return 'warn'
  if (estado === 'generado') return 'warn'
  return 'neutral'
}

function sunatBadge(r: InvoiceRow) {
  if (r.sunatAceptada === true || r.estado === 'aceptado_sunat')
    return { tone: 'ok' as const, label: 'Aceptada' }
  if (r.estado === 'rechazado_sunat')
    return { tone: 'warn' as const, label: 'Rechazada' }
  if (r.sunatAceptada === false) return { tone: 'warn' as const, label: 'Pendiente' }
  if (r.estado.includes('error')) return { tone: 'danger' as const, label: 'Error' }
  if (r.estado.includes('anul')) return { tone: 'danger' as const, label: 'Anulado' }
  return { tone: 'neutral' as const, label: '—' }
}

export function InvoicesPage() {
  const { sucursal, user } = useSession()
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const [desde, setDesde] = useState(defaultDesdeIso())
  const [hasta, setHasta] = useState(todayIso())
  const [buscarPor, setBuscarPor] = useState<BuscarPor>('comprobante')
  const [buscarTexto, setBuscarTexto] = useState('')
  const [fechaEmision, setFechaEmision] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState<TipoDoc>('')
  const [vendedorId, setVendedorId] = useState('')
  const [vendors, setVendors] = useState<Array<{ id: number; nombre: string }>>(
    []
  )
  const [menuId, setMenuId] = useState<number | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  async function loadVendors() {
    if (!sucursal) return
    try {
      const data = (await window.mebsy.sales.vendors(sucursal.id)) as Array<{
        id: number
        nombre: string
      }>
      setVendors(data)
    } catch {
      if (user) setVendors([{ id: user.id, nombre: user.nombre }])
    }
  }

  async function reload(nextPage = page) {
    if (desde && hasta && desde > hasta) {
      setError('La fecha Desde no puede ser posterior a Hasta')
      return
    }
    setLoading(true)
    setError('')
    setMsg('')
    try {
      const data = (await window.mebsy.invoices.list({
        sucursalId: sucursal?.id,
        tipoDocumento: tipoDocumento || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
        usuarioId: vendedorId ? Number(vendedorId) : undefined,
        buscarPor,
        q:
          buscarPor === 'comprobante' || buscarPor === 'cliente'
            ? buscarTexto || undefined
            : undefined,
        fechaEmision:
          buscarPor === 'fecha' ? fechaEmision || undefined : undefined,
        page: nextPage,
        pageSize
      })) as { items: InvoiceRow[]; total: number; page: number }
      setRows(data.items)
      setTotal(data.total)
      setPage(data.page)
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setLoading(false)
    }
  }

  function clearFilters() {
    const desdeDefault = defaultDesdeIso()
    const hastaDefault = todayIso()
    setDesde(desdeDefault)
    setHasta(hastaDefault)
    setBuscarPor('comprobante')
    setBuscarTexto('')
    setFechaEmision('')
    setTipoDocumento('')
    setVendedorId('')
    setPage(1)
    void (async () => {
      setLoading(true)
      setError('')
      try {
        const data = (await window.mebsy.invoices.list({
          sucursalId: sucursal?.id,
          desde: desdeDefault,
          hasta: hastaDefault,
          page: 1,
          pageSize
        })) as { items: InvoiceRow[]; total: number; page: number }
        setRows(data.items)
        setTotal(data.total)
        setPage(data.page)
      } catch (err) {
        setError(parseIpcError(err))
      } finally {
        setLoading(false)
      }
    })()
  }

  useEffect(() => {
    void loadVendors()
    void reload(1)
  }, [sucursal?.id])

  useRealtimeRefresh(['sale.created', 'invoice.updated'], () => {
    void reload(page)
  })

  async function openDoc(r: InvoiceRow) {
    setMenuId(null)
    setError('')
    try {
      if (!r.pdfPath && r.sunatAceptada == null && !r.estado.includes('sunat') && !r.estado.includes('see')) {
        setMsg('Este comprobante aún no tiene PDF disponible')
        return
      }
      await window.mebsy.invoices.openPdfAuth(r.id)
    } catch (err) {
      setError(parseIpcError(err))
    }
  }

  function consultarSunat(_r: InvoiceRow) {
    setMenuId(null)
    setMsg('Consulta SUNAT: próximamente')
  }

  function anular(_r: InvoiceRow) {
    setMenuId(null)
    setMsg('Anulación / baja: próximamente')
  }

  function generarReporte() {
    setMsg('Generar reporte: próximamente')
  }

  const buscarLabel =
    buscarPor === 'comprobante'
      ? 'N° comprobante'
      : buscarPor === 'cliente'
        ? 'Cliente'
        : 'Fecha emisión'

  return (
    <div>
      <PageHeader
        title="Listas de comprobantes"
        subtitle={`${sucursal?.nombre ?? ''} · boletas y facturas`}
        actions={
          <Button variant="secondary" onClick={generarReporte}>
            <FileBarChart size={16} />
            Generar reporte
          </Button>
        }
      />

      <Card className="mb-4 p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
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
              <option value="comprobante">N° comprobante</option>
              <option value="fecha">Fecha de emisión</option>
              <option value="cliente">Cliente</option>
            </Select>
          </Field>
          <Field label={buscarLabel}>
            {buscarPor === 'fecha' ? (
              <DateInput value={fechaEmision} onChange={setFechaEmision} />
            ) : (
              <Input
                placeholder={
                  buscarPor === 'comprobante' ? 'B001-00000001' : 'Nombre o doc.'
                }
                value={buscarTexto}
                onChange={(e) => setBuscarTexto(e.target.value)}
                className={buscarPor === 'comprobante' ? 'font-mono' : undefined}
              />
            )}
          </Field>
          <Field label="Tipo">
            <Select
              value={tipoDocumento}
              onChange={(e) => setTipoDocumento(e.target.value as TipoDoc)}
            >
              <option value="">Todos</option>
              <option value="03">Boleta</option>
              <option value="01">Factura</option>
            </Select>
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
              onClick={() => void reload(1)}
              disabled={loading}
            >
              <Search size={14} />
              Filtrar
            </Button>
            <Button variant="secondary" onClick={clearFilters} disabled={loading}>
              Limpiar
            </Button>
          </div>
        </div>
      </Card>

      {error ? (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      {msg ? (
        <div className="mb-3">
          <Alert tone="warn">{msg}</Alert>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <Th>Fecha emisión</Th>
                <Th>Cliente</Th>
                <Th>Tipo</Th>
                <Th>Serie/Número</Th>
                <Th>Estado</Th>
                <Th>SUNAT</Th>
                <Th className="text-right">Gravada</Th>
                <Th className="text-right">IGV</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const sunat = sunatBadge(r)
                return (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap text-[12px] text-[var(--ms-muted)]">
                      {formatDateTime(r.createdAt)}
                    </Td>
                    <Td>
                      <div className="max-w-[180px] truncate text-[13px] font-medium">
                        {r.clienteNombre ?? '—'}
                      </div>
                      {r.clienteDocumento ? (
                        <div className="font-mono text-[11px] text-[var(--ms-muted)]">
                          {r.clienteDocumento}
                        </div>
                      ) : null}
                    </Td>
                    <Td>
                      <Badge
                        tone={r.tipoDocumento === '01' ? 'accent' : 'neutral'}
                      >
                        {tipoLabel(r.tipoDocumento)}
                      </Badge>
                    </Td>
                    <Td className="font-mono text-[12px]">
                      {r.serie}-{String(r.correlativo).padStart(8, '0')}
                    </Td>
                    <Td>
                      <Badge tone={estadoTone(r.estado, r.sunatAceptada)}>
                        {r.estado}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge tone={sunat.tone}>{sunat.label}</Badge>
                      {r.sunatDescription ? (
                        <div
                          className="mt-0.5 max-w-[140px] truncate text-[10px] text-[var(--ms-muted)]"
                          title={r.sunatDescription}
                        >
                          {r.sunatDescription}
                        </div>
                      ) : null}
                    </Td>
                    <Td className="text-right font-mono text-[12px]">
                      {formatPen(r.subtotal)}
                    </Td>
                    <Td className="text-right font-mono text-[12px]">
                      {formatPen(r.igv)}
                    </Td>
                    <Td className="text-right font-mono text-[13px] font-semibold">
                      {formatPen(r.total)}
                    </Td>
                    <Td className="text-right">
                      <div className="relative inline-flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setMenuId(menuId === r.id ? null : r.id)
                          }
                          aria-label="Acciones"
                        >
                          <MoreHorizontal size={14} />
                        </Button>
                        {menuId === r.id ? (
                          <div className="absolute top-full right-0 z-20 mt-1 w-48 overflow-hidden rounded-[8px] border border-[var(--ms-line)] bg-white shadow-lg">
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium hover:bg-[var(--ms-panel)]"
                              onClick={() => openDoc(r)}
                            >
                              <Eye size={14} />
                              Ver boleta
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium hover:bg-[var(--ms-panel)]"
                              onClick={() => consultarSunat(r)}
                            >
                              <RefreshCw size={14} />
                              Consultar SUNAT
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-[var(--ms-danger)] hover:bg-[var(--ms-danger-soft)]"
                              onClick={() => anular(r)}
                            >
                              <Ban size={14} />
                              Anular
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                )
              })}
              {!loading && rows.length === 0 ? (
                <tr>
                  <Td
                    colSpan={10}
                    className="py-10 text-center text-[var(--ms-muted)]"
                  >
                    No hay comprobantes en el rango seleccionado
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--ms-line)] px-3 py-2 text-sm">
          <span className="text-[var(--ms-muted)]">
            {loading
              ? 'Cargando…'
              : `${total} registro${total === 1 ? '' : 's'}`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1 || loading}
              onClick={() => void reload(page - 1)}
            >
              Anterior
            </Button>
            <span className="font-mono text-[12px]">
              {page}/{totalPages}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= totalPages || loading}
              onClick={() => void reload(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
