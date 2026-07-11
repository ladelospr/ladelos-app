import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { MODULO_ACCESO, ROLE_LABELS } from '../lib/constants'

const NAV_ITEMS = [
  { key: 'produccion',   label: 'Producción',   emoji: '📋' },
  { key: 'carrito2',     label: 'Carrito 2',    emoji: '🛒' },
  { key: 'cocina',       label: 'Cocina',        emoji: '🍳' },
  { key: 'calendario',   label: 'Calendario',   emoji: '📅' },
  { key: 'ingredientes', label: 'Ingredientes', emoji: '🧮' },
  { key: 'mayoristas',   label: 'Mayoristas',   emoji: '📦' },
  { key: 'facturas',     label: 'Facturas',      emoji: '🧾' },
  { key: 'compras',      label: 'Compras',       emoji: '💰' },
  { key: 'ventas',       label: 'Ventas',        emoji: '📊' },
  { key: 'clover', label: 'Clover Sync', emoji: '🔄' },
  { key: 'historial',    label: 'Historial',    emoji: '📁' },
  { key: 'configuracion',label: 'Config',       emoji: '⚙️' },
]

export default function Layout({ children, activeTab, onTabChange }) {
  const { profile, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const visibleItems = NAV_ITEMS.filter(item =>
    MODULO_ACCESO[item.key]?.includes(profile?.rol)
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f7fa' }}>

      {/* Sidebar desktop */}
      <aside style={{
        width: 220, background: '#1B3BAA', color: 'white',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
      }} className="sidebar-desktop">
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <img src="/ladelos-badge-8.png" alt="Ladelos" style={{ width: 140, objectFit: 'contain', marginBottom: 8 }} />
        </div>

        <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
          {visibleItems.map(item => (
            <button
              key={item.key}
              onClick={() => onTabChange(item.key)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 20px', border: 'none', cursor: 'pointer',
                background: activeTab === item.key ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: activeTab === item.key ? 'white' : 'rgba(255,255,255,0.65)',
                fontSize: 13, fontWeight: activeTab === item.key ? 600 : 400,
                borderLeft: activeTab === item.key ? '3px solid #FF9900' : '3px solid transparent',
                textAlign: 'left',
              }}
            >
              <span>{item.emoji}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 12, opacity: 0.6 }}>{ROLE_LABELS[profile?.rol]}</div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{profile?.nombre}</div>
          <button onClick={signOut} style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
            Cerrar sesión →
          </button>
        </div>
      </aside>

      {/* Header móvil */}
      <div className="mobile-header" style={{
        display: 'none', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        background: '#1B3BAA', color: 'white', padding: '12px 16px',
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/ladelos-badge-8.png" alt="Ladelos" style={{ height: 36, objectFit: 'contain' }} />
        </div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ background: 'transparent', border: 'none', color: 'white', fontSize: 24, cursor: 'pointer', padding: 4 }}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Menú móvil desplegable */}
      {menuOpen && (
        <div className="mobile-menu" style={{
          display: 'none', position: 'fixed', top: 52, left: 0, right: 0, bottom: 0,
          background: '#1B3BAA', zIndex: 190, overflowY: 'auto', paddingTop: 8,
        }}>
          {visibleItems.map(item => (
            <button
              key={item.key}
              onClick={() => { onTabChange(item.key); setMenuOpen(false) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 20px', border: 'none', cursor: 'pointer',
                background: activeTab === item.key ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: activeTab === item.key ? 'white' : 'rgba(255,255,255,0.7)',
                fontSize: 15, fontWeight: activeTab === item.key ? 600 : 400,
                borderLeft: activeTab === item.key ? '3px solid #FF9900' : '3px solid transparent',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 20 }}>{item.emoji}</span>
              <span>{item.label}</span>
            </button>
          ))}
          <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>{ROLE_LABELS[profile?.rol]}</div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>{profile?.nombre}</div>
            <button onClick={() => { signOut(); setMenuOpen(false) }} style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
              Cerrar sesión →
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main style={{ marginLeft: 220, flex: 1, padding: '24px 28px', minHeight: '100vh' }} className="main-content">
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          {children}
        </div>
      </main>

      <style>{`
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .mobile-header { display: flex !important; }
          .mobile-menu { display: block !important; }
          .main-content { margin-left: 0 !important; padding: 72px 16px 24px !important; }
        }
      `}</style>
    </div>
  )
}
