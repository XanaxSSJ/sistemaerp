import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/LoginPage'
import { useSession } from './store/session'

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
)
const NewInvoicePage = lazy(() =>
  import('./pages/NewInvoicePage').then((m) => ({ default: m.NewInvoicePage }))
)
const InvoicesPage = lazy(() =>
  import('./pages/InvoicesPage').then((m) => ({ default: m.InvoicesPage }))
)
const NotesSalePage = lazy(() =>
  import('./pages/NotesSalePage').then((m) => ({ default: m.NotesSalePage }))
)
const ProductsPage = lazy(() =>
  import('./pages/ProductsPage').then((m) => ({ default: m.ProductsPage }))
)
const CategoriesPage = lazy(() =>
  import('./pages/CategoriesPage').then((m) => ({ default: m.CategoriesPage }))
)
const BrandsPage = lazy(() =>
  import('./pages/BrandsPage').then((m) => ({ default: m.BrandsPage }))
)
const InventoryPage = lazy(() =>
  import('./pages/InventoryPage').then((m) => ({ default: m.InventoryPage }))
)
const InventoryReportPage = lazy(() =>
  import('./pages/InventoryReportPage').then((m) => ({
    default: m.InventoryReportPage
  }))
)
const ProductsReportPage = lazy(() =>
  import('./pages/ProductsReportPage').then((m) => ({
    default: m.ProductsReportPage
  }))
)
const TransfersPage = lazy(() =>
  import('./pages/TransfersPage').then((m) => ({ default: m.TransfersPage }))
)
const TransfersHistoryPage = lazy(() =>
  import('./pages/TransfersHistoryPage').then((m) => ({
    default: m.TransfersHistoryPage
  }))
)
const BranchesPage = lazy(() =>
  import('./pages/BranchesPage').then((m) => ({ default: m.BranchesPage }))
)
const UsersPage = lazy(() =>
  import('./pages/UsersPage').then((m) => ({ default: m.UsersPage }))
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
)
const CustomersPage = lazy(() =>
  import('./pages/CustomersPage').then((m) => ({ default: m.CustomersPage }))
)

function RouteFallback() {
  return (
    <div className="flex h-full min-h-[40vh] items-center justify-center text-sm text-[var(--ms-muted)]">
      Cargando…
    </div>
  )
}

function Protected() {
  const { user, sucursal } = useSession()
  if (!user || !sucursal) return <Navigate to="/login" replace />
  return <AppShell />
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useSession()
  if (user?.rol !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const { user, sucursal } = useSession()

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route
          path="/login"
          element={
            user && sucursal ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginPage />
            )
          }
        />
        <Route element={<Protected />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route path="/dashboard" element={<DashboardPage />} />

          <Route path="/ventas/nuevo" element={<NewInvoicePage />} />
          <Route path="/ventas/comprobantes" element={<InvoicesPage />} />
          <Route path="/ventas/notas-venta" element={<NotesSalePage />} />
          <Route path="/productos" element={<ProductsPage />} />
          <Route path="/productos/categorias" element={<CategoriesPage />} />
          <Route path="/productos/marcas" element={<BrandsPage />} />

          <Route path="/inventario" element={<InventoryPage />} />
          <Route path="/inventario/reporte" element={<InventoryReportPage />} />
          <Route
            path="/inventario/reporte-productos"
            element={<ProductsReportPage />}
          />

          <Route path="/transferencias" element={<TransfersPage />} />
          <Route
            path="/transferencias/historial"
            element={<TransfersHistoryPage />}
          />

          <Route
            path="/sucursales"
            element={
              <AdminOnly>
                <BranchesPage />
              </AdminOnly>
            }
          />
          <Route
            path="/usuarios"
            element={
              <AdminOnly>
                <UsersPage />
              </AdminOnly>
            }
          />
          <Route
            path="/empresa"
            element={
              <AdminOnly>
                <SettingsPage />
              </AdminOnly>
            }
          />

          <Route
            path="/comprobantes"
            element={<Navigate to="/ventas/comprobantes" replace />}
          />
          <Route
            path="/configuracion"
            element={<Navigate to="/empresa" replace />}
          />
          <Route path="/clientes" element={<CustomersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}
