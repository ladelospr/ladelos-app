import { useProduccion } from '../hooks/useProduccion'
import { CALENDARIO_BASE, ING_LABELS, DOW_ES, DOW_ORDER } from '../lib/constants'

const DOW_ORDER_JS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]

export default function Calendario() {
  const { calcInventario, calcConsumoDiario, tandasCocina } = useProduccion()
  const inv = calcInventario()
  const consumo = calcConsumoDiario()
  const todayDow = DOW_ORDER_JS[new Date().getDay()]

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📅 Calendario de Cocina</div>
          <div className="page-subtitle">Semana actual · Se ajusta según inventario disponible</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {DOW_ORDER.slice(0,6).map(dow => {
          const items = CALENDARIO_BASE[dow] || []
          const isToday = dow === todayDow
          const idx = DOW_ORDER.indexOf(dow)
          const todayIdx = DOW_ORDER.indexOf(todayDow)
          const isPast = idx < todayIdx

          return (
            <div key={dow} style={{
              border: `1px solid ${isToday ? '#1B3BAA' : '#e8e8e8'}`,
              borderRadius: 12,
              padding: '14px 18px',
              background: isToday ? '#f0f4ff' : 'white',
              opacity: isPast ? 0.5 : 1,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: isToday ? '#1B3BAA' : '#1a1a1a' }}>
                  {DOW_ES[dow]}
                  {isToday && <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#1B3BAA', color: 'white' }}>Hoy</span>}
                </div>
              </div>

              {!items.length && (
                <div style={{ fontSize: 13, color: '#999' }}>Sin cocina programada</div>
              )}

              {items.map((item, i) => {
                if (item.tipo === 'buffer') return (
                  <div key={i} style={{ fontSize: 13, color: '#666', padding: '3px 0' }}>
                    🔄 Buffer: cocinar cualquier proteína faltante para fin de semana y lunes
                  </div>
                )

                const ozDisp = inv[item.proteina] || 0
                const lbDisp = (ozDisp / 16).toFixed(1)
                const diario = consumo[item.proteina] || 0
                const dias = diario > 0 ? ozDisp / diario : 99
                const hasTanda = tandasCocina.find(t => t.proteina === item.proteina)
                const color = hasTanda ? (dias <= 2 ? '#dc2626' : dias <= 3 ? '#d97706' : '#166534') : '#999'
                const emoji = item.tipo === 'cocinar' ? '🍳' : '🔪'

                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: i < items.length-1 ? '1px solid #f5f5f5' : 'none' }}>
                    <div style={{ fontSize: 13 }}>
                      {emoji} <strong>{item.tipo === 'cocinar' ? 'Cocinar' : 'Preparar'}:</strong> {ING_LABELS[item.proteina] || item.proteina}
                      {item.lb > 0 && <span style={{ color: '#666' }}> (~{item.lb} lb base)</span>}
                    </div>
                    <div style={{ fontSize: 12, color }}>
                      {hasTanda ? `${lbDisp} lb · ${dias.toFixed(1)} días` : 'Sin tanda registrada'}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
