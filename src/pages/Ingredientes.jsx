import { useState } from 'react'
import { useProduccion } from '../hooks/useProduccion'
import { DOW_ES, DOW_ORDER, ING_LABELS, PROTEINAS, TANDAS_LB } from '../lib/constants'

export default function Ingredientes() {
  const { diasVentas, calcIngredientesParaDow, calcInventario } = useProduccion()
  const [activeDow, setActiveDow] = useState('Monday')

  const ndow = {}
  diasVentas.forEach(d => { ndow[d.dia_semana] = (ndow[d.dia_semana] || 0) + 1 })

  const needed = calcIngredientesParaDow(activeDow)
  const inv = calcInventario()

  const sorted = Object.keys(needed).sort((a, b) => {
    const pa = PROTEINAS.includes(a), pb = PROTEINAS.includes(b)
    if (pa && !pb) return -1
    if (!pa && pb) return 1
    return (ING_LABELS[a] || a).localeCompare(ING_LABELS[b] || b)
  })

  if (!diasVentas.length) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
      Carga reportes de ventas primero para ver los ingredientes necesarios.
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🧮 Ingredientes</div>
          <div className="page-subtitle">Necesarios para el plan de producción · Incluye demanda de mayoristas</div>
        </div>
      </div>

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

      {sorted.length > 0 ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto auto auto' }}>
            <div className="table-header">Ingrediente</div>
            <div className="table-header" style={{ textAlign: 'right' }}>Necesario</div>
            <div className="table-header" style={{ textAlign: 'right' }}>Disponible</div>
            <div className="table-header" style={{ textAlign: 'right' }}>Tandas</div>
            <div className="table-header" style={{ textAlign: 'center' }}>Estado</div>

            {sorted.map(ing => {
              const oz = needed[ing]
              const lb = (oz / 16).toFixed(1)
              const esProt = PROTEINAS.includes(ing)
              const dispOz = esProt ? (inv[ing] || 0) : null
              const dispLb = dispOz !== null ? (dispOz / 16).toFixed(1) : '—'
              const tandaLb = TANDAS_LB[ing]
              const pctTanda = tandaLb ? Math.round(oz / 16 / tandaLb * 10) / 10 : null
              const suficiente = dispOz !== null ? dispOz >= oz : true
              const estado = dispOz !== null ? (suficiente ? '✓' : '⚠️ Falta') : '—'
              const colorRow = dispOz !== null && !suficiente ? '#dc2626' : undefined

              return (
                <>
                  <div key={ing+'_n'} className="table-cell" style={{ fontWeight: esProt ? 600 : 400, color: colorRow }}>{ING_LABELS[ing] || ing}</div>
                  <div key={ing+'_l'} className="table-cell" style={{ textAlign: 'right', color: colorRow }}>{lb} lb</div>
                  <div key={ing+'_d'} className="table-cell" style={{ textAlign: 'right', color: '#666' }}>{dispLb}{dispOz !== null ? ' lb' : ''}</div>
                  <div key={ing+'_t'} className="table-cell" style={{ textAlign: 'right' }}>
                    {pctTanda ? (
                      <span style={{ color: pctTanda > 0.8 ? '#d97706' : '#666' }}>{pctTanda}t</span>
                    ) : '—'}
                  </div>
                  <div key={ing+'_e'} className="table-cell" style={{ textAlign: 'center', fontSize: 12, color: colorRow }}>{estado}</div>
                </>
              )
            })}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Sin datos para {DOW_ES[activeDow]}.</div>
      )}
      <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
        "Disponible" solo aplica a proteínas con tanda registrada en Cocina.
      </p>
    </div>
  )
}
