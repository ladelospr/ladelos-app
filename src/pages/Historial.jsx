import { useProduccion } from '../hooks/useProduccion'
import { DOW_ES } from '../lib/constants'

export default function Historial() {
  const { diasVentas } = useProduccion()
  const sorted = [...diasVentas].sort((a, b) => b.fecha.localeCompare(a.fecha))

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📁 Historial de Ventas</div>
          <div className="page-subtitle">{diasVentas.length} días registrados</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto' }}>
          <div className="table-header">Fecha</div>
          <div className="table-header" style={{ textAlign: 'center' }}>Día</div>
          <div className="table-header" style={{ textAlign: 'right' }}>Total vendido</div>
          {sorted.map(d => (
            <>
              <div key={d.fecha+'_f'} className="table-cell">{d.fecha}</div>
              <div key={d.fecha+'_d'} className="table-cell" style={{ textAlign: 'center', color: '#666' }}>{DOW_ES[d.dia_semana]?.slice(0,3)}</div>
              <div key={d.fecha+'_t'} className="table-cell" style={{ textAlign: 'right', fontWeight: 600 }}>{d.total_vendido ?? '—'}</div>
            </>
          ))}
        </div>
      </div>
    </div>
  )
}
