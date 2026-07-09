import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { PRECIOS_REVENTA, DOW_ES } from '../lib/constants'
import { useAuth } from '../contexts/AuthContext'

const DOW_ORDER_JS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]

function dateKeyToDow(dk) {
  const [y,m,d] = dk.split('-').map(Number)
  const dt = new Date(y, m-1, d)
  return DOW_ORDER_JS[dt.getDay()]
}

function generarNumFactura() {
  const now = new Date()
  return `FAC-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getTime()).slice(-4)}`
}

function abrirFactura(orden) {
  const items = orden.items || {}
  let total = 0
  let rows = ''
  for (const [sab, doc] of Object.entries(items)) {
    const precio = PRECIOS_REVENTA[sab] || 0
    const subtotal = precio * doc
    total += subtotal
    rows += `<tr>
      <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;">${sab}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${doc}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">$${precio}.00</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;">$${subtotal}.00</td>
    </tr>`
  }
  const totalUnits = Object.values(items).reduce((s,d) => s + d * 12, 0)
  const dow = dateKeyToDow(orden.fecha_entrega)
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Factura ${orden.numero || generarNumFactura()}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:40px;max-width:720px;margin:0 auto;color:#1a1a1a;}
    @media print{.no-print{display:none;}}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #5b8db8;}
    .logo{color:#5b8db8;font-size:52px;font-weight:900;font-style:italic;line-height:1;}
    .brand{color:#1B3BAA;font-size:20px;font-weight:700;letter-spacing:2px;}
    .brand-sub{color:#5b8db8;font-size:10px;letter-spacing:3px;}
    .num{font-size:22px;font-weight:700;color:#1B3BAA;}
    .cliente-box{background:#f0f4fa;border-radius:10px;padding:16px 20px;margin-bottom:24px;}
    table{width:100%;border-collapse:collapse;margin-bottom:24px;}
    th{background:#1B3BAA;color:white;padding:10px 12px;text-align:left;font-size:13px;}
    th:last-child,th:nth-child(2),th:nth-child(3){text-align:right;}
    th:nth-child(2){text-align:center;}
    .total-box{background:#1B3BAA;color:white;border-radius:10px;padding:16px 24px;display:flex;justify-content:space-between;align-items:center;}
    .footer{text-align:center;font-size:11px;color:#999;margin-top:32px;padding-top:16px;border-top:1px solid #eee;}
    .btn{background:#1B3BAA;color:white;border:none;padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer;margin-bottom:24px;}
  </style></head><body>
  <button class="btn no-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
  <div class="header">
    <div><div class="logo">L</div><div class="brand">LADELOS</div><div class="brand-sub">PASTELILLOS</div></div>
    <div style="text-align:right">
      <div class="num">${orden.numero || generarNumFactura()}</div>
      <div style="font-size:13px;color:#666;margin-top:4px;">Emitida: ${orden.fecha_registro || new Date().toISOString().split('T')[0]}</div>
      <div style="font-size:13px;color:#666;margin-top:2px;">Entrega: ${orden.fecha_entrega}</div>
    </div>
  </div>
  <div class="cliente-box">
    <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Facturado a</div>
    <div style="font-size:18px;font-weight:700;color:#1B3BAA;">${orden.cliente_nombre}</div>
    <div style="font-size:13px;color:#444;margin-top:4px;">📅 Entrega: ${orden.fecha_entrega} (${DOW_ES[dow] || dow})</div>
  </div>
  <table>
    <thead><tr><th>Sabor</th><th style="text-align:center">Docenas</th><th style="text-align:right">Precio/doc</th><th style="text-align:right">Subtotal</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total-box">
    <div>
      <div style="font-size:14px;opacity:0.8;">Total a pagar</div>
      <div style="font-size:12px;opacity:0.6;margin-top:2px;">${totalUnits} pastelillos · ${Object.keys(items).length} sabores</div>
    </div>
    <div style="font-size:30px;font-weight:700;">$${total}.00</div>
  </div>
  <div class="footer">
    <p>Ladelos Pastelillos · Bayamón, Puerto Rico</p>
    <p>Gracias por su preferencia. Precios por docena de 12 unidades.</p>
  </div>
  </body></html>`
  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
}

export default function Mayoristas() {
  const { profile } = useAuth()
  const [ordenes, setOrdenes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [cliente, setCliente] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [items, setItems] = useState({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const sabores = Object.keys(PRECIOS_REVENTA).sort()

  useEffect(() => { loadOrdenes() }, [])

  async function loadOrdenes() {
    const { data } = await supabase
      .from('ordenes_mayoristas')
      .select('*')
      .order('fecha_entrega', { ascending: true })
    setOrdenes(data || [])
    setLoading(false)
  }

  async function guardarOrden() {
    if (!cliente.trim() || !fechaEntrega) return
    const itemsFiltrados = Object.fromEntries(Object.entries(items).filter(([,v]) => v > 0))
    if (!Object.keys(itemsFiltrados).length) { alert('Agrega al menos un sabor.'); return }
    const total = Object.entries(itemsFiltrados).reduce((s,[sab,doc]) => s + (PRECIOS_REVENTA[sab]||0)*doc, 0)
    const numero = generarNumFactura()
    setSaving(true)
    const { error } = await supabase.from('ordenes_mayoristas').insert({
      cliente_nombre: cliente.trim(),
      fecha_entrega: fechaEntrega,
      fecha_registro: new Date().toISOString().split('T')[0],
      items: itemsFiltrados,
      estado: 'activa',
      total_calculado: total,
      numero,
    })
    if (!error) {
      setShowForm(false); setCliente(''); setFechaEntrega(''); setItems({})
      await loadOrdenes()
    }
    setSaving(false)
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('ordenes_mayoristas').update({ estado }).eq('id', id)
    await loadOrdenes()
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Cargando...</div>

  const ordenesActivas = ordenes.filter(o => o.estado === 'activa')
  const ordenesHistorial = ordenes.filter(o => o.estado !== 'activa')

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📦 Mayoristas</div>
          <div className="page-subtitle">Órdenes de reventa · Afectan el plan de producción del día de entrega</div>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ Nueva orden</button>
      </div>

      {showForm && (
        <div className="card" style={{ border: '1px solid #c7d4f7', background: '#f8f9ff' }}>
          <h2 style={{ marginBottom: 16 }}>Nueva orden de mayorista</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6 }}>Cliente</label>
              <input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nombre del negocio" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6 }}>Fecha de entrega</label>
              <input type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>

          <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 8 }}>Docenas por sabor (solo llenar los que aplican):</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 80px', gap: '4px 12px', maxHeight: 320, overflowY: 'auto', marginBottom: 16 }}>
            {sabores.map(sab => (
              <>
                <div key={sab+'_l'} style={{ fontSize: 13, display: 'flex', alignItems: 'center', padding: '3px 0' }}>
                  {sab} <span style={{ fontSize: 11, color: '#999', marginLeft: 4 }}>${PRECIOS_REVENTA[sab]}/doc</span>
                </div>
                <input
                  key={sab+'_i'} type="number" min="0" step="1" placeholder="0"
                  value={items[sab] || ''}
                  onChange={e => {
                    const v = parseInt(e.target.value)
                    setItems(prev => ({ ...prev, [sab]: isNaN(v) ? 0 : v }))
                  }}
                  style={{ width: '100%' }}
                />
              </>
            ))}
          </div>

          <div style={{ background: '#f0f4ff', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            Total estimado: <strong style={{ color: '#1B3BAA' }}>
              ${Object.entries(items).filter(([,v])=>v>0).reduce((s,[sab,doc]) => s + (PRECIOS_REVENTA[sab]||0)*doc, 0).toLocaleString()}
            </strong>
            {' '}· {Object.values(items).filter(v=>v>0).reduce((s,d)=>s+d*12,0)} pastelillos
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={guardarOrden} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar orden'}
            </button>
            <button className="btn-secondary" onClick={() => { setShowForm(false); setCliente(''); setFechaEntrega(''); setItems({}) }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <h2>Órdenes activas ({ordenesActivas.length})</h2>
      {ordenesActivas.length === 0 && (
        <div style={{ color: '#999', fontSize: 13, marginBottom: 24 }}>No hay órdenes activas.</div>
      )}
      {ordenesActivas.map(orden => {
        const total = Object.entries(orden.items||{}).reduce((s,[sab,doc]) => s+(PRECIOS_REVENTA[sab]||0)*doc, 0)
        const totalUnits = Object.values(orden.items||{}).reduce((s,d) => s+d*12, 0)
        return (
          <div key={orden.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{orden.cliente_nombre}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                  📅 Entrega: {orden.fecha_entrega} ({DOW_ES[dateKeyToDow(orden.fecha_entrega)]}) · {totalUnits} past. · ${total.toLocaleString()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => abrirFactura(orden)}>📄 Factura</button>
                <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => { if (confirm('¿Marcar como entregada?')) cambiarEstado(orden.id, 'entregada') }}>✓ Entregada</button>
                <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 12px', color: '#dc2626' }} onClick={() => { if (confirm('¿Cancelar esta orden?')) cambiarEstado(orden.id, 'cancelada') }}>Cancelar</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(orden.items||{}).map(([sab, doc]) => (
                <span key={sab} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: '#f0f4ff', color: '#1B3BAA' }}>
                  {sab}: {doc} doc
                </span>
              ))}
            </div>
          </div>
        )
      })}

      {ordenesHistorial.length > 0 && (
        <>
          <h2 style={{ marginTop: 8 }}>Historial</h2>
          {ordenesHistorial.map(orden => {
            const total = Object.entries(orden.items||{}).reduce((s,[sab,doc]) => s+(PRECIOS_REVENTA[sab]||0)*doc, 0)
            return (
              <div key={orden.id} className="card" style={{ opacity: 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{orden.cliente_nombre}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{orden.fecha_entrega} · ${total} · <em>{orden.estado}</em></div>
                  </div>
                  <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => abrirFactura(orden)}>📄 Factura</button>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
