import { useState, useEffect, Suspense, lazy } from 'react'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import { MODULO_ACCESO } from './lib/constants'

// Lazy load de páginas
const Produccion    = lazy(() => import('./pages/Produccion'))
const Carrito2      = lazy(() => import('./pages/Carrito2'))
const Cocina        = lazy(() => import('./pages/Cocina'))
const Calendario    = lazy(() => import('./pages/Calendario'))
const Ingredientes  = lazy(() => import('./pages/Ingredientes'))
const Mayoristas    = lazy(() => import('./pages/Mayoristas'))
const Facturas      = lazy(() => import('./pages/Facturas'))
const Ventas        = lazy(() => import('./pages/Ventas'))
const Historial     = lazy(() => import('./pages/Historial'))
const Configuracion = lazy(() => import('./pages/Configuracion'))
const Compras       = lazy(() => import('./pages/Compras'))

const PAGE_MAP = {
  produccion: Produccion,
  carrito2: Carrito2,
  cocina: Cocina,
  calendario: Calendario,
  ingredientes: Ingredientes,
  mayoristas: Mayoristas,
  facturas: Facturas,
  ventas: Ventas,
  compras: Compras,
  historial: Historial,
  configuracion: Configuracion,
}

function getDefaultTab(rol) {
  const defaults = {
    admin: 'produccion',
    supervisor: 'produccion',
    cocina: 'carrito2',
    produccion: 'produccion',
  }
  return defaults[rol] || 'produccion'
}

export default function App() {
  const { user, profile, loading } = useAuth()
  const [activeTab, setActiveTab] = useState(null)

  useEffect(() => {
    if (profile) setActiveTab(getDefaultTab(profile.rol))
  }, [profile])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, fontWeight: 900, color: '#5b8db8', fontStyle: 'italic' }}>L</div>
        <div style={{ fontSize: 13, color: '#999', marginTop: 8 }}>Cargando...</div>
      </div>
    </div>
  )

  if (!user) return <Login />

  const canAccess = activeTab && MODULO_ACCESO[activeTab]?.includes(profile?.rol)
  const PageComponent = canAccess ? PAGE_MAP[activeTab] : null

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      <Suspense fallback={
        <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Cargando módulo...</div>
      }>
        {PageComponent ? <PageComponent /> : (
          <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
            Selecciona un módulo del menú.
          </div>
        )}
      </Suspense>
    </Layout>
  )
}
