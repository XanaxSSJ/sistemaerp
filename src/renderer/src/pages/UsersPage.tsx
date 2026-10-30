import { FormEvent, useEffect, useState } from 'react'
import { Building2, Plus } from 'lucide-react'
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
  Select,
  Table,
  Td,
  Th
} from '../components/ui'
import { parseIpcError } from '../lib/errors'
import { useSession } from '../store/session'

interface BranchOption {
  id: number
  codigo: string
  nombre: string
}

interface UserRow {
  id: number
  username: string
  nombre: string
  rol: 'admin' | 'cajero'
  activo: boolean
  sucursales: BranchOption[]
}

export function UsersPage() {
  const { user } = useSession()
  const [rows, setRows] = useState<UserRow[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState<'admin' | 'cajero'>('cajero')
  const [createBranchIds, setCreateBranchIds] = useState<number[]>([])
  const [creating, setCreating] = useState(false)

  const [assignOpen, setAssignOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [editBranchIds, setEditBranchIds] = useState<number[]>([])
  const [savingAssign, setSavingAssign] = useState(false)

  async function reload() {
    setLoading(true)
    setError('')
    try {
      const [users, sedes] = await Promise.all([
        window.mebsy.users.list() as Promise<UserRow[]>,
        window.mebsy.branches.list() as Promise<BranchOption[]>
      ])
      setRows(users)
      setBranches(sedes.map((b) => ({ ...b, id: Number(b.id) })))
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.rol !== 'admin') return
    void reload()
  }, [user?.rol])

  function toggleCreateBranch(id: number) {
    setCreateBranchIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function toggleEditBranch(id: number) {
    setEditBranchIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function openCreate() {
    setUsername('')
    setPassword('')
    setNombre('')
    setRol('cajero')
    setCreateBranchIds([])
    setError('')
    setCreateOpen(true)
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError('')
    setMsg('')
    try {
      await window.mebsy.users.create({
        username,
        password,
        nombre,
        rol,
        sucursalIds: createBranchIds
      })
      setCreateOpen(false)
      setMsg('Usuario creado')
      await reload()
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setCreating(false)
    }
  }

  function openAssign(u: UserRow) {
    setEditUser(u)
    setEditBranchIds(u.sucursales.map((s) => Number(s.id)))
    setError('')
    setAssignOpen(true)
  }

  async function saveBranches(e: FormEvent) {
    e.preventDefault()
    if (!editUser) return
    setSavingAssign(true)
    setError('')
    setMsg('')
    try {
      await window.mebsy.users.assignBranches(editUser.id, editBranchIds)
      setAssignOpen(false)
      setEditUser(null)
      setMsg('Sucursales actualizadas')
      await reload()
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setSavingAssign(false)
    }
  }

  if (user?.rol !== 'admin') {
    return (
      <div>
        <PageHeader
          title="Usuarios"
          subtitle="Cajeros y acceso por sucursal"
        />
        <Alert tone="warn">
          Solo el administrador puede gestionar usuarios y cajeros.
        </Alert>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Usuarios"
        subtitle="Cajeros y acceso por sucursal"
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="size-3.5" />
            Nuevo usuario
          </Button>
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
            No hay usuarios.
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Usuario</Th>
                <Th>Nombre</Th>
                <Th>Rol</Th>
                <Th>Estado</Th>
                <Th>Sucursales</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <Td className="font-mono text-xs">{u.username}</Td>
                  <Td className="font-semibold">{u.nombre}</Td>
                  <Td>
                    <Badge tone={u.rol === 'admin' ? 'accent' : 'neutral'}>
                      {u.rol === 'admin' ? 'Administrador' : 'Cajero'}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={u.activo ? 'ok' : 'neutral'}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </Td>
                  <Td>
                    {u.sucursales.length ? (
                      <div className="flex flex-wrap gap-1">
                        {u.sucursales.map((s) => (
                          <Badge key={s.id} tone="neutral">
                            {s.codigo}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-[var(--ms-muted)]">
                        Sin asignar
                      </span>
                    )}
                  </Td>
                  <Td>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => openAssign(u)}
                    >
                      <Building2 className="size-3.5" />
                      Sucursales
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          title="Nuevo usuario"
          description="Credenciales y sucursales de acceso"
          className="w-[min(480px,calc(100vw-2rem))]"
        >
          <form className="space-y-3" onSubmit={onCreate}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Usuario">
                <Input
                  className="font-mono"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </Field>
              <Field label="Rol">
                <Select
                  value={rol}
                  onChange={(e) =>
                    setRol(e.target.value as 'admin' | 'cajero')
                  }
                >
                  <option value="cajero">Cajero</option>
                  <option value="admin">Administrador</option>
                </Select>
              </Field>
            </div>
            <Field label="Nombre completo">
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </Field>
            <Field label="Contraseña">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={4}
              />
            </Field>

            <div className="rounded-[6px] border border-[var(--ms-line)] bg-[var(--ms-panel)] p-3">
              <div className="mb-2 text-[10px] font-bold tracking-[0.08em] text-[var(--ms-muted)] uppercase">
                Sucursales de acceso
              </div>
              {branches.length === 0 ? (
                <p className="text-sm text-[var(--ms-muted)]">
                  No hay sucursales registradas.
                </p>
              ) : (
                <div className="max-h-40 space-y-1.5 overflow-auto">
                  {branches.map((b) => (
                    <label
                      key={b.id}
                      className="flex cursor-pointer items-center gap-2 rounded-[4px] px-1 py-1 text-sm hover:bg-[var(--ms-surface)]"
                    >
                      <input
                        type="checkbox"
                        checked={createBranchIds.includes(b.id)}
                        onChange={() => toggleCreateBranch(b.id)}
                      />
                      <span className="font-mono text-xs font-semibold">
                        {b.codigo}
                      </span>
                      <span>{b.nombre}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                disabled={creating}
                onClick={() => setCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creando…' : 'Crear usuario'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent
          title="Asignar sucursales"
          description={
            editUser
              ? `${editUser.nombre} (${editUser.username})`
              : undefined
          }
          className="w-[min(440px,calc(100vw-2rem))]"
        >
          <form className="space-y-3" onSubmit={saveBranches}>
            <div className="max-h-56 space-y-1.5 overflow-auto rounded-[6px] border border-[var(--ms-line)] bg-[var(--ms-panel)] p-3">
              {branches.map((b) => (
                <label
                  key={b.id}
                  className="flex cursor-pointer items-center gap-2 rounded-[4px] px-1 py-1 text-sm hover:bg-[var(--ms-surface)]"
                >
                  <input
                    type="checkbox"
                    checked={editBranchIds.includes(b.id)}
                    onChange={() => toggleEditBranch(b.id)}
                  />
                  <span className="font-mono text-xs font-semibold">
                    {b.codigo}
                  </span>
                  <span>{b.nombre}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={savingAssign}
                onClick={() => setAssignOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={savingAssign}>
                {savingAssign ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
