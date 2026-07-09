import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PRECIOS_REVENTA } from '../lib/constants'

export default function Facturas() {
  const [facturas, setFacturas] = useState([])

  useEffect(() => {
    supabase.from('facturas').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setFacturas(data || []))
  }, [])

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🧾 Facturas</div>
          <div className="page-subtitle">Las facturas se generan desde el módulo de Mayoristas</div>
        </div>
      </div>

      {!facturas.length ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          No hay facturas emitidas aún. Ve a Mayoristas → selecciona una orden → Factura.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-grid" style={{ gridTemplateColumns: 'auto minmax(0,1fr) auto auto auto' }}>
            <div className="table-header">Número</div>
            <div className="table-header">Cliente</div>
            <div className="table-header" style={{ textAlign: 'right' }}>Total</div>
            <div className="table-header" style={{ textAlign: 'center' }}>Estado</div>
            <div className="table-header"></div>
            {facturas.map(f => (
              <>
                <div key={f.id+'_n'} className="table-cell" style={{ color: '#1B3BAA', fontWeight: 600 }}>{f.numero}</div>
                <div key={f.id+'_c'} className="table-cell">{f.cliente_nombre}</div>
                <div key={f.id+'_t'} className="table-cell" style={{ textAlign: 'right', fontWeight: 700 }}>${f.total}</div>
                <div key={f.id+'_e'} className="table-cell" style={{ textAlign: 'center', fontSize: 12 }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 20,
                    background: f.estado === 'pagada' ? '#e6f4ea' : f.estado === 'anulada' ? '#fef2f2' : '#f0f4ff',
                    color: f.estado === 'pagada' ? '#1a7340' : f.estado === 'anulada' ? '#dc2626' : '#1B3BAA',
                  }}>{f.estado}</span>
                </div>
                <div key={f.id+'_a'} className="table-cell">
                  <button className="btn-secondary" style={{ fontSize: 11, padding: '3px 8px' }}>Ver</button>
                </div>
              </>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
