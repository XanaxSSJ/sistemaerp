import { FormEvent, useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  Input,
  PageHeader,
  Table,
  Td,
  Th
} from '../components/ui'
import { parseIpcError } from '../lib/errors'
import { useSession } from '../store/session'

interface Brand {
  id: number
  nombre: string
  productosCount?: number
}

export function BrandsPage() {
  const { user } = useSession()
  const isAdmin = user?.rol === 'admin'
  const [rows, setRows] = useState<Brand[]>([])
  const [nombre, setNombre] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null)
  const [busy, setBusy] = useState(false)

  async function reload(q?: string) {
    setLoading(true)
    try {
      const data = (await window.mebsy.brands.list(q || undefined)) as Brand[]
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

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!isAdmin) return
    setError('')
    setMsg('')
    try {
      await window.mebsy.brands.create(nombre)
      setNombre('')
      setMsg('Marca creada')
      await reload(query)
    } catch (err) {
      setError(parseIpcError(err))
    }
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (editId == null || !isAdmin) return
    setError('')
    setMsg('')
    try {
      await window.mebsy.brands.update(editId, editNombre)
      setEditId(null)
      setMsg('Marca actualizada')
      await reload(query)
    } catch (err) {
      setError(parseIpcError(err))
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setBusy(true)
    setError('')
    setMsg('')
    try {
      await window.mebsy.brands.delete(deleteTarget.id)
      setDeleteTarget(null)
      setMsg('Marca eliminada')
      await reload(query)
    } catch (err) {
      setError(parseIpcError(err))
      setDeleteTarget(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Marcas" subtitle="Marcas del catálogo de productos" />
      <div className="mb-3 space-y-2">
        {error ? <Alert>{error}</Alert> : null}
        {msg ? <Alert tone="ok">{msg}</Alert> : null}
      </div>

      {isAdmin ? (
        <Card className="mb-4 p-4">
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={onCreate}>
            <Input
              placeholder="Nueva marca…"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="sm:flex-1"
            />
            <Button type="submit">Agregar marca</Button>
          </form>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--ms-line)] bg-[var(--ms-panel)] p-3">
          <Input
            placeholder="Buscar marcas…"
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
            {query ? 'Sin resultados' : 'No hay marcas'}
          </p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>Nombre</Th>
                <Th>Productos</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <Td className="font-mono text-xs">{b.id}</Td>
                  <Td>
                    {editId === b.id ? (
                      <form className="flex gap-2" onSubmit={onSaveEdit}>
                        <Input
                          value={editNombre}
                          onChange={(e) => setEditNombre(e.target.value)}
                          required
                        />
                        <Button type="submit" size="sm">
                          Guardar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditId(null)}
                        >
                          Cancelar
                        </Button>
                      </form>
                    ) : (
                      b.nombre
                    )}
                  </Td>
                  <Td className="font-mono">{b.productosCount ?? 0}</Td>
                  <Td className="text-right">
                    {isAdmin && editId !== b.id ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditId(b.id)
                            setEditNombre(b.nombre)
                          }}
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteTarget(b)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Eliminar marca"
        description={
          deleteTarget
            ? `¿Eliminar «${deleteTarget.nombre}»? Si tiene productos asociados, la operación se rechazará.`
            : ''
        }
        confirmLabel="Eliminar"
        busy={busy}
        onConfirm={confirmDelete}
      />
    </div>
  )
}