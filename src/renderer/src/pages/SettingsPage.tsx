import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select
} from '../components/ui'
import { parseIpcError } from '../lib/errors'

interface Empresa {
  id: number
  ruc: string
  razonSocial: string
  nombreComercial: string
  direccion: string
  igvPorcentaje: number
  ubigeo?: string | null
  distrito?: string | null
  provincia?: string | null
  departamento?: string | null
  certificadoPath: string | null
  certificadoConfigured?: boolean
  sunatSolUser?: string | null
  solConfigured?: boolean
  sunatEnv?: 'beta' | 'prod'
  seeEnabled?: boolean
}

export function SettingsPage() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [solPassword, setSolPassword] = useState('')
  const [certPassword, setCertPassword] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function reload() {
    const row = (await window.mebsy.company.get()) as Empresa
    setEmpresa(row)
  }

  useEffect(() => {
    void reload().catch((err) => setError(parseIpcError(err)))
  }, [])

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!empresa) return
    setError('')
    setMsg('')
    setBusy(true)
    try {
      const updated = (await window.mebsy.company.update({
        ruc: empresa.ruc,
        razonSocial: empresa.razonSocial,
        nombreComercial: empresa.nombreComercial,
        direccion: empresa.direccion,
        igvPorcentaje: empresa.igvPorcentaje,
        ubigeo: empresa.ubigeo || null,
        distrito: empresa.distrito || null,
        provincia: empresa.provincia || null,
        departamento: empresa.departamento || null,
        sunatSolUser: empresa.sunatSolUser || null,
        sunatEnv: empresa.sunatEnv || 'beta',
        seeEnabled: true,
        ...(solPassword.trim()
          ? { sunatSolPassword: solPassword.trim() }
          : {}),
        ...(certPassword.trim()
          ? { certificadoPassword: certPassword.trim() }
          : {})
      })) as Empresa
      setEmpresa(updated)
      setSolPassword('')
      setCertPassword('')
      setMsg('Configuración guardada')
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setBusy(false)
    }
  }

  async function onUploadCert(file: File) {
    if (!empresa) return
    setError('')
    setMsg('')
    if (!certPassword.trim()) {
      setError('Indicá la clave del certificado .p12 antes de subirlo')
      return
    }
    setBusy(true)
    try {
      const buf = await file.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
      const contentBase64 = btoa(binary)
      const updated = (await window.mebsy.company.uploadCertificate({
        fileName: file.name,
        contentBase64,
        password: certPassword.trim()
      })) as Empresa
      setEmpresa(updated)
      setCertPassword('')
      setMsg('Certificado digital cargado')
    } catch (err) {
      setError(parseIpcError(err))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (!empresa) {
    return (
      <p className="text-sm text-[var(--ms-muted)]">Cargando empresa…</p>
    )
  }

  return (
    <div>
      <PageHeader
        title="Empresa"
        subtitle="Datos fiscales y SEE del contribuyente (SUNAT)"
      />
      <div className="mb-3 space-y-2">
        {error ? <Alert>{error}</Alert> : null}
        {msg ? <Alert tone="ok">{msg}</Alert> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Datos fiscales</h2>
          <form className="space-y-3" onSubmit={onSave}>
            <Field label="RUC">
              <Input
                className="font-mono"
                value={empresa.ruc}
                onChange={(e) =>
                  setEmpresa({ ...empresa, ruc: e.target.value })
                }
              />
            </Field>
            <Field label="Razón social">
              <Input
                value={empresa.razonSocial}
                onChange={(e) =>
                  setEmpresa({ ...empresa, razonSocial: e.target.value })
                }
              />
            </Field>
            <Field label="Nombre comercial">
              <Input
                value={empresa.nombreComercial}
                onChange={(e) =>
                  setEmpresa({ ...empresa, nombreComercial: e.target.value })
                }
              />
            </Field>
            <Field label="Dirección">
              <Input
                value={empresa.direccion}
                onChange={(e) =>
                  setEmpresa({ ...empresa, direccion: e.target.value })
                }
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Ubigeo">
                <Input
                  className="font-mono"
                  value={empresa.ubigeo ?? ''}
                  onChange={(e) =>
                    setEmpresa({ ...empresa, ubigeo: e.target.value })
                  }
                  placeholder="150101"
                />
              </Field>
              <Field label="IGV %">
                <Input
                  type="number"
                  className="font-mono"
                  value={empresa.igvPorcentaje}
                  onChange={(e) =>
                    setEmpresa({
                      ...empresa,
                      igvPorcentaje: Number(e.target.value)
                    })
                  }
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Departamento">
                <Input
                  value={empresa.departamento ?? ''}
                  onChange={(e) =>
                    setEmpresa({ ...empresa, departamento: e.target.value })
                  }
                />
              </Field>
              <Field label="Provincia">
                <Input
                  value={empresa.provincia ?? ''}
                  onChange={(e) =>
                    setEmpresa({ ...empresa, provincia: e.target.value })
                  }
                />
              </Field>
              <Field label="Distrito">
                <Input
                  value={empresa.distrito ?? ''}
                  onChange={(e) =>
                    setEmpresa({ ...empresa, distrito: e.target.value })
                  }
                />
              </Field>
            </div>
            <Button type="submit" disabled={busy}>
              Guardar datos
            </Button>
          </form>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">SEE — SUNAT</h2>
            <Badge
              tone={
                empresa.certificadoConfigured || empresa.certificadoPath
                  ? 'ok'
                  : 'neutral'
              }
            >
              {empresa.certificadoConfigured || empresa.certificadoPath
                ? 'Listo'
                : 'Pendiente certificado'}
            </Badge>
          </div>
          <p className="mb-3 text-xs text-[var(--ms-muted)]">
            Emisión de factura/boleta con SEE (api-sunaterp) activa por defecto.
          </p>
          <form className="space-y-3" onSubmit={onSave}>
            <Field label="Ambiente">
              <Select
                value={empresa.sunatEnv ?? 'beta'}
                onChange={(e) =>
                  setEmpresa({
                    ...empresa,
                    sunatEnv: e.target.value as 'beta' | 'prod'
                  })
                }
              >
                <option value="beta">Beta (homologación)</option>
                <option value="prod">Producción</option>
              </Select>
            </Field>
            <Field label="Usuario SOL">
              <Input
                className="font-mono"
                value={empresa.sunatSolUser ?? ''}
                onChange={(e) =>
                  setEmpresa({ ...empresa, sunatSolUser: e.target.value })
                }
                placeholder="MODDATOS / usuario secundario"
              />
            </Field>
            <Field
              label={
                empresa.solConfigured
                  ? 'Clave SOL (dejar vacío para no cambiar)'
                  : 'Clave SOL'
              }
            >
              <Input
                type="password"
                value={solPassword}
                onChange={(e) => setSolPassword(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <div className="border border-[var(--ms-line)] bg-[var(--ms-panel)] p-3 text-xs text-[var(--ms-muted)]">
              Certificado:{' '}
              {empresa.certificadoConfigured || empresa.certificadoPath ? (
                <span className="font-mono text-[var(--ms-fg)]">
                  {empresa.certificadoPath?.split(/[/\\]/).pop() ?? 'cargado'}
                </span>
              ) : (
                'no cargado'
              )}
            </div>
            <Field label="Clave del .p12 (para subir o actualizar)">
              <Input
                type="password"
                value={certPassword}
                onChange={(e) => setCertPassword(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <input
              ref={fileRef}
              type="file"
              accept=".p12,.pfx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onUploadCert(f)
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                Subir certificado .p12
              </Button>
              <Button type="submit" disabled={busy}>
                Guardar SEE
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
