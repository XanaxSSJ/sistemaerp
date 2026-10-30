import { FormEvent, useEffect, useState } from 'react'
import { Pencil, Settings2 } from 'lucide-react'
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
  Table,
  Td,
  Th
} from '../components/ui'
import { parseIpcError } from '../lib/errors'
import { useSession } from '../store/session'

interface Sucursal {
  id: number
  codigo: string
  nombre: string
  direccion: string
  telefono: string | null
  activa: boolean
  nubefactRuta: string | null
  nubefactConfigured: boolean
  nubefactTokenMasked: string | null
}

interface Serie {
  id: number
  tipoDocumento: string
  serie: string
  correlativo: number
  label?: string
  hint?: string
}

const emptyForm = {
  codigo: '',
  nombre: '',
  direccion: '',
  telefono: '',
  nubefactRuta: '',
  nubefactToken: ''
}

export function BranchesPage() {
  const { user } = useSession()
  const isAdmin = user?.rol === 'admin'

  const [rows, setRows] = useState<Sucursal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const [seriesOpen, setSeriesOpen] = useState(false)
  const [seriesBranchId, setSeriesBranchId] = useState<number | null>(null)
  const [series, setSeries] = useState<Serie[]>([])
  const [savingSeries, setSavingSeries] = useState(false)

  async function reload() {
    setLoading(true)
    setError('')
    try {
      const data = (await window.mebsy.branches.list()) as Sucursal[]
      setRows(data)
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const seriesBranch = rows.find((r) => r.id === seriesBranchId)

  function openCreate() {
    setEditId(null)
    setForm(emptyForm)
    setError('')
    setFormOpen(true)
  }

  function openEdit(s: Sucursal) {
    setEditId(s.id)
    setForm({
      codigo: s.codigo,
      nombre: s.nombre,
      direccion: s.direccion,
      telefono: s.telefono ?? '',
      nubefactRuta: s.nubefactRuta ?? '',
      nubefactToken: ''
    })
    setError('')
    setFormOpen(true)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isAdmin) return
    setSaving(true)
    setError('')
    setMsg('')
    try {
      if (editId != null) {
        await window.mebsy.branches.update(editId, {
          codigo: form.codigo,
          nombre: form.nombre,
          direccion: form.direccion,
          telefono: form.telefono,
          nubefactRuta: form.nubefactRuta || null,
          ...(form.nubefactToken.trim()
            ? { nubefactToken: form.nubefactToken.trim() }
            : {})
        })
        setMsg('Sucursal actualizada')
      } else {
        await window.mebsy.branches.create({
          codigo: form.codigo,
          nombre: form.nombre,
          direccion: form.direccion,
          telefono: form.telefono,
          nubefactRuta: form.nubefactRuta || null,
          nubefactToken: form.nubefactToken || null
        })
        setMsg('Sucursal creada')
      }
      setFormOpen(false)
      await reload()
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setSaving(false)
    }
  }

  async function openSeries(id: number) {
    setSeriesBranchId(id)
    setError('')
    setMsg('')
    try {
      const data = (await window.mebsy.branches.series(id)) as Serie[]
      setSeries(data)
      setSeriesOpen(true)
    } catch (err) {
      setError(parseIpcError(err))
    }
  }

  function patchSerie(
    tipoDocumento: string,
    field: 'serie' | 'correlativo',
    value: string
  ) {
    setSeries((prev) =>
      prev.map((s) =>
        s.tipoDocumento === tipoDocumento
          ? {
              ...s,
              [field]:
                field === 'correlativo'
                  ? Math.max(1, Number(value) || 1)
                  : value.toUpperCase()
            }
          : s
      )
    )
  }

  async function saveSeries(e: FormEvent) {
    e.preventDefault()
    if (seriesBranchId == null || !isAdmin) return
    setSavingSeries(true)
    setError('')
    setMsg('')
    try {
      const updated = (await window.mebsy.branches.updateSeries(
        seriesBranchId,
        series.map((s) => ({
          tipoDocumento: s.tipoDocumento,
          serie: s.serie.trim(),
          correlativo: Number(s.correlativo)
        }))
      )) as Serie[]
      setSeries(updated)
      setMsg('Series guardadas')
      setSeriesOpen(false)
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setSavingSeries(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Sucursales"
        subtitle="Sedes, Nubefact y series SUNAT"
        actions={
          isAdmin ? (
            <Button type="button" onClick={openCreate}>
              + Nueva sucursal
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 space-y-2">
        {error ? <Alert>{error}</Alert> : null}
        {msg ? <Alert tone="ok">{msg}</Alert> : null}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-[var(--ms-muted)]">Cargando…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-[var(--ms-muted)]">
            No hay sucursales.
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Nombre</Th>
                <Th>Dirección</Th>
                <Th>Nubefact</Th>
                <Th>Estado</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <Td className="font-mono text-xs">{s.codigo}</Td>
                  <Td className="font-semibold">{s.nombre}</Td>
                  <Td className="max-w-[220px] truncate text-[var(--ms-muted)]">
                    {s.direccion}
                  </Td>
                  <Td>
                    <Badge tone={s.nubefactConfigured ? 'ok' : 'neutral'}>
                      {s.nubefactConfigured ? 'Configurado' : 'Sin API'}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={s.activa ? 'ok' : 'neutral'}>
                      {s.activa ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {isAdmin ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => openEdit(s)}
                        >
                          <Pencil className="size-3.5" />
                          Editar
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void openSeries(s.id)}
                      >
                        <Settings2 className="size-3.5" />
                        Series
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent
          title={editId != null ? 'Editar sucursal' : 'Nueva sucursal'}
          description="Datos de la sede y credenciales Nubefact"
          className="w-[min(520px,calc(100vw-2rem))]"
        >
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Código">
                <Input
                  className="font-mono"
                  value={form.codigo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, codigo: e.target.value }))
                  }
                  required
                />
              </Field>
              <Field label="Nombre">
                <Input
                  value={form.nombre}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nombre: e.target.value }))
                  }
                  required
                />
              </Field>
            </div>
            <Field label="Dirección">
              <Input
                value={form.direccion}
                onChange={(e) =>
                  setForm((f) => ({ ...f, direccion: e.target.value }))
                }
                required
              />
            </Field>
            <Field label="Teléfono">
              <Input
                value={form.telefono}
                onChange={(e) =>
                  setForm((f) => ({ ...f, telefono: e.target.value }))
                }
              />
            </Field>

            <div className="rounded-[6px] border border-[var(--ms-line)] bg-[var(--ms-panel)] p-3">
              <div className="mb-2 text-[10px] font-bold tracking-[0.08em] text-[var(--ms-muted)] uppercase">
                Nubefact (por sede)
              </div>
              <Field label="Ruta API">
                <Input
                  className="font-mono text-xs"
                  placeholder="https://api.nubefact.com/api/v1/…"
                  value={form.nubefactRuta}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nubefactRuta: e.target.value }))
                  }
                />
              </Field>
              <Field
                label={
                  editId != null && !form.nubefactToken
                    ? 'Token (vacío = no cambiar)'
                    : 'Token'
                }
                className="mt-2.5"
              >
                <Input
                  className="font-mono text-xs"
                  type="password"
                  autoComplete="off"
                  placeholder={
                    editId != null
                      ? rows.find((r) => r.id === editId)
                          ?.nubefactTokenMasked ?? '••••••••'
                      : 'Token de integración'
                  }
                  value={form.nubefactToken}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nubefactToken: e.target.value }))
                  }
                />
              </Field>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => setFormOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? 'Guardando…'
                  : editId != null
                    ? 'Guardar cambios'
                    : 'Crear sucursal'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={seriesOpen} onOpenChange={setSeriesOpen}>
        <DialogContent
          title={`Series · ${seriesBranch?.nombre ?? ''}`}
          description="Deben coincidir con Nubefact (máx. 4 caracteres). El correlativo es el próximo número a emitir."
          className="w-[min(560px,calc(100vw-2rem))]"
        >
          <form className="space-y-3" onSubmit={saveSeries}>
            <div className="grid grid-cols-[1fr_88px_88px] gap-2 border-b border-[var(--ms-line)] pb-2 text-[10px] font-bold tracking-[0.08em] text-[var(--ms-muted)] uppercase">
              <div>Documento</div>
              <div>Serie</div>
              <div>Corr.</div>
            </div>
            {series.map((s) => (
              <div
                key={s.tipoDocumento}
                className="grid grid-cols-[1fr_88px_88px] items-center gap-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {s.label ?? s.tipoDocumento}
                  </div>
                  {s.hint ? (
                    <div className="text-[11px] text-[var(--ms-muted)]">
                      {s.hint}
                    </div>
                  ) : null}
                </div>
                <Input
                  className="font-mono text-xs"
                  maxLength={4}
                  value={s.serie}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    patchSerie(s.tipoDocumento, 'serie', e.target.value)
                  }
                  required
                />
                <Input
                  className="font-mono text-xs"
                  type="number"
                  min={1}
                  value={s.correlativo}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    patchSerie(s.tipoDocumento, 'correlativo', e.target.value)
                  }
                  required
                />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                disabled={savingSeries}
                onClick={() => setSeriesOpen(false)}
              >
                Cerrar
              </Button>
              {isAdmin ? (
                <Button type="submit" disabled={savingSeries}>
                  {savingSeries ? 'Guardando…' : 'Guardar series'}
                </Button>
              ) : null}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
