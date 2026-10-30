/** Convierte `yyyy-mm-dd` → `dd/mm/yyyy`. */
export function isoToDisplay(iso: string): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]}`
}

/** Convierte `dd/mm/yyyy` (o parcial) → `yyyy-mm-dd` si es válida; si no, `null`. */
export function displayToIso(display: string): string | null {
  const raw = display.trim()
  if (!raw) return ''
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw)
  if (!m) return null
  const dd = Number(m[1])
  const mm = Number(m[2])
  const yyyy = Number(m[3])
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  const dt = new Date(yyyy, mm - 1, dd)
  if (
    dt.getFullYear() !== yyyy ||
    dt.getMonth() !== mm - 1 ||
    dt.getDate() !== dd
  ) {
    return null
  }
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

/** Máscara suave mientras se escribe: inserta `/` tras día y mes. */
export function maskDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

/** Hoy en ISO `yyyy-mm-dd` (zona local del equipo). */
export function todayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(iso))
  } catch {
    return iso
  }
}
