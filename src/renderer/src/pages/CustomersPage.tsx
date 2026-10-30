import { FormEvent, useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  Td,
  Th
} from '../components/ui'
import { parseIpcError } from '../lib/errors'

interface Cliente {
  id: number
  tipoDocumento: string
  numeroDocumento: string
  nombre: string
  direccion: string | null
}

const DOC_OPTIONS = [
  { value: '1', label: 'DNI' },
  { value: '6', label: 'RUC' },
  { value: '4', label: 'C.E.' },
  { value: '0', label: 'Otros' }
] as const

function docLabel(tipo: string): string {
  return DOC_OPTIONS.find((d) => d.value === String(tipo))?.label ?? tipo
}

export function CustomersPage() {
  const [rows, setRows] = useState<Cliente[]>([])
  const [query, setQuery] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState('1')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [nombre, setNombre] = useState('')
  const [direccion, setDireccion] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lookupBusy, setLookupBusy] = useState(false)

  async function reload(q?: string) {
    setLoading(true)
    setError('')
    try {
      const data = (await window.mebsy.customers.list(
        q || undefined
      )) as Cliente[]
      setRows(data)
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => void reload(query), query ? 200 : 0)
    return () => clearTimeout(t)
  }, [query])

  async function lookupIdentity() {
    const numero = numeroDocumento.replace(/\D/g, '')
    if (tipoDocumento === '1' && numero.length !== 8) {
      setError('El DNI debe tener 8 dígitos')
      return
    }
    if (tipoDocumento === '6' && numero.length !== 11) {
      setError('El RUC debe tener 11 dígitos')
      return
    }
    if (tipoDocumento !== '1' && tipoDocumento !== '6') return

    setLookupBusy(true)
    setError('')
    setMsg('')
    try {
      if (tipoDocumento === '1') {
        const data = (await window.mebsy.identity.dni(numero)) as {
          nombre?: string
        }
        if (data.nombre) setNombre(data.nombre)
        else setError('No se encontró el DNI')
      } else {
        const data = (await window.mebsy.identity.ruc(numero)) as {
          razonSocial?: string
          nombre?: string
          direccion?: string
        }
        const rs = data.razonSocial || data.nombre
        if (rs) setNombre(rs)
        else setError('No se encontró el RUC')
        if (data.direccion) setDireccion(data.direccion)
      }
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setLookupBusy(false)
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMsg('')
    setSaving(true)
    try {
      await window.mebsy.customers.create({
        tipoDocumento,
        numeroDocumento: numeroDocumento.trim(),
        nombre: nombre.trim(),
        direccion: direccion.trim() || undefined
      })
      setNumeroDocumento('')
      setNombre('')
      setDireccion('')
      setTipoDocumento('1')
      setMsg('Cliente creado')
      await reload(query || undefined)
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Directorio comercial para comprobantes y notas de venta"
      />

      <div className="mb-3 space-y-2">
        {error ? <Alert>{error}</Alert> : null}
        {msg ? <Alert tone="ok">{msg}</Alert> : null}
      </div>

      <Card className="mb-4 p-4">
        <h2 className="mb-3 text-sm font-semibold tracking-tight">
          Nuevo cliente
        </h2>
        <form className="space-y-3" onSubmit={onCreate}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Tipo doc.">
              <Select
                value={tipoDocumento}
                onChange={(e) => setTipoDocumento(e.target.value)}
              >
                {DOC_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Número">
              <div className="flex gap-2">
                <Input
                  value={numeroDocumento}
                  onChange={(e) => setNumeroDocumento(e.target.value)}
                  required
                  className="flex-1 font-mono"
                  placeholder={
                    tipoDocumento === '6'
                      ? '20123456789'
                      : tipoDocumento === '1'
                        ? '12345678'
                        : 'Número'
                  }
                />
                {tipoDocumento === '1' || tipoDocumento === '6' ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={lookupBusy}
                    onClick={() => void lookupIdentity()}
                    title="Consultar Reniec / SUNAT"
                  >
                    <Search size={14} />
                    {lookupBusy ? '…' : 'Buscar'}
                  </Button>
                ) : null}
              </div>
            </Field>
            <Field label="Nombre / Razón social">
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </Field>
            <Field label="Dirección">
              <Input
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Opcional"
              />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              <Plus size={14} />
              {saving ? 'Guardando…' : 'Agregar cliente'}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--ms-line)] bg-[var(--ms-panel)] p-3">
          <Input
            placeholder="Buscar por nombre o documento…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {loading ? (
          <p className="p-6 text-center text-sm text-[var(--ms-muted)]">
            Cargando…
          </p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--ms-muted)]">
            {query ? 'Sin resultados' : 'No hay clientes registrados'}
          </p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Tipo</Th>
                <Th>Número</Th>
                <Th>Nombre / Razón social</Th>
                <Th>Dirección</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <Badge tone="neutral">{docLabel(c.tipoDocumento)}</Badge>
                  </Td>
                  <Td className="font-mono text-xs">{c.numeroDocumento}</Td>
                  <Td className="font-medium">{c.nombre}</Td>
                  <Td className="text-[var(--ms-muted)]">
                    {c.direccion?.trim() ? c.direccion : '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
