import { FormEvent, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  PageHeader
} from '../components/ui'
import { parseIpcError } from '../lib/errors'

interface Empresa {
  id: number
  ruc: string
  razonSocial: string
  nombreComercial: string
  direccion: string
  igvPorcentaje: number
  certificadoPath: string | null
}

export function SettingsPage() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    void window.mebsy.company.get().then((row) => setEmpresa(row as Empresa))
  }, [])

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!empresa) return
    setError('')
    setMsg('')
    try {
      const updated = (await window.mebsy.company.update({
        ruc: empresa.ruc,
        razonSocial: empresa.razonSocial,
        nombreComercial: empresa.nombreComercial,
        direccion: empresa.direccion,
        igvPorcentaje: empresa.igvPorcentaje
      })) as Empresa
      setEmpresa(updated)
      setMsg('Configuración guardada')
    } catch (err) {
      setError(parseIpcError(err))
    }
  }

  if (!empresa) {
    return (
      <p className="text-sm text-[var(--ms-muted)]">Cargando empresa…</p>
    )
  }

  return (
    <div>
      <PageHeader title="Empresa" subtitle="Datos fiscales MebsyCore" />
      <div className="mb-3 space-y-2">
        {error ? <Alert>{error}</Alert> : null}
        {msg ? <Alert tone="ok">{msg}</Alert> : null}
      </div>

      <Card className="max-w-xl p-5">
        <form className="space-y-3" onSubmit={onSave}>
          <Field label="RUC">
            <Input
              className="font-mono"
              value={empresa.ruc}
              onChange={(e) => setEmpresa({ ...empresa, ruc: e.target.value })}
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
          <div className="border border-[var(--ms-line)] bg-[var(--ms-panel)] p-3 text-xs leading-relaxed text-[var(--ms-muted)]">
            Certificado digital (.pfx): pendiente. Los XML UBL 2.1 se generan en
            caja y quedan listos para firma/envío SUNAT.
            {empresa.certificadoPath ? (
              <div className="mt-1 font-mono">{empresa.certificadoPath}</div>
            ) : null}
          </div>
          <Button type="submit">Guardar cambios</Button>
        </form>
      </Card>
    </div>
  )
}
