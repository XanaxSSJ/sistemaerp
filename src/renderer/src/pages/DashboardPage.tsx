import { useCallback, useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DashboardSummary } from '@core/types'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Package,
  Receipt,
  RefreshCw,
  ShoppingCart,
  TrendingUp
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { Alert, Button, Card, PageHeader } from '../components/ui'
import { useRealtimeRefresh } from '../hooks/useRealtime'
import { parseIpcError } from '../lib/errors'
import { formatPen } from '../lib/money'
import { cn } from '../lib/cn'
import { useSession } from '../store/session'

const BUSINESS_TZ = 'America/Lima'

function formatMoney(amount: number, _currency = 'PEN'): string {
  return formatPen(amount)
}

function formatDayShort(isoDate: string): string {
  try {
    const d = new Date(`${isoDate}T12:00:00`)
    return new Intl.DateTimeFormat('es-PE', {
      weekday: 'short',
      day: 'numeric'
    }).format(d)
  } catch {
    return isoDate
  }
}

function formatDayFull(isoDate: string): string {
  try {
    const d = new Date(`${isoDate}T12:00:00`)
    return new Intl.DateTimeFormat('es-PE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(d)
  } catch {
    return isoDate
  }
}

function KpiSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="h-9 w-9 animate-pulse rounded-[8px] bg-[var(--ms-panel)]" />
        <div className="h-4 w-12 animate-pulse rounded bg-[var(--ms-panel)]" />
      </div>
      <div className="mt-4 h-3 w-28 animate-pulse rounded bg-[var(--ms-panel)]" />
      <div className="mt-2 h-7 w-36 animate-pulse rounded bg-[var(--ms-panel)]" />
    </Card>
  )
}

function ChartSkeleton() {
  return (
    <Card className="p-5">
      <div className="h-4 w-40 animate-pulse rounded bg-[var(--ms-panel)]" />
      <div className="mt-2 h-3 w-56 animate-pulse rounded bg-[var(--ms-panel)]" />
      <div className="mt-6 h-[240px] animate-pulse rounded-[8px] bg-[var(--ms-panel)]" />
    </Card>
  )
}

type KpiTone = 'accent' | 'ok' | 'warn' | 'danger'

function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  tone,
  delta,
  onClick,
  clickable
}: {
  title: string
  value: string
  hint?: string
  icon: typeof TrendingUp
  tone: KpiTone
  delta?: { value: number; label: string } | null
  onClick?: () => void
  clickable?: boolean
}) {
  const tones: Record<
    KpiTone,
    { bg: string; icon: string; ring: string }
  > = {
    accent: {
      bg: 'bg-[var(--ms-accent-soft)]',
      icon: 'text-[var(--ms-accent-hover)]',
      ring: 'hover:border-cyan-300'
    },
    ok: {
      bg: 'bg-[var(--ms-ok-soft)]',
      icon: 'text-[var(--ms-ok)]',
      ring: 'hover:border-emerald-300'
    },
    warn: {
      bg: 'bg-[var(--ms-warn-soft)]',
      icon: 'text-[var(--ms-warn)]',
      ring: 'hover:border-amber-300'
    },
    danger: {
      bg: 'bg-[var(--ms-danger-soft)]',
      icon: 'text-[var(--ms-danger)]',
      ring: 'hover:border-red-300'
    }
  }
  const t = tones[tone]
  const className = cn(
    'rounded-[8px] border border-[var(--ms-line)] bg-[var(--ms-surface)] p-4 text-left transition-colors',
    clickable &&
      `cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ms-accent)] ${t.ring}`
  )

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-[8px]',
            t.bg,
            t.icon
          )}
        >
          <Icon size={18} strokeWidth={1.75} aria-hidden />
        </div>
        {delta != null ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-[4px] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
              delta.value > 0
                ? 'bg-[var(--ms-ok-soft)] text-[var(--ms-ok)]'
                : delta.value < 0
                  ? 'bg-[var(--ms-danger-soft)] text-[var(--ms-danger)]'
                  : 'bg-[var(--ms-panel)] text-[var(--ms-muted)]'
            )}
            title={delta.label}
          >
            {delta.value > 0 ? (
              <ArrowUpRight size={12} aria-hidden />
            ) : delta.value < 0 ? (
              <ArrowDownRight size={12} aria-hidden />
            ) : (
              <Minus size={12} aria-hidden />
            )}
            {Math.abs(delta.value).toFixed(1)}%
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-[11px] font-semibold tracking-[0.06em] text-[var(--ms-muted)] uppercase">
        {title}
      </p>
      <p className="mt-1 text-[22px] font-semibold tracking-tight text-[var(--ms-ink)] tabular-nums">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-[var(--ms-muted)]">{hint}</p>
      ) : null}
    </>
  )

  if (clickable) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    )
  }
  return <div className={className}>{body}</div>
}

function TrendTooltip({
  active,
  payload,
  currency
}: {
  active?: boolean
  payload?: Array<{ payload: { fecha: string; total: number; operaciones: number } }>
  currency: string
}) {
  if (!active || !payload?.[0]) return null
  const row = payload[0].payload
  return (
    <div className="rounded-[8px] border border-[var(--ms-line-strong)] bg-white px-3 py-2 shadow-sm">
      <p className="text-xs font-semibold capitalize text-[var(--ms-ink)]">
        {formatDayFull(row.fecha)}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--ms-accent-hover)]">
        {formatMoney(row.total, currency)}
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--ms-muted)]">
        {row.operaciones}{' '}
        {row.operaciones === 1 ? 'venta' : 'ventas'}
      </p>
    </div>
  )
}

export function DashboardPage() {
  const { sucursal } = useSession()
  const navigate = useNavigate()
  const gradientId = useId().replace(/:/g, '')
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!sucursal) return
    setLoading(true)
    setError('')
    try {
      const summary = (await window.mebsy.dashboard.summary(
        sucursal.id,
        BUSINESS_TZ
      )) as DashboardSummary
      setData(summary)
    } catch (err) {
      setError(parseIpcError(err))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [sucursal?.id])

  useEffect(() => {
    void load()
  }, [load])

  useRealtimeRefresh(
    ['sale.created', 'stock.updated', 'product.changed'],
    () => {
      void load()
    }
  )

  const currency = data?.moneda ?? 'PEN'
  const chartData =
    data?.tendencia.map((d) => ({
      ...d,
      label: formatDayShort(d.fecha)
    })) ?? []
  const hasSales = (data?.ventasUltimos7Dias.total ?? 0) > 0
  const cambio = data?.ventasUltimos7Dias.cambioPorcentaje ?? null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Dashboard"
        subtitle={
          sucursal
            ? `Resumen de ${sucursal.nombre} · últimos 7 días`
            : 'Resumen operativo'
        }
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Actualizar dashboard"
          >
            <RefreshCw
              size={14}
              className={loading ? 'animate-spin' : undefined}
              aria-hidden
            />
            Actualizar
          </Button>
        }
      />

      {error ? (
        <div className="mb-4">
          <Alert>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{error}</span>
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                Reintentar
              </Button>
            </div>
          </Alert>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading && !data ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              title="Ventas · 7 días"
              value={formatMoney(data?.ventasUltimos7Dias.total ?? 0, currency)}
              hint="Incluye el día de hoy"
              icon={TrendingUp}
              tone="accent"
              delta={
                cambio == null
                  ? null
                  : {
                      value: cambio,
                      label: 'vs. los 7 días anteriores'
                    }
              }
            />
            <KpiCard
              title="Ventas de hoy"
              value={formatMoney(data?.ventasHoy.total ?? 0, currency)}
              hint="Acumulado del día"
              icon={ShoppingCart}
              tone="ok"
            />
            <KpiCard
              title="Operaciones hoy"
              value={String(data?.ventasHoy.operaciones ?? 0)}
              hint="Ventas completadas"
              icon={Receipt}
              tone="accent"
            />
            <KpiCard
              title="Stock bajo"
              value={String(data?.productosStockBajo ?? 0)}
              hint="Ver en inventario"
              icon={Package}
              tone={
                (data?.productosStockBajo ?? 0) > 0 ? 'warn' : 'ok'
              }
              clickable
              onClick={() => navigate('/inventario?estado=bajo')}
            />
          </>
        )}
      </div>

      <div className="mt-4 min-h-0 flex-1">
        {loading && !data ? (
          <ChartSkeleton />
        ) : (
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-[var(--ms-ink)]">
                  Tendencia de ventas
                </h2>
                <p className="mt-0.5 text-xs text-[var(--ms-muted)]">
                  Montos diarios de los últimos 7 días (zona {BUSINESS_TZ})
                </p>
              </div>
              {!hasSales && !error ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-[var(--ms-muted)]">
                  <AlertTriangle size={13} aria-hidden />
                  Sin ventas en el periodo
                </span>
              ) : null}
            </div>

            <div className="h-[260px] w-full sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id={`dash-fill-${gradientId}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#0e7490"
                        stopOpacity={0.22}
                      />
                      <stop
                        offset="100%"
                        stopColor="#0e7490"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#d7dde6"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#5b6573', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#d7dde6' }}
                  />
                  <YAxis
                    tick={{ fill: '#5b6573', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(v: number) =>
                      v >= 1000
                        ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`
                        : String(v)
                    }
                  />
                  <Tooltip
                    content={<TrendTooltip currency={currency} />}
                    cursor={{
                      stroke: '#b8c0cc',
                      strokeWidth: 1,
                      strokeDasharray: '4 4'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#0e7490"
                    strokeWidth={2}
                    fill={`url(#dash-fill-${gradientId})`}
                    dot={{
                      r: 3,
                      fill: '#fff',
                      stroke: '#0e7490',
                      strokeWidth: 1.5
                    }}
                    activeDot={{ r: 5, strokeWidth: 0, fill: '#0e7490' }}
                    isAnimationActive
                    animationDuration={650}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
