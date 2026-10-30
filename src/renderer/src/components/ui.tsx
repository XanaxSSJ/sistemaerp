import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { CalendarDays, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from 'react'
import { cn } from '../lib/cn'
import {
  displayToIso,
  isoToDisplay,
  maskDateInput
} from '../lib/dates'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[6px] text-sm font-semibold tracking-tight transition-colors disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ms-accent)] focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--ms-accent)] text-white hover:bg-[var(--ms-accent-hover)]',
        secondary:
          'border border-[var(--ms-line-strong)] bg-white text-[var(--ms-ink)] hover:bg-[var(--ms-panel)]',
        danger: 'bg-[var(--ms-danger)] text-white hover:brightness-95',
        ghost:
          'bg-transparent text-[var(--ms-muted)] hover:bg-[var(--ms-panel)] hover:text-[var(--ms-ink)]',
        dark: 'bg-[var(--ms-sidebar)] text-white hover:bg-[var(--ms-sidebar-hover)]'
      },
      size: {
        sm: 'h-8 px-2.5 text-xs',
        md: 'h-9 px-3',
        lg: 'h-11 px-4 text-[15px]',
        icon: 'h-9 w-9'
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md'
    }
  }
)

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-[6px] border border-[var(--ms-line)] bg-white px-3 text-sm text-[var(--ms-ink)] outline-none transition placeholder:text-[var(--ms-muted)] focus:border-[var(--ms-accent)] focus:ring-1 focus:ring-[var(--ms-accent)] disabled:bg-[var(--ms-panel)]',
        className
      )}
      {...props}
    />
  )
}

/** Fecha en pantalla `dd/mm/yyyy` + selector; `value`/`onChange` usan ISO `yyyy-mm-dd`. */
export function DateInput({
  value,
  onChange,
  className,
  disabled,
  id,
  name,
  placeholder = 'dd/mm/aaaa'
}: {
  value: string
  onChange: (iso: string) => void
  className?: string
  disabled?: boolean
  id?: string
  name?: string
  placeholder?: string
}) {
  const [text, setText] = useState(() => isoToDisplay(value))
  const [invalid, setInvalid] = useState(false)
  const pickerRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setText(isoToDisplay(value))
    setInvalid(false)
  }, [value])

  function commit(display: string) {
    const iso = displayToIso(display)
    if (iso === null) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    onChange(iso)
    setText(iso ? isoToDisplay(iso) : '')
  }

  function openPicker() {
    const el = pickerRef.current
    if (!el || disabled) return
    try {
      if (typeof el.showPicker === 'function') {
        el.showPicker()
        return
      }
    } catch {
      /* fallback click */
    }
    el.click()
  }

  return (
    <div className={cn('relative', className)}>
      <Input
        id={id}
        name={name}
        disabled={disabled}
        inputMode="numeric"
        placeholder={placeholder}
        autoComplete="off"
        value={text}
        className={cn(
          'pr-9 font-mono',
          invalid &&
            'border-[var(--ms-danger)] focus:border-[var(--ms-danger)] focus:ring-[var(--ms-danger)]'
        )}
        onChange={(e) => {
          const next = maskDateInput(e.target.value)
          setText(next)
          setInvalid(false)
          if (next.length === 10) {
            const iso = displayToIso(next)
            if (iso) onChange(iso)
            else setInvalid(true)
          } else if (next.length === 0) {
            onChange('')
          }
        }}
        onBlur={() => commit(text)}
      />
      <button
        type="button"
        disabled={disabled}
        tabIndex={-1}
        aria-label="Seleccionar fecha"
        className="absolute top-1/2 right-1.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[5px] text-[var(--ms-muted)] transition hover:bg-[var(--ms-panel)] hover:text-[var(--ms-ink)] disabled:opacity-40"
        onMouseDown={(e) => e.preventDefault()}
        onClick={openPicker}
      >
        <CalendarDays size={15} />
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        value={value || ''}
        className="pointer-events-none absolute top-0 right-0 h-0 w-0 opacity-0"
        onChange={(e) => {
          const iso = e.target.value
          onChange(iso)
          setText(isoToDisplay(iso))
          setInvalid(false)
        }}
      />
    </div>
  )
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-20 w-full rounded-[6px] border border-[var(--ms-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--ms-accent)] focus:ring-1 focus:ring-[var(--ms-accent)]',
        className
      )}
      {...props}
    />
  )
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-9 w-full appearance-none rounded-[6px] border border-[var(--ms-line)] bg-white bg-[length:12px] bg-[right_10px_center] bg-no-repeat px-3 pr-8 text-sm outline-none focus:border-[var(--ms-accent)] focus:ring-1 focus:ring-[var(--ms-accent)]',
        className
      )}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235b6573' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`
      }}
      {...props}
    >
      {children}
    </select>
  )
}

export function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        'mb-1.5 block text-[11px] font-semibold tracking-[0.06em] text-[var(--ms-muted)] uppercase',
        className
      )}
      {...props}
    >
      {children}
    </label>
  )
}

export function Field({
  label,
  children,
  className
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

export function Card({
  children,
  className = ''
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-[8px] border border-[var(--ms-line)] bg-[var(--ms-surface)]',
        className
      )}
    >
      {children}
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  className
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'ok' | 'danger' | 'warn'
  className?: string
}) {
  const tones = {
    neutral: 'bg-[var(--ms-panel)] text-[var(--ms-muted)] border-[var(--ms-line)]',
    accent:
      'bg-[var(--ms-accent-soft)] text-[var(--ms-accent-hover)] border-cyan-200',
    ok: 'bg-[var(--ms-ok-soft)] text-[var(--ms-ok)] border-emerald-200',
    danger: 'bg-[var(--ms-danger-soft)] text-[var(--ms-danger)] border-red-200',
    warn: 'bg-[var(--ms-warn-soft)] text-[var(--ms-warn)] border-amber-200'
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[4px] border px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] uppercase',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3 border-b border-[var(--ms-line)] pb-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--ms-ink)]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-[var(--ms-muted)]">{subtitle}</p>
        ) : null}
      </div>
      {actions}
    </div>
  )
}

export function Table({
  children,
  className
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('overflow-auto', className)}>
      <table className="w-full border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  )
}

export function Th({
  children,
  className
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <th
      className={cn(
        'border-b border-[var(--ms-line)] bg-[var(--ms-panel)] px-3 py-2.5 text-[10px] font-bold tracking-[0.08em] text-[var(--ms-muted)] uppercase',
        className
      )}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  className,
  colSpan
}: {
  children?: ReactNode
  className?: string
  colSpan?: number
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        'border-b border-[var(--ms-line)] px-3 py-2.5 align-middle text-[var(--ms-ink)]',
        className
      )}
    >
      {children}
    </td>
  )
}

export function Alert({
  children,
  tone = 'danger'
}: {
  children: ReactNode
  tone?: 'danger' | 'ok' | 'warn'
}) {
  const map = {
    danger: 'border-[var(--ms-danger)]/30 bg-[var(--ms-danger-soft)] text-[var(--ms-danger)]',
    ok: 'border-[var(--ms-ok)]/30 bg-[var(--ms-ok-soft)] text-[var(--ms-ok)]',
    warn: 'border-[var(--ms-warn)]/30 bg-[var(--ms-warn-soft)] text-[var(--ms-warn)]'
  }
  return (
    <div className={cn('rounded-[6px] border px-3 py-2 text-sm', map[tone])}>
      {children}
    </div>
  )
}

export function Dialog({
  open,
  onOpenChange,
  children
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogPrimitive.Root>
  )
}

export function DialogContent({
  children,
  className,
  title,
  description
}: {
  children: ReactNode
  className?: string
  title?: string
  description?: ReactNode
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[8px] border border-[var(--ms-line)] bg-[var(--ms-surface)] shadow-xl outline-none',
          className
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--ms-line)] px-5 py-4">
          <div className="min-w-0">
            {title ? (
              <DialogPrimitive.Title className="text-[17px] font-semibold tracking-tight">
                {title}
              </DialogPrimitive.Title>
            ) : (
              <DialogPrimitive.Title className="sr-only">Diálogo</DialogPrimitive.Title>
            )}
            {description ? (
              <DialogPrimitive.Description asChild>
                <div className="mt-1 text-sm text-[var(--ms-muted)]">
                  {description}
                </div>
              </DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">
                Contenido del diálogo
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Cerrar">
              <X size={16} />
            </Button>
          </DialogPrimitive.Close>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  busy,
  onConfirm
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  busy?: boolean
  onConfirm: () => void | Promise<void>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description} className="w-[min(420px,calc(100vw-2rem))]">
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === 'danger' ? 'danger' : 'primary'}
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            {busy ? 'Procesando…' : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
