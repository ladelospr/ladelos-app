import { useState } from 'react'
import { useProduccion } from '../hooks/useProduccion'
import { DOW_ES, DOW_ORDER } from '../lib/constants'

export default function Produccion() {
  const { diasVentas, calcPlanParaDow, loading } = useProduccion()
  const [activeDow, setActiveDow] = useState('Monday')

  const ndow = {}
  diasVentas.forEach(d => { ndow[d.dia_semana] = (ndow[d.dia_semana] || 0) + 1 })

  const items = calcPlanParaDow(activeDow)
  const totalPreparar = items.reduce((s, i) => s + i.total, 0)
  const hasMayorista = items.some(i => i.mayorista > 0)

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Cargando...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📋 Plan de Producción</div>
          <div className="page-subtitle">{diasVentas.length} días de historial · Incluye demanda de mayoristas</div>
        </div>
      </div>

      {!diasVentas.length && (
        <div className="alert-warning">
          Aún no hay datos de ventas. Ve a "Ventas" para cargar reportes de Clover.
        </div>
      )}

      <div className="dow-pills">
        {DOW_ORDER.slice(0, 6).map(dow => (
          <button
            key={dow}
            className={`dow-pill ${activeDow === dow ? 'active' : ''}`}
            onClick={() => setActiveDow(dow)}
          >
            {DOW_ES[dow]} <span style={{ opacity: 0.6, fontSize: 11 }}>({ndow[dow] || 0})</span>
          </button>
        ))}
      </div>

      {items.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div className="stat-card" style={{ flex: 1, minWidth: 100 }}>
              <div className="stat-label">Total a preparar</div>
              <div className="stat-value">{totalPreparar}</div>
            </div>
            <div className="stat-card" style={{ flex: 1, minWidth: 100 }}>
              <div className="stat-label">Docenas</div>
              <div className="stat-value">{Math.round(totalPreparar / 12 * 10) / 10}</div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-grid" style={{
              gridTemplateColumns: `minmax(0,1fr) 70px ${hasMayorista ? '70px' : ''} 70px 80px 50px`
            }}>
              <div className="table-header">Producto</div>
              <div className="table-header" style={{ textAlign: 'right' }}>Local</div>
              {hasMayorista && <div className="table-header" style={{ textAlign: 'right' }}>Mayor.</div>}
              <div className="table-header" style={{ textAlign: 'right' }}>C2</div>
              <div className="table-header" style={{ textAlign: 'right' }}>Preparar</div>
              <div className="table-header" style={{ textAlign: 'center' }}>G</div>

              {items.map(item => (
                <>
                  <div key={item.name + '_n'} className="table-cell">{item.name}</div>
                  <div key={item.name + '_s'} className="table-cell" style={{ textAlign: 'right', color: '#666' }}>{item.sugerido}</div>
                  {hasMayorista && (
                    <div key={item.name + '_m'} className="table-cell" style={{ textAlign: 'right', color: item.mayorista > 0 ? '#1B3BAA' : '#ccc' }}>
                      {item.mayorista > 0 ? `+${item.mayorista}` : '—'}
                    </div>
                  )}
                  <div key={item.name + '_p'} className="table-cell" style={{ textAlign: 'right', color: item.pendiente > 0 ? '#d97706' : '#ccc' }}>
                    {item.pendiente > 0 ? `-${item.pendiente}` : '—'}
                  </div>
                  <div key={item.name + '_t'} className="table-cell" style={{ textAlign: 'right', fontWeight: 700, color: '#1B3BAA' }}>{item.total}</div>
                  <div key={item.name + '_g'} className="table-cell" style={{ textAlign: 'center' }}>
                    <span className={`badge badge-${item.grupo.toLowerCase()}`}>{item.grupo}</span>
                  </div>
                </>
              ))}
            </div>
          </div>
        </>
      )}

      {!items.length && diasVentas.length > 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          No hay datos para {DOW_ES[activeDow]} todavía.
        </div>
      )}
    </div>
  )
}
