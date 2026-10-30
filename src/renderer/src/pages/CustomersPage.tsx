import { FormEvent, useEffect, useState } from 'react'
import {
  Alert,
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

export function CustomersPage() {
  const [rows, setRows] = useState<Cliente[]>([])
  const [query, setQuery] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState('1')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [nombre, setNombre] = useState('')
  const [direccion, setDireccion] = useState('')
  const [error, setError] = useState('')

  async function reload(q?: string) {
    const data = (await window.mebsy.customers.list(q)) as Cliente[]
    setRows(data)
  }

  useEffect(() => {
    void reload()
  }, [])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await window.mebsy.customers.create({
        tipoDocumento,
        numeroDocumento,
        nombre,
        direccion
      })
      setNumeroDocumento('')
      setNombre('')
      setDireccion('')
      await reload(query || undefined)
    } catch (err) {
      setError(parseIpcError(err))
    }
  }

  return (
    <div>
      <PageHeader title="Clientes" subtitle="Directorio comercial" />
      {error ? (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Nuevo cliente</h2>
          <form className="space-y-2.5" onSubmit={onCreate}>
            <Field label="Tipo doc.">
              <Select
                value={tipoDocumento}
                onChange={(e) => setTipoDocumento(e.target.value)}
              >
                <option value="1">DNI</option>
                <option value="6">RUC</option>
                <option value="4">C.E.</option>
                <option value="0">Otros</option>
              </Select>
            </Field>
            <Field label="Número">
              <Input
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value)}
                required
              />
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
              />
            </Field>
            <Button type="submit" className="w-full">
              Guardar
            </Button>
          </form>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-[var(--ms-line)] bg-[var(--ms-panel)] p-3">
            <Input
              placeholder="Buscar…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                void reload(e.target.value || undefined)
              }}
            />
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Doc</Th>
                <Th>Número</Th>
                <Th>Nombre</Th>
                <Th>Dirección</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <Td className="font-mono text-xs">{c.tipoDocumento}</Td>
                  <Td className="font-mono text-xs">{c.numeroDocumento}</Td>
                  <Td>{c.nombre}</Td>
                  <Td className="text-[var(--ms-muted)]">
                    {c.direccion ?? '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
