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

interface Category {
  id: number
  nombre: string
  productosCount?: number
}

export function CategoriesPage() {
  const { user } = useSession()
  const isAdmin = user?.rol === 'admin'
  const [rows, setRows] = useState<Category[]>([])
  const [nombre, setNombre] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [busy, setBusy] = useState(false)

  async function reload(q?: string) {
    setLoading(true)
    try {
      const data = (await window.mebsy.categories.list(
        q || undefined
      )) as Category[]
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
      await window.mebsy.categories.create(nombre)
      setNombre('')
      setMsg('Categoría creada')
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
      await window.mebsy.categories.update(editId, editNombre)
      setEditId(null)
      setMsg('Categoría actualizada')
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
      await window.mebsy.categories.delete(deleteTarget.id)
      setDeleteTarget(null)
      setMsg('Categoría eliminada')
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
      <PageHeader
        title="Categorías"
        subtitle="Clasificación del catálogo de productos"
      />
      <div className="mb-3 space-y-2">
        {error ? <Alert>{error}</Alert> : null}
        {msg ? <Alert tone="ok">{msg}</Alert> : null}
      </div>

      {isAdmin ? (
        <Card className="mb-4 p-4">
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={onCreate}>
            <Input
              placeholder="Nueva categoría…"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="sm:flex-1"
            />
            <Button type="submit">Agregar categoría</Button>
          </form>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--ms-line)] bg-[var(--ms-panel)] p-3">
          <Input
            placeholder="Buscar categorías…"
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
            {query ? 'Sin resultados' : 'No hay categorías'}
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
              {rows.map((c) => (
                <tr key={c.id}>
                  <Td className="font-mono text-xs">{c.id}</Td>
                  <Td>
                    {editId === c.id ? (
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
                      c.nombre
                    )}
                  </Td>
                  <Td className="font-mono">{c.productosCount ?? 0}</Td>
                  <Td className="text-right">
                    {isAdmin && editId !== c.id ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditId(c.id)
                            setEditNombre(c.nombre)
                          }}
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteTarget(c)}
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
        title="Eliminar categoría"
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
