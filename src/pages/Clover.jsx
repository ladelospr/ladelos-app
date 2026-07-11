import { useState } from 'react'
import { sincronizarVentasHoy, getVentasDelDia, procesarVentasClover } from '../lib/clover'
import { supabase } from '../lib/supabase'

export default function Clover() {
  const [sincronizando, setSincronizando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [historial, setHistorial] = useState([])

  async function sincronizarHoy() {
    setSincronizando(true)
    setMsg(null)
    try {
      const { fecha: f, dow, products, totalSold } = await sincronizarVentasHoy()
      
      const { error } = await supabase
        .from('dias_ventas')
        .upsert({
          fecha: f,
          dia_semana: dow,
          total_vendido: totalSold,
          productos: products,
        }, { onConflict: 'fecha' })

      if (error) throw error
      setMsg({ type: 'success', text: `✓ Sincronizado: ${totalSold} items vendidos hoy (${f})` })
    } catch (e) {
      setMsg({ type: 'error', text: 'Error: ' + e.message })
    }
    setSincronizando(false)
  }

  async function sincronizarFecha() {
    setSincronizando(true)
    setMsg(null)
    try {
      const lineItems = await getVentasDelDia(fecha)
      const { products, totalSold } = procesarVentasClover(lineItems)
      const dt = new Date(fecha + 'T12:00:00')
      const dow = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dt.getDay()]

      const { error } = await supabase
        .from('dias_ventas')
        .upsert({
          fecha,
          dia_semana: dow,
          total_vendido: totalSold,
          productos: products,
        }, { onConflict: 'fecha' })

      if (error) throw error
      setMsg({ type: 'success', text: `✓ Sincronizado: ${totalSold} items vendidos el ${fecha}` })
    } catch (e) {
      setMsg({ type: 'error', text: 'Error: ' + e.message })
    }
    setSincronizando(false)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🔄 Sincronizar Clover</div>
          <div className="page-subtitle">Importa las ventas directamente desde tu Clover de Bayamón</div>
        </div>
      </div>

      {msg && (
        <div className={msg.type === 'success' ? 'alert-success' : 'alert-danger'}>
          {msg.text}
        </div>
      )}

      <div className="card">
        <h2>Sincronizar ventas de hoy</h2>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
          Importa automáticamente todas las ventas del día de hoy desde Clover.
        </p>
        <button 
          className="btn-primary" 
          onClick={sincronizarHoy} 
          disabled={sincronizando}
          style={{ fontSize: 15, padding: '12px 24px' }}
        >
          {sincronizando ? '⏳ Sincronizando...' : '🔄 Sincronizar hoy'}
        </button>
      </div>

      <div className="card">
        <h2>Sincronizar fecha específica</h2>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
          Importa las ventas de cualquier día anterior.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input 
            type="date" 
            value={fecha} 
            onChange={e => setFecha(e.target.value)}
            style={{ fontSize: 14, padding: '10px 14px' }}
          />
          <button 
            className="btn-primary" 
            onClick={sincronizarFecha} 
            disabled={sincronizando}
          >
            {sincronizando ? '⏳ Sincronizando...' : '🔄 Sincronizar esta fecha'}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>💡 Sincronización automática</h2>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
          Para sincronizar automáticamente todos los días a las 2pm sin hacer nada, 
          necesitamos configurar un servicio de automatización (próximo paso).
        </p>
        <p style={{ fontSize: 13, color: '#1B3BAA' }}>
          Por ahora puedes sincronizar manualmente con un solo click cada día.
        </p>
      </div>
    </div>
  )
}
