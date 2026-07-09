import { useState, useEffect } from 'react'
import { useProduccion } from '../hooks/useProduccion'
import { GRUPO_A, GRUPO_B } from '../lib/constants'
import { supabase } from '../lib/supabase'

function getGrupo(n) {
  if (GRUPO_A.includes(n)) return 'A'
  if (GRUPO_B.includes(n)) return 'B'
  return 'C'
}

export default function Carrito2() {
  const { conteoCarrito2, guardarCarrito2, diasVentas, calcDescartes } = useProduccion()
  const [conteo, setConteo] = useState({})
  const [descartes, setDescartes] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const today = new Date().toISOString().split('T')[0]
  const dow = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][new Date().getDay()]

  // Obtener todos los productos conocidos
  const nombres = new Set()
  diasVentas.forEach(d => {
    Object.keys(d.productos || {}).forEach(k => {
      const [cat, ...rest] = k.split('|')
      if (['Gourmet','Clasicos'].includes(cat)) nombres.add(rest.join('|'))
    })
  })
  GRUPO_A.forEach(n => nombres.add(n))
  GRUPO_B.forEach(n => nombres.add(n))
  const sortedNames = Array.from(nombres).sort((a,b) => {
    const ga = getGrupo(a), gb = getGrupo(b)
    if (ga !== gb) return ga.localeCompare(gb)
    return a.localeCompare(b)
  })

  useEffect(() => {
    setConteo({ ...conteoCarrito2 })
    loadDescartes()
  }, [conteoCarrito2])

  async function loadDescartes() {
    const ds = await calcDescartes()
    setDescartes(ds)
  }

  async function guardar() {
    setSaving(true)
    const filtrado = Object.fromEntries(Object.entries(conteo).filter(([,v]) => v > 0))
    const { error } = await guardarCarrito2(filtrado)
    if (!error) {
      setMsg('✓ Conteo guardado para ' + today)
      await loadDescartes()
    } else {
      setMsg('Error guardando. Intenta de nuevo.')
    }
    setSaving(false)
    setTimeout(() => setMsg(null), 3000)
  }

  const gcColor = { A: '#e6f4ea', B: '#fff3e0', C: '#f5f5f5' }
  const gcText  = { A: '#1a7340', B: '#e65100', C: '#666' }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🛒 Carrito 2 — Pendiente</div>
          <div className="page-subtitle">{today} · {dow} · Pastelillo armado sin freír de ayer</div>
        </div>
      </div>

      {descartes.size > 0 && (
        <div className="alert-danger">
          <strong>⚠️ Llevan {'>'}2 días sin freírse — DESCARTAR:</strong><br />
          {Array.from(descartes).join(' · ')}
        </div>
      )}

      <div className="card">
        <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
          Solo anota los sabores que tengan sobrante físico en el Carrito 2. Deja en blanco los que no tengan.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 100px', gap: '6px 12px', maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
          {sortedNames.map(name => {
            const g = getGrupo(name)
            const esDescarte = descartes.has(name)
            return (
              <>
                <div key={name+'_l'} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '3px 0' }}>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: gcColor[g], color: gcText[g], fontWeight: 600 }}>{g}</span>
                  {name}
                  {esDescarte && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', fontWeight: 600 }}>descartar</span>}
                </div>
                <input
                  key={name+'_i'} type="number" min="0" step="1" placeholder="0"
                  value={conteo[name] || ''}
                  onChange={e => {
                    const v = parseInt(e.target.value)
                    setConteo(prev => ({ ...prev, [name]: isNaN(v) ? 0 : v }))
                  }}
                  style={{ width: '100%', borderColor: esDescarte ? '#fca5a5' : undefined }}
                />
              </>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16 }}>
          <button className="btn-primary" onClick={guardar} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar conteo de hoy'}
          </button>
          {msg && <span style={{ fontSize: 13, color: '#166534' }}>{msg}</span>}
        </div>
      </div>
    </div>
  )
}
