import { useState } from 'react'
import { useProduccion } from '../hooks/useProduccion'
import { PROTEINAS, ING_LABELS, TANDAS_LB } from '../lib/constants'

export default function Cocina() {
  const { tandasCocina, agregarTanda, calcInventario, calcConsumoDiario } = useProduccion()
  const [proteina, setProteina] = useState('')
  const [libras, setLibras] = useState('')
  const [tipo, setTipo] = useState('cocinar')
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const inv = calcInventario()
  const consumo = calcConsumoDiario()

  async function handleAgregar() {
    if (!proteina || !libras) return
    setSaving(true)
    const { error } = await agregarTanda(proteina, parseFloat(libras), tipo, notas)
    if (!error) {
      setMsg({ type: 'success', text: `✓ Tanda de ${ING_LABELS[proteina]} registrada.` })
      setProteina(''); setLibras(''); setNotas(''); setTipo('cocinar')
    } else {
      setMsg({ type: 'error', text: 'Error guardando. Intenta de nuevo.' })
    }
    setSaving(false)
    setTimeout(() => setMsg(null), 3000)
  }

  const alertas = PROTEINAS.filter(p => {
    const disp = inv[p] || 0
    const diario = consumo[p] || 0
    if (!diario) return false
    const dias = disp / diario
    return dias <= 2 && tandasCocina.find(t => t.proteina === p)
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🍳 Cocina</div>
          <div className="page-subtitle">Registra cada tanda cocinada · El sistema actualiza el inventario automáticamente</div>
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="alert-danger">
          <strong>⚠️ Cocinar pronto:</strong>{' '}
          {alertas.map(p => {
            const disp = (inv[p]||0)/16
            const dias = consumo[p] ? ((inv[p]||0)/consumo[p]).toFixed(1) : '—'
            return `${ING_LABELS[p]}: ${disp.toFixed(1)} lb (~${dias} días)`
          }).join(' · ')}
        </div>
      )}

      <div className="card">
        <h2>Registrar tanda</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px', gap: 10, marginBottom: 10 }}>
          <select value={proteina} onChange={e => setProteina(e.target.value)} style={{ width: '100%' }}>
            <option value="">Selecciona proteína...</option>
            {PROTEINAS.map(p => (
              <option key={p} value={p}>{ING_LABELS[p]} (tanda: {TANDAS_LB[p]} lb)</option>
            ))}
          </select>
          <input type="number" placeholder="lb" value={libras} onChange={e => setLibras(e.target.value)} min="1" step="0.5" />
          <select value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="cocinar">Cocinar</option>
            <option value="preparar">Preparar/Picar</option>
          </select>
        </div>
        <input placeholder="Notas opcionales..." value={notas} onChange={e => setNotas(e.target.value)} style={{ width: '100%', marginBottom: 10 }} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn-primary" onClick={handleAgregar} disabled={saving || !proteina || !libras}>
            {saving ? 'Guardando...' : '+ Agregar tanda'}
          </button>
          {msg && <span style={{ fontSize: 13, color: msg.type === 'success' ? '#166534' : '#dc2626' }}>{msg.text}</span>}
        </div>
      </div>

      <h2>Inventario disponible</h2>
      {!tandasCocina.length ? (
        <div style={{ color: '#999', fontSize: 13, marginBottom: 20 }}>Aún no hay tandas registradas.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div className="table-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto auto' }}>
            <div className="table-header">Proteína</div>
            <div className="table-header" style={{ textAlign: 'right' }}>Disponible</div>
            <div className="table-header" style={{ textAlign: 'right' }}>Días est.</div>
            <div className="table-header" style={{ textAlign: 'center' }}>Estado</div>
            {PROTEINAS.filter(p => tandasCocina.find(t => t.proteina === p)).map(p => {
              const ozDisp = inv[p] || 0
              const lbDisp = (ozDisp / 16).toFixed(1)
              const diario = consumo[p] || 0
              const dias = diario > 0 ? (ozDisp / diario).toFixed(1) : '—'
              const numDias = diario > 0 ? ozDisp / diario : 99
              const color = numDias <= 2 ? '#dc2626' : numDias <= 3 ? '#d97706' : '#166534'
              const estado = numDias <= 2 ? '🔴 Cocinar' : numDias <= 3 ? '🟡 Pronto' : '✓ OK'
              return (
                <>
                  <div key={p+'_n'} className="table-cell" style={{ fontWeight: 500 }}>{ING_LABELS[p]}</div>
                  <div key={p+'_d'} className="table-cell" style={{ textAlign: 'right', color }}>{lbDisp} lb</div>
                  <div key={p+'_di'} className="table-cell" style={{ textAlign: 'right' }}>{dias}</div>
                  <div key={p+'_e'} className="table-cell" style={{ textAlign: 'center', fontSize: 12, color }}>{estado}</div>
                </>
              )
            })}
          </div>
        </div>
      )}

      <h2>Últimas tandas registradas</h2>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-grid" style={{ gridTemplateColumns: 'auto minmax(0,1fr) auto auto' }}>
          <div className="table-header">Fecha</div>
          <div className="table-header">Proteína</div>
          <div className="table-header" style={{ textAlign: 'right' }}>lb</div>
          <div className="table-header">Tipo</div>
          {tandasCocina.slice(0, 15).map(t => (
            <>
              <div key={t.id+'_f'} className="table-cell" style={{ color: '#666' }}>{t.fecha}</div>
              <div key={t.id+'_p'} className="table-cell">{ING_LABELS[t.proteina] || t.proteina}</div>
              <div key={t.id+'_l'} className="table-cell" style={{ textAlign: 'right', fontWeight: 600 }}>{t.libras}</div>
              <div key={t.id+'_t'} className="table-cell" style={{ fontSize: 12, color: '#666' }}>{t.tipo}</div>
            </>
          ))}
        </div>
      </div>
    </div>
  )
}
