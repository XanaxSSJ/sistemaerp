import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  ArrowLeftRight,
  Store,
  UserCog,
  Users,
  Building2,
  LogOut,
  ChevronDown,
  Check
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType
} from 'react'
import { useRealtime } from '../hooks/useRealtime'
import { useSession, type SucursalOption } from '../store/session'
import { Badge, Button } from './ui'
import { cn } from '../lib/cn'

type NavChild = { to: string; label: string }
type NavItem = {
  id: string
  label: string
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  to?: string
  children?: NavChild[]
  adminOnly?: boolean
}

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  {
    id: 'ventas',
    label: 'Ventas',
    icon: ShoppingCart,
    children: [
      { to: '/ventas/nuevo', label: 'Nuevo comprobante' },
      { to: '/ventas/comprobantes', label: 'Listas de comprobantes' },
      { to: '/ventas/notas-venta', label: 'Notas de venta' }
    ]
  },
  {
    id: 'clientes',
    label: 'Clientes',
    icon: Users,
    to: '/clientes'
  },
  {
    id: 'productos',
    label: 'Productos',
    icon: Package,
    children: [
      { to: '/productos', label: 'Productos' },
      { to: '/productos/categorias', label: 'Categoria' },
      { to: '/productos/marcas', label: 'Marca' }
    ]
  },
  {
    id: 'inventario',
    label: 'Inventario',
    icon: Boxes,
    children: [
      { to: '/inventario', label: 'Inventario' },
      { to: '/inventario/reporte', label: 'Reporte de inventario' },
      { to: '/inventario/reporte-productos', label: 'Reporte Productos' }
    ]
  },
  {
    id: 'transferencias',
    label: 'Transferencias',
    icon: ArrowLeftRight,
    children: [
      { to: '/transferencias', label: 'Transferencias' },
      { to: '/transferencias/historial', label: 'Historial de transferencias' }
    ]
  },
  {
    id: 'sucursales',
    label: 'Sucursales',
    icon: Store,
    to: '/sucursales',
    adminOnly: true
  },
  {
    id: 'usuarios',
    label: 'Usuarios',
    icon: UserCog,
    to: '/usuarios',
    adminOnly: true
  },
  {
    id: 'empresa',
    label: 'Empresa',
    icon: Building2,
    to: '/empresa',
    adminOnly: true
  }
]

function sectionOpenForPath(item: NavItem, pathname: string): boolean {
  if (item.to && (pathname === item.to || pathname.startsWith(`${item.to}/`))) {
    return true
  }
  return Boolean(item.children?.some((c) => pathname === c.to || pathname.startsWith(`${c.to}/`)))
}

export function AppShell() {
  const { user, sucursal, setSucursal, logout } = useSession()
  const location = useLocation()
  const [apiUrl, setApiUrl] = useState('')
  const realtimeStatus = useRealtime()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const isAdmin = user?.rol === 'admin'
  const [branchMenuOpen, setBranchMenuOpen] = useState(false)
  const [branches, setBranches] = useState<SucursalOption[]>([])
  const branchMenuRef = useRef<HTMLDivElement>(null)

  const items = useMemo(
    () => NAV.filter((n) => !n.adminOnly || user?.rol === 'admin'),
    [user?.rol]
  )

  useEffect(() => {
    void window.mebsy.app
      .mode()
      .then((m) => setApiUrl(m.apiUrl))
      .catch(() => setApiUrl(''))
  }, [])

  useEffect(() => {
    if (!isAdmin) {
      setBranches([])
      setBranchMenuOpen(false)
      return
    }
    void window.mebsy.branches
      .list()
      .then((rows) => {
        const list = (rows as Array<SucursalOption & { activa?: boolean }>)
          .filter((b) => b.activa !== false)
          .map((b) => ({
            id: Number(b.id),
            codigo: b.codigo,
            nombre: b.nombre,
            direccion: b.direccion ?? ''
          }))
        setBranches(list)
      })
      .catch(() => setBranches([]))
  }, [isAdmin])

  useEffect(() => {
    if (!branchMenuOpen) return
    function onPointerDown(e: MouseEvent) {
      if (
        branchMenuRef.current &&
        !branchMenuRef.current.contains(e.target as Node)
      ) {
        setBranchMenuOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setBranchMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [branchMenuOpen])

  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev }
      for (const item of items) {
        if (item.children && sectionOpenForPath(item, location.pathname)) {
          next[item.id] = true
        }
      }
      return next
    })
  }, [location.pathname, items])

  function toggle(id: string) {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function selectBranch(branch: SucursalOption) {
    if (sucursal?.id === branch.id) {
      setBranchMenuOpen(false)
      return
    }
    setSucursal(branch)
    setBranchMenuOpen(false)
  }

  return (
    <div className="flex h-full bg-[var(--ms-canvas)]">
      <aside className="flex w-[248px] shrink-0 flex-col bg-[var(--ms-sidebar)] text-white">
        <div className="border-b border-white/10 px-4 py-5">
          <div className="font-display text-[26px] leading-none tracking-[-0.02em]">
            Mebsy
            <span className="text-[var(--ms-mint)]">Store</span>
          </div>

          <div className="relative mt-3" ref={branchMenuRef}>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setBranchMenuOpen((v) => !v)}
                className="flex w-full items-start gap-2 border border-white/10 bg-[var(--ms-sidebar-hover)] px-3 py-2.5 text-left transition hover:border-white/25 hover:bg-[var(--ms-sidebar-active)]"
                aria-expanded={branchMenuOpen}
                aria-haspopup="listbox"
                title="Cambiar sede"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-semibold tracking-[0.08em] text-white/40 uppercase">
                    Sede activa
                  </div>
                  <div className="mt-0.5 truncate text-[13px] font-semibold">
                    {sucursal?.nombre ?? 'Sin sede'}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-white/55">
                    {sucursal?.codigo ?? '—'}
                  </div>
                </div>
                <ChevronDown
                  size={15}
                  className={cn(
                    'mt-1 shrink-0 text-white/55 transition',
                    branchMenuOpen && 'rotate-180'
                  )}
                />
              </button>
            ) : (
              <div className="border border-white/10 bg-[var(--ms-sidebar-hover)] px-3 py-2.5">
                <div className="text-[13px] font-semibold">
                  {sucursal?.nombre}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-white/55">
                  {sucursal?.codigo}
                </div>
              </div>
            )}

            {isAdmin && branchMenuOpen ? (
              <div
                role="listbox"
                aria-label="Seleccionar sede"
                className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto border border-white/15 bg-[var(--ms-sidebar)] shadow-lg"
              >
                {branches.length === 0 ? (
                  <div className="px-3 py-2.5 text-xs text-white/45">
                    Sin sucursales disponibles
                  </div>
                ) : (
                  branches.map((b) => {
                    const active = sucursal?.id === b.id
                    return (
                      <button
                        key={b.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => selectBranch(b)}
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition',
                          active
                            ? 'bg-[var(--ms-sidebar-active)] text-white'
                            : 'text-white/70 hover:bg-[var(--ms-sidebar-hover)] hover:text-white'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{b.nombre}</div>
                          <div className="font-mono text-[10px] text-white/45">
                            {b.codigo}
                          </div>
                        </div>
                        {active ? (
                          <Check size={14} className="shrink-0 text-[var(--ms-mint)]" />
                        ) : null}
                      </button>
                    )
                  })
                )}
              </div>
            ) : null}

            <div className="mt-2 flex flex-wrap items-center gap-1.5 px-0.5">
              <Badge tone="accent">Cloud</Badge>
              <Badge
                tone={
                  realtimeStatus === 'live'
                    ? 'ok'
                    : realtimeStatus === 'error'
                      ? 'warn'
                      : 'neutral'
                }
              >
                {realtimeStatus === 'live'
                  ? 'Live'
                  : realtimeStatus === 'connecting'
                    ? 'Conectando'
                    : realtimeStatus === 'error'
                      ? 'Reintento'
                      : 'Offline'}
              </Badge>
            </div>
            {apiUrl ? (
              <div
                className="mt-1.5 truncate px-0.5 font-mono text-[10px] text-white/35"
                title={apiUrl}
              >
                {apiUrl.replace(/^https?:\/\//, '')}
              </div>
            ) : null}
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {items.map((item) => {
            const Icon = item.icon
            const hasChildren = Boolean(item.children?.length)
            const isOpen = open[item.id] ?? false

            if (!hasChildren && item.to) {
              return (
                <NavLink
                  key={item.id}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition',
                      isActive
                        ? 'bg-[var(--ms-sidebar-active)] text-white'
                        : 'text-white/65 hover:bg-[var(--ms-sidebar-hover)] hover:text-white'
                    )
                  }
                >
                  <Icon size={15} strokeWidth={1.75} />
                  {item.label}
                </NavLink>
              )
            }

            return (
              <div key={item.id} className="pt-0.5">
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium transition',
                    sectionOpenForPath(item, location.pathname)
                      ? 'text-white'
                      : 'text-white/65 hover:bg-[var(--ms-sidebar-hover)] hover:text-white'
                  )}
                >
                  <Icon size={15} strokeWidth={1.75} />
                  <span className="flex-1">{item.label}</span>
                  <ChevronDown
                    size={14}
                    className={cn(
                      'shrink-0 opacity-50 transition-transform',
                      isOpen && 'rotate-180'
                    )}
                  />
                </button>
                {isOpen ? (
                  <div className="mb-1 ml-3 space-y-0.5 border-l border-white/10 pl-2">
                    {item.children?.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end
                        className={({ isActive }) =>
                          cn(
                            'block px-2.5 py-1.5 text-[12.5px] transition',
                            isActive
                              ? 'bg-[var(--ms-sidebar-active)] font-medium text-white'
                              : 'text-white/55 hover:bg-[var(--ms-sidebar-hover)] hover:text-white/90'
                          )
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="px-1 text-[13px] font-semibold">{user?.nombre}</div>
          <div className="mt-0.5 px-1 font-mono text-[10px] tracking-wider text-white/45 uppercase">
            {user?.rol}
          </div>
          <Button
            variant="secondary"
            className="mt-3 w-full border-white/15 bg-transparent text-white hover:bg-white/10"
            onClick={() => logout()}
          >
            <LogOut size={14} />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto p-5 md:p-6">
        {/* Remonta la vista al cambiar sede para refrescar datos de sucursal */}
        <Outlet key={sucursal?.id ?? 'none'} />
      </main>
    </div>
  )
}
