import { FormEvent, useState } from 'react'
import type { SessionUser } from '@core/types'
import { Alert, Button, Field, Input, Select } from '../components/ui'
import { parseIpcError } from '../lib/errors'
import { useSession, type SucursalOption } from '../store/session'

export function LoginPage() {
  const { setUser, setSucursal } = useSession()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep] = useState<'credenciales' | 'sucursal'>('credenciales')
  const [branches, setBranches] = useState<SucursalOption[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingUser, setPendingUser] = useState<SessionUser | null>(null)

  async function onLogin(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { user, sucursales } = await window.mebsy.auth.login(
        username,
        password
      )
      const normalizedUser: SessionUser = {
        ...user,
        id: Number(user.id),
        sucursalIds: (user.sucursalIds ?? []).map(Number)
      }
      const list = (sucursales ?? []).map((b) => ({
        ...b,
        id: Number(b.id)
      })) as SucursalOption[]

      if (!list.length) {
        setError(
          'Sin sucursales asignadas. Pide al administrador que te asigne una sede.'
        )
        return
      }
      setPendingUser(normalizedUser)
      setBranches(list)
      setSelectedBranch(String(list[0].id))
      setStep('sucursal')
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setLoading(false)
    }
  }

  function confirmBranch(e: FormEvent) {
    e.preventDefault()
    const branch = branches.find((b) => String(b.id) === selectedBranch)
    if (!pendingUser || !branch) return
    setUser(pendingUser)
    setSucursal({ ...branch, id: Number(branch.id) })
  }

  return (
    <div className="grid h-full lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[var(--ms-sidebar)] text-white lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px'
          }}
        />
        <div className="relative">
          <div className="font-mono text-[11px] tracking-[0.22em] text-white/45 uppercase">
            Sistema de punto de venta
          </div>
          <h1 className="font-display mt-4 max-w-md text-5xl leading-[1.05] tracking-[-0.03em]">
            MebsyCore
          </h1>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/65">
            Operación multi-sucursal, inventario centralizado y comprobantes
            electrónicos preparados para SUNAT.
          </p>
        </div>
        <div className="relative border-t border-white/10 pt-6 font-mono text-[11px] text-white/40">
          Cloud · Fase 2
        </div>
      </section>

      <section className="flex items-center justify-center bg-[var(--ms-canvas)] p-6">
        <div className="w-full max-w-[380px] border border-[var(--ms-line)] bg-white p-7">
          <div className="mb-6 lg:hidden">
            <div className="font-display text-3xl tracking-tight">
              MebsyCore
            </div>
          </div>

          <h2 className="text-lg font-semibold tracking-tight">
            {step === 'credenciales' ? 'Acceso' : 'Sucursal de trabajo'}
          </h2>
          <p className="mt-1 text-sm text-[var(--ms-muted)]">
            {step === 'credenciales'
              ? 'Ingresa con tu usuario de caja o administración.'
              : 'Selecciona la tienda donde operarás esta sesión.'}
          </p>

          <div className="mt-6">
            {step === 'credenciales' ? (
              <form className="space-y-3.5" onSubmit={onLogin}>
                <Field label="Usuario">
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoFocus
                    autoComplete="username"
                  />
                </Field>
                <Field label="Contraseña">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </Field>
                {error ? <Alert>{error}</Alert> : null}
                <Button className="w-full" size="lg" disabled={loading}>
                  {loading ? 'Validando…' : 'Continuar'}
                </Button>
              </form>
            ) : (
              <form className="space-y-3.5" onSubmit={confirmBranch}>
                <Field label="Sucursal">
                  <Select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.codigo} — {b.nombre}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button className="w-full" size="lg">
                  Entrar a caja
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep('credenciales')}
                >
                  Volver
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
