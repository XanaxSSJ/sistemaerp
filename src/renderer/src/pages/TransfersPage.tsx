import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import type { InventoryStockRow } from '@core/types'
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  Td,
  Textarea,
  Th
} from '../components/ui'
import { parseIpcError } from '../lib/errors'
import { useSession } from '../store/session'

type Branch = {
  id: number
  codigo: string
  nombre: string
  activa: boolean
}

type Line = {
  productoId: number
  nombre: string
  codigo: string
  stock: number
  cantidad: string
}

export function TransfersPage() {
  const { sucursal } = useSession()
  const navigate = useNavigate()
  const [branches, setBranches] = useState<Branch[]>([])
  const [destinoId, setDestinoId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<InventoryStockRow[]>([])
  const [searching, setSearching] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void window.mebsy.branches.list().then((rows) => {
      setBranches(rows as Branch[])
    })
  }, [])

  useEffect(() => {
    if (!sucursal || !query.trim()) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      void (async () => {
        setSearching(true)
        try {
          const data = (await window.mebsy.inventory.stock({
            sucursalId: sucursal.id,
            q: query.trim(),
            page: 1,
            pageSize: 10
          })) as { items: InventoryStockRow[] }
          setResults(data.items.filter((p) => p.stock > 0))
        } catch (err) {
          setError(parseIpcError(err))
        } finally {
          setSearching(false)
        }
      })()
    }, 250)
    return () => clearTimeout(t)
  }, [query, sucursal?.id])

  const destinos = branches.filter(
    (b) => b.activa && b.id !== sucursal?.id
  )
  const destino = destinos.find((b) => String(b.id) === destinoId)

  function addProduct(p: InventoryStockRow) {
    if (lines.some((l) => l.productoId === p.id)) {
      setError('El producto ya está en la transferencia')
      return
    }
    setError('')
    setLines((prev) => [
      ...prev,
      {
        productoId: p.id,
        nombre: p.nombre,
        codigo: p.codigo,
        stock: p.stock,
        cantidad: '1'
      }
    ])
    setQuery('')
    setResults([])
  }

  function updateQty(productoId: number, cantidad: string) {
    setLines((prev) =>
      prev.map((l) => (l.productoId === productoId ? { ...l, cantidad } : l))
    )
  }

  function removeLine(productoId: number) {
    setLines((prev) => prev.filter((l) => l.productoId !== productoId))
  }

  function validateForm(): string | null {
    if (!sucursal) return 'No hay sucursal activa'
    if (!destinoId) return 'Selecciona la sucursal de destino'
    if (Number(destinoId) === sucursal.id) {
      return 'Origen y destino deben ser distintos'
    }
    if (!motivo.trim()) return 'El motivo es obligatorio'
    if (!lines.length) return 'Agrega al menos un producto'
    for (const l of lines) {
      const qty = Number(l.cantidad)
      if (!Number.isFinite(qty) || qty <= 0) {
        return `Cantidad inválida para ${l.nombre}`
      }
      if (qty > l.stock) {
        return `Stock insuficiente para ${l.nombre} (disponible: ${l.stock})`
      }
    }
    return null
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const err = validateForm()
    if (err) {
      setError(err)
      return
    }
    setError('')
    setConfirmOpen(true)
  }

  async function confirmTransfer() {
    if (!sucursal) return
    setSaving(true)
    setError('')
    try {
      await window.mebsy.transfers.create({
        sucursalOrigenId: sucursal.id,
        sucursalDestinoId: Number(destinoId),
        motivo: motivo.trim(),
        idempotencyKey: crypto.randomUUID(),
        items: lines.map((l) => ({
          productoId: l.productoId,
          cantidad: Number(l.cantidad)
        }))
      })
      setMsg('Transferencia registrada')
      setConfirmOpen(false)
      navigate('/transferencias/historial')
    } catch (err) {
      setError(parseIpcError(err))
      setConfirmOpen(false)
    } finally {
      setSaving(false)
    }
  }

  function clearForm() {
    setDestinoId('')
    setMotivo('')
    setLines([])
    setQuery('')
    setResults([])
    setError('')
    setMsg('')
  }

  return (
    <div>
      <PageHeader
        title="Nueva transferencia"
        subtitle={`Desde ${sucursal?.nombre ?? '—'}`}
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link to="/transferencias/historial">Ver historial</Link>
          </Button>
        }
      />

      <div className="mb-4 space-y-2">
        {error ? <Alert>{error}</Alert> : null}
        {msg ? <Alert tone="ok">{msg}</Alert> : null}
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="Sucursal de origen">
            <Input value={sucursal?.nombre ?? ''} readOnly disabled />
          </Field>
          <Field label="Sucursal de destino">
            <Select
              value={destinoId}
              onChange={(e) => setDestinoId(e.target.value)}
              required
            >
              <option value="">Seleccionar…</option>
              {destinos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.codigo} — {b.nombre}
                </option>
              ))}
            </Select>
          </Field>
        </Card>

        <Card className="p-4">
          <Field label="Buscar producto (nombre / SKU / código de barras)">
            <Input
              placeholder="Escribe para buscar…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          {searching ? (
            <p className="mt-2 text-xs text-[var(--ms-muted)]">Buscando…</p>
          ) : null}
          {results.length ? (
            <div className="mt-2 max-h-48 overflow-auto rounded-[6px] border border-[var(--ms-line)]">
              <Table>
                <thead>
                  <tr>
                    <Th>Producto</Th>
                    <Th>SKU</Th>
                    <Th>Stock</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {results.map((p) => (
                    <tr key={p.id}>
                      <Td>{p.nombre}</Td>
                      <Td className="font-mono text-xs">{p.codigo}</Td>
                      <Td className="font-mono">{p.stock}</Td>
                      <Td>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => addProduct(p)}
                        >
                          <Plus className="size-3.5" />
                          Agregar
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : null}

          <div className="mt-4">
            {lines.length === 0 ? (
              <p className="text-sm text-[var(--ms-muted)]">
                No hay productos en la transferencia.
              </p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Producto</Th>
                    <Th>SKU</Th>
                    <Th>Disponible</Th>
                    <Th>Cantidad</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.productoId}>
                      <Td>{l.nombre}</Td>
                      <Td className="font-mono text-xs">{l.codigo}</Td>
                      <Td className="font-mono">{l.stock}</Td>
                      <Td>
                        <Input
                          type="number"
                          min={0.001}
                          step="any"
                          className="w-24"
                          value={l.cantidad}
                          onChange={(e) =>
                            updateQty(l.productoId, e.target.value)
                          }
                          required
                        />
                      </Td>
                      <Td>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeLine(l.productoId)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <Field label="Motivo">
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Indica por qué se realiza el traslado…"
              required
            />
          </Field>
        </Card>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={clearForm}>
            Cancelar
          </Button>
          <Button type="submit">Registrar transferencia</Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirmar transferencia"
        description={
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-[var(--ms-muted)]">Origen:</span>{' '}
              {sucursal?.nombre}
            </p>
            <p>
              <span className="text-[var(--ms-muted)]">Destino:</span>{' '}
              {destino?.nombre ?? '—'}
            </p>
            <p>
              <span className="text-[var(--ms-muted)]">Motivo:</span> {motivo}
            </p>
            <ul className="list-disc pl-4">
              {lines.map((l) => (
                <li key={l.productoId}>
                  {l.nombre} ({l.codigo}): {l.cantidad}
                </li>
              ))}
            </ul>
          </div>
        }
        confirmLabel={saving ? 'Registrando…' : 'Confirmar'}
        tone="primary"
        busy={saving}
        onConfirm={() => void confirmTransfer()}
      />
    </div>
  )
}
