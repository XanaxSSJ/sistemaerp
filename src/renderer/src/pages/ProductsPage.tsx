import { FormEvent, useEffect, useRef, useState } from 'react'
import { Pencil, Plus, Trash2, Upload } from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
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
import { parseIpcError } from '../lib/errors'
import {
  downloadProductTemplate,
  parseProductImportFile,
  type ImportRow
} from '../lib/product-import'
import { useSession } from '../store/session'

interface CatalogProduct {
  id: number
  codigo: string
  codigoBarras: string | null
  nombre: string
  descripcion: string | null
  precio: number
  categoriaId: number
  marcaId: number
  categoriaNombre: string
  marcaNombre: string
}

interface Option {
  id: number
  nombre: string
}

interface CatalogResponse {
  items: CatalogProduct[]
  total: number
  page: number
  pageSize: number
}

interface ValidateResult {
  total: number
  valid: number
  invalid: number
  newCategories: string[]
  newBrands: string[]
  errors: Array<{ row: number; field: string; message: string }>
  validRows: ImportRow[]
}

function money(n: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN'
  }).format(n)
}

const emptyForm = {
  nombre: '',
  codigo: '',
  codigoBarras: '',
  descripcion: '',
  precio: '0',
  categoriaId: '',
  marcaId: ''
}

export function ProductsPage() {
  const { user } = useSession()
  const isAdmin = user?.rol === 'admin'

  const [items, setItems] = useState<CatalogProduct[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const [categories, setCategories] = useState<Option[]>([])
  const [brands, setBrands] = useState<Option[]>([])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogProduct | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const [newCatMode, setNewCatMode] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newBrandMode, setNewBrandMode] = useState(false)
  const [newBrandName, setNewBrandName] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<CatalogProduct | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(
    null
  )
  const [importBusy, setImportBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadOptions() {
    const [cats, brs] = await Promise.all([
      window.mebsy.categories.list() as Promise<Option[]>,
      window.mebsy.brands.list() as Promise<Option[]>
    ])
    setCategories(cats)
    setBrands(brs)
  }

  async function reload(nextPage = page, q = query) {
    setLoading(true)
    try {
      const data = (await window.mebsy.products.catalog({
        q: q || undefined,
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

  const bootRef = useRef(true)

  useEffect(() => {
    void loadOptions()
    void reload(1, '')
  }, [])

  useEffect(() => {
    // Evita doble fetch al montar (reload inicial + debounce de query)
    if (bootRef.current) {
      bootRef.current = false
      return
    }
    const t = setTimeout(() => {
      setPage(1)
      void reload(1, query)
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFieldErrors({})
    setNewCatMode(false)
    setNewBrandMode(false)
    setFormOpen(true)
  }

  function openEdit(p: CatalogProduct) {
    setEditing(p)
    setForm({
      nombre: p.nombre,
      codigo: p.codigo,
      codigoBarras: p.codigoBarras ?? '',
      descripcion: p.descripcion ?? '',
      precio: String(p.precio),
      categoriaId: String(p.categoriaId),
      marcaId: String(p.marcaId)
    })
    setFieldErrors({})
    setNewCatMode(false)
    setNewBrandMode(false)
    setFormOpen(true)
  }

  function validateForm() {
    const errs: Record<string, string> = {}
    if (!form.nombre.trim()) errs.nombre = 'Obligatorio'
    if (!form.codigo.trim()) errs.codigo = 'Obligatorio'
    const precio = Number(form.precio)
    if (!Number.isFinite(precio) || precio < 0) errs.precio = 'Debe ser ≥ 0'
    if (!form.categoriaId) errs.categoriaId = 'Selecciona una categoría'
    if (!form.marcaId) errs.marcaId = 'Selecciona una marca'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function saveProduct(e: FormEvent) {
    e.preventDefault()
    if (!isAdmin || !validateForm()) return
    setSaving(true)
    setError('')
    setMsg('')
    const payload = {
      codigo: form.codigo.trim(),
      codigoBarras: form.codigoBarras.trim() || null,
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      precio: Number(form.precio),
      categoriaId: Number(form.categoriaId),
      marcaId: Number(form.marcaId)
    }
    try {
      if (editing) {
        await window.mebsy.products.update(editing.id, payload)
        setMsg('Producto actualizado')
      } else {
        await window.mebsy.products.create(payload)
        setMsg('Producto creado')
      }
      setFormOpen(false)
      await reload(page, query)
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setSaving(false)
    }
  }

  async function createInlineCategory() {
    if (!newCatName.trim()) return
    try {
      const created = (await window.mebsy.categories.create(
        newCatName.trim()
      )) as Option
      await loadOptions()
      setForm((f) => ({ ...f, categoriaId: String(created.id) }))
      setNewCatMode(false)
      setNewCatName('')
    } catch (err) {
      setError(parseIpcError(err))
    }
  }

  async function createInlineBrand() {
    if (!newBrandName.trim()) return
    try {
      const created = (await window.mebsy.brands.create(
        newBrandName.trim()
      )) as Option
      await loadOptions()
      setForm((f) => ({ ...f, marcaId: String(created.id) }))
      setNewBrandMode(false)
      setNewBrandName('')
    } catch (err) {
      setError(parseIpcError(err))
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setError('')
    try {
      await window.mebsy.products.delete(deleteTarget.id)
      setDeleteTarget(null)
      setMsg('Producto eliminado')
      await reload(page, query)
    } catch (err) {
      setError(parseIpcError(err))
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  async function onPickFile(file: File | null) {
    setImportFile(file)
    setValidateResult(null)
    setImportRows([])
    if (!file) return
    try {
      const rows = await parseProductImportFile(file)
      setImportRows(rows)
      const result = (await window.mebsy.products.importValidate(
        rows
      )) as ValidateResult
      setValidateResult(result)
    } catch (err) {
      setError(parseIpcError(err))
    }
  }

  async function runImport() {
    if (!importRows.length) return
    setImportBusy(true)
    setError('')
    try {
      const result = (await window.mebsy.products.import(importRows)) as {
        imported: number
        rejected: number
      }
      setMsg(
        `Importación: ${result.imported} ok, ${result.rejected} rechazados`
      )
      setImportOpen(false)
      setImportFile(null)
      setValidateResult(null)
      setImportRows([])
      await loadOptions()
      await reload(1, query)
      setPage(1)
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setImportBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div>
      <PageHeader
        title="Productos"
        subtitle="Catálogo con SKU, códigos de barras, categorías y marcas"
        actions={
          isAdmin ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setImportOpen(true)
                  setImportFile(null)
                  setValidateResult(null)
                  setImportRows([])
                }}
              >
                <Upload size={14} />
                Importar productos
              </Button>
              <Button type="button" onClick={openCreate}>
                <Plus size={14} />
                Nuevo producto
              </Button>
            </div>
          ) : null
        }
      />

      <div className="mb-3 space-y-2">
        {error ? <Alert>{error}</Alert> : null}
        {msg ? <Alert tone="ok">{msg}</Alert> : null}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--ms-line)] bg-[var(--ms-panel)] p-3">
          <Input
            placeholder="Buscar por nombre, SKU o código de barras…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-[var(--ms-muted)]">
            Cargando productos…
          </p>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm text-[var(--ms-muted)]">
            {query
              ? 'Ningún producto coincide con la búsqueda'
              : 'Aún no hay productos en el catálogo'}
          </p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Nombre</Th>
                <Th>Categoría</Th>
                <Th>Marca</Th>
                <Th>SKU / Barcode</Th>
                <Th>Precio</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <div className="font-medium">{p.nombre}</div>
                    {p.descripcion ? (
                      <div className="mt-0.5 line-clamp-1 text-xs text-[var(--ms-muted)]">
                        {p.descripcion}
                      </div>
                    ) : null}
                  </Td>
                  <Td>{p.categoriaNombre}</Td>
                  <Td>{p.marcaNombre}</Td>
                  <Td className="font-mono text-xs">
                    <div>{p.codigo}</div>
                    <div className="text-[var(--ms-muted)]">
                      {p.codigoBarras || '—'}
                    </div>
                  </Td>
                  <Td className="font-mono">{money(p.precio)}</Td>
                  <Td className="text-right">
                    {isAdmin ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteTarget(p)}
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
                onClick={() => void reload(page - 1, query)}
              >
                Anterior
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => void reload(page + 1, query)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent
          title={editing ? 'Editar producto' : 'Nuevo producto'}
          description="Completa los datos del catálogo"
          className="w-[min(560px,calc(100vw-2rem))]"
        >
          <form className="space-y-3" onSubmit={saveProduct}>
            <Field label="Nombre">
              <Input
                value={form.nombre}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nombre: e.target.value }))
                }
              />
              {fieldErrors.nombre ? (
                <p className="mt-1 text-xs text-[var(--ms-danger)]">
                  {fieldErrors.nombre}
                </p>
              ) : null}
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="SKU">
                <Input
                  className="font-mono"
                  value={form.codigo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, codigo: e.target.value }))
                  }
                />
                {fieldErrors.codigo ? (
                  <p className="mt-1 text-xs text-[var(--ms-danger)]">
                    {fieldErrors.codigo}
                  </p>
                ) : null}
              </Field>
              <Field label="Código de barras">
                <Input
                  className="font-mono"
                  value={form.codigoBarras}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, codigoBarras: e.target.value }))
                  }
                />
              </Field>
            </div>
            <Field label="Descripción">
              <Textarea
                value={form.descripcion}
                onChange={(e) =>
                  setForm((f) => ({ ...f, descripcion: e.target.value }))
                }
              />
            </Field>
            <Field label="Precio">
              <Input
                type="number"
                step="0.01"
                min={0}
                value={form.precio}
                onChange={(e) =>
                  setForm((f) => ({ ...f, precio: e.target.value }))
                }
              />
              {fieldErrors.precio ? (
                <p className="mt-1 text-xs text-[var(--ms-danger)]">
                  {fieldErrors.precio}
                </p>
              ) : null}
            </Field>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-[0.06em] text-[var(--ms-muted)] uppercase">
                  Categoría
                </span>
                {!newCatMode ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setNewCatMode(true)}
                  >
                    <Plus size={14} />
                  </Button>
                ) : null}
              </div>
              {newCatMode ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Nueva categoría"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                  />
                  <Button type="button" size="sm" onClick={() => void createInlineCategory()}>
                    Guardar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setNewCatMode(false)
                      setNewCatName('')
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Select
                  value={form.categoriaId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, categoriaId: e.target.value }))
                  }
                >
                  <option value="">Seleccionar…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Select>
              )}
              {fieldErrors.categoriaId ? (
                <p className="mt-1 text-xs text-[var(--ms-danger)]">
                  {fieldErrors.categoriaId}
                </p>
              ) : null}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-[0.06em] text-[var(--ms-muted)] uppercase">
                  Marca
                </span>
                {!newBrandMode ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setNewBrandMode(true)}
                  >
                    <Plus size={14} />
                  </Button>
                ) : null}
              </div>
              {newBrandMode ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Nueva marca"
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                  />
                  <Button type="button" size="sm" onClick={() => void createInlineBrand()}>
                    Guardar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setNewBrandMode(false)
                      setNewBrandName('')
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Select
                  value={form.marcaId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, marcaId: e.target.value }))
                  }
                >
                  <option value="">Seleccionar…</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nombre}
                    </option>
                  ))}
                </Select>
              )}
              {fieldErrors.marcaId ? (
                <p className="mt-1 text-xs text-[var(--ms-danger)]">
                  {fieldErrors.marcaId}
                </p>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => setFormOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar producto'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent
          title="Importar productos"
          description="Carga masiva desde Excel o CSV"
          className="w-[min(640px,calc(100vw-2rem))]"
        >
          <div className="mb-4 space-y-2 rounded-[6px] border border-[var(--ms-line)] bg-[var(--ms-panel)] p-3 text-sm text-[var(--ms-muted)]">
            <p className="font-semibold text-[var(--ms-ink)]">
              Instrucciones para importar productos
            </p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>Descarga la plantilla para conocer el formato requerido.</li>
              <li>Las columnas marcadas con * son obligatorias.</li>
              <li>
                Si la categoría o marca no existen, se crearán automáticamente.
              </li>
              <li>Verifica precios y códigos válidos.</li>
              <li>Evita duplicar SKU o códigos de barras.</li>
              <li>Revisa los datos antes de confirmar.</li>
            </ol>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void downloadProductTemplate()}
            >
              Descargar plantilla
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileRef.current?.click()}
            >
              Seleccionar archivo
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) =>
                void onPickFile(e.target.files?.[0] ?? null)
              }
            />
          </div>

          {importFile ? (
            <div className="mb-3 flex items-center justify-between rounded-[6px] border border-[var(--ms-line)] px-3 py-2 text-sm">
              <div>
                <div className="font-medium">{importFile.name}</div>
                <div className="text-xs text-[var(--ms-muted)]">
                  {(importFile.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void onPickFile(null)}
              >
                Quitar
              </Button>
            </div>
          ) : null}

          {validateResult ? (
            <div className="mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                <div className="rounded-[6px] border border-[var(--ms-line)] p-2">
                  <div className="text-[10px] uppercase text-[var(--ms-muted)]">
                    Filas
                  </div>
                  <div className="font-mono font-semibold">
                    {validateResult.total}
                  </div>
                </div>
                <div className="rounded-[6px] border border-[var(--ms-line)] p-2">
                  <div className="text-[10px] uppercase text-[var(--ms-muted)]">
                    Válidos
                  </div>
                  <div className="font-mono font-semibold text-[var(--ms-ok)]">
                    {validateResult.valid}
                  </div>
                </div>
                <div className="rounded-[6px] border border-[var(--ms-line)] p-2">
                  <div className="text-[10px] uppercase text-[var(--ms-muted)]">
                    Errores
                  </div>
                  <div className="font-mono font-semibold text-[var(--ms-danger)]">
                    {validateResult.invalid}
                  </div>
                </div>
                <div className="rounded-[6px] border border-[var(--ms-line)] p-2">
                  <div className="text-[10px] uppercase text-[var(--ms-muted)]">
                    Cat. nuevas
                  </div>
                  <div className="font-mono font-semibold">
                    {validateResult.newCategories.length}
                  </div>
                </div>
                <div className="rounded-[6px] border border-[var(--ms-line)] p-2">
                  <div className="text-[10px] uppercase text-[var(--ms-muted)]">
                    Marcas nuevas
                  </div>
                  <div className="font-mono font-semibold">
                    {validateResult.newBrands.length}
                  </div>
                </div>
              </div>

              {validateResult.errors.length ? (
                <div className="max-h-40 overflow-auto rounded-[6px] border border-[var(--ms-line)]">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Fila</Th>
                        <Th>Campo</Th>
                        <Th>Error</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {validateResult.errors.map((err, i) => (
                        <tr key={`${err.row}-${err.field}-${i}`}>
                          <Td className="font-mono text-xs">{err.row}</Td>
                          <Td>{err.field}</Td>
                          <Td className="text-[var(--ms-danger)]">
                            {err.message}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={importBusy}
              onClick={() => setImportOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                importBusy || !validateResult || validateResult.valid === 0
              }
              onClick={() => void runImport()}
            >
              {importBusy ? 'Importando…' : 'Importar productos'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Eliminar producto"
        description={
          deleteTarget
            ? `¿Eliminar «${deleteTarget.nombre}» (${deleteTarget.codigo})? Si tiene ventas, se desactivará.`
            : ''
        }
        confirmLabel="Eliminar"
        busy={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
