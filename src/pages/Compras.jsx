import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { ING_LABELS, PROTEINAS } from '../lib/constants'

const CATEGORIAS = [
  { key: 'materia_prima',   label: 'Materia prima',         emoji: '🥩', afectaInventario: true },
  { key: 'utilidades',      label: 'Utilidades',            emoji: '💡' },
  { key: 'servicios',       label: 'Servicios',             emoji: '📱' },
  { key: 'renta',           label: 'Renta / Arrendamiento', emoji: '🏠' },
  { key: 'equipo',          label: 'Equipo y mantenimiento',emoji: '🔧' },
  { key: 'nomina',          label: 'Nómina / Empleados',    emoji: '👥' },
  { key: 'marketing',       label: 'Marketing',             emoji: '📣' },
  { key: 'otros',           label: 'Otros',                 emoji: '📎' },
]

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function Compras() {
  const [tab, setTab] = useState('registrar')
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [modo, setModo] = useState('foto') // 'foto' | 'manual'
  const [imagen, setImagen] = useState(null)
  const [imagenPreview, setImagenPreview] = useState(null)
  const [extrayendo, setExtrayendo] = useState(false)
  const [extractedData, setExtractedData] = useState(null)

  // Manual / confirm form
  const [proveedor, setProveedor] = useState('')
  const [numeroFactura, setNumeroFactura] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [categoria, setCategoria] = useState('materia_prima')
  const [items, setItems] = useState([{ descripcion: '', cantidad: '', unidad: 'lb', precio_unitario: '', total: '' }])
  const [totalFactura, setTotalFactura] = useState('')
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  // Reportes
  const [anioReporte, setAnioReporte] = useState(new Date().getFullYear())
  const [mesReporte, setMesReporte] = useState(null)

  const fileRef = useRef(null)

  useEffect(() => { loadGastos() }, [])

  async function loadGastos() {
    const { data } = await supabase
      .from('gastos')
      .select('*')
      .order('fecha', { ascending: false })
    setGastos(data || [])
    setLoading(false)
  }

  function handleImagenChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setImagen(file)
    setImagenPreview(URL.createObjectURL(file))
    setExtractedData(null)
  }

  async function extraerConClaude() {
    if (!imagen) return
    setExtrayendo(true)
    setMsg(null)
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1]
        const mediaType = imagen.type || 'image/jpeg'

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 1000,
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: mediaType, data: base64 }
                },
                {
                  type: 'text',
                  text: `Analiza esta factura de proveedor y extrae la información. Responde SOLO con un objeto JSON válido, sin texto adicional, sin markdown, sin backticks. El formato debe ser exactamente:
{
  "proveedor": "nombre del proveedor",
  "numero_factura": "número de factura o null",
  "fecha": "YYYY-MM-DD o null",
  "total": número total en dólares o null,
  "items": [
    {
      "descripcion": "descripción del item",
      "cantidad": número o null,
      "unidad": "lb/kg/caja/unidad/etc",
      "precio_unitario": número o null,
      "total": número o null
    }
  ]
}

Si no puedes leer algún campo con certeza, ponlo como null. Para la fecha usa formato YYYY-MM-DD. Para números usa solo dígitos y punto decimal, sin símbolos de moneda.`
                }
              ]
            }]
          })
        })

        const data = await response.json()
        const text = data.content?.[0]?.text || ''

        try {
          const parsed = JSON.parse(text.trim())
          setExtractedData(parsed)
          // Pre-llenar el formulario
          if (parsed.proveedor) setProveedor(parsed.proveedor)
          if (parsed.numero_factura) setNumeroFactura(parsed.numero_factura)
          if (parsed.fecha) setFecha(parsed.fecha)
          if (parsed.total) setTotalFactura(String(parsed.total))
          if (parsed.items?.length) {
            setItems(parsed.items.map(i => ({
              descripcion: i.descripcion || '',
              cantidad: i.cantidad ? String(i.cantidad) : '',
              unidad: i.unidad || 'lb',
              precio_unitario: i.precio_unitario ? String(i.precio_unitario) : '',
              total: i.total ? String(i.total) : '',
            })))
          }
          setModo('confirmar')
        } catch {
          setMsg({ type: 'error', text: 'No se pudo leer la factura automáticamente. Puedes entrarla manualmente.' })
          setModo('manual')
        }
        setExtrayendo(false)
      }
      reader.readAsDataURL(imagen)
    } catch {
      setMsg({ type: 'error', text: 'Error al procesar la imagen. Intenta de nuevo o entra los datos manualmente.' })
      setExtrayendo(false)
    }
  }

  function addItem() {
    setItems(prev => [...prev, { descripcion: '', cantidad: '', unidad: 'lb', precio_unitario: '', total: '' }])
  }

  function updateItem(idx, field, value) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function removeItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function calcTotal() {
    return items.reduce((s, item) => {
      const t = parseFloat(item.total) || 0
      return s + t
    }, 0).toFixed(2)
  }

  async function guardarGasto() {
    if (!proveedor.trim() || !fecha || !categoria) {
      setMsg({ type: 'error', text: 'Completa al menos proveedor, fecha y categoría.' })
      return
    }
    setSaving(true)

    const itemsFiltrados = items.filter(i => i.descripcion.trim())
    const totalFinal = parseFloat(totalFactura) || parseFloat(calcTotal()) || 0

    // Si es materia prima, agregar las cantidades al inventario
    let inventarioItems = null
    if (categoria === 'materia_prima') {
      inventarioItems = itemsFiltrados.map(item => ({
        descripcion: item.descripcion,
        cantidad: parseFloat(item.cantidad) || 0,
        unidad: item.unidad,
        precio_unitario: parseFloat(item.precio_unitario) || 0,
        total: parseFloat(item.total) || 0,
      }))

      // Intentar mapear a proteínas conocidas y agregar tandas
      for (const item of inventarioItems) {
        const prot = detectarProteina(item.descripcion)
        if (prot && item.cantidad > 0) {
          const lbConvertidas = convertirALibras(item.cantidad, item.unidad)
          if (lbConvertidas > 0) {
            await supabase.from('tandas_cocina').insert({
              fecha: fecha,
              proteina: prot,
              libras: lbConvertidas,
              tipo: 'compra',
              notas: `Compra: ${item.descripcion} — Factura ${numeroFactura || 'S/N'} (${proveedor})`,
            })
          }
        }
      }
    }

    const { error } = await supabase.from('gastos').insert({
      proveedor: proveedor.trim(),
      numero_factura: numeroFactura.trim() || null,
      fecha,
      categoria,
      items: itemsFiltrados,
      total: totalFinal,
      notas: notas.trim() || null,
      tiene_imagen: !!imagen,
      anio: new Date(fecha + 'T12:00:00').getFullYear(),
      mes: new Date(fecha + 'T12:00:00').getMonth() + 1,
    })

    if (!error) {
      setMsg({ type: 'success', text: '✓ Gasto registrado correctamente.' + (categoria === 'materia_prima' ? ' El inventario fue actualizado.' : '') })
      resetForm()
      await loadGastos()
    } else {
      setMsg({ type: 'error', text: 'Error guardando. Intenta de nuevo.' })
    }
    setSaving(false)
    setTimeout(() => setMsg(null), 4000)
  }

  function detectarProteina(descripcion) {
    const d = descripcion.toLowerCase()
    if (d.includes('carne molida') || d.includes('ground beef') || d.includes('molida')) return 'carne_molida'
    if (d.includes('cadera') || d.includes('thigh') || d.includes('muslo')) return 'cadera'
    if (d.includes('pechuga') || d.includes('breast') || d.includes('chicken breast')) return 'pechuga'
    if (d.includes('churrasco') || d.includes('skirt') || d.includes('flank')) return 'churrasco'
    if (d.includes('camaron') || d.includes('camarón') || d.includes('shrimp')) return 'camaron'
    if (d.includes('crab') || d.includes('cangrejo')) return 'crab'
    if (d.includes('pastrami')) return 'pastrami'
    if (d.includes('philly') || d.includes('ribeye') || d.includes('sirloin')) return 'philly'
    if (d.includes('bistec') || d.includes('steak') || d.includes('bistek')) return 'bistec'
    return null
  }

  function convertirALibras(cantidad, unidad) {
    const u = unidad.toLowerCase()
    if (u === 'lb' || u === 'lbs' || u === 'libra' || u === 'libras') return cantidad
    if (u === 'kg' || u === 'kilo' || u === 'kilos') return cantidad * 2.205
    if (u === 'oz' || u === 'onza' || u === 'onzas') return cantidad / 16
    return cantidad // asume lb por defecto
  }

  function resetForm() {
    setModo('foto')
    setImagen(null)
    setImagenPreview(null)
    setExtractedData(null)
    setProveedor('')
    setNumeroFactura('')
    setFecha(new Date().toISOString().split('T')[0])
    setCategoria('materia_prima')
    setItems([{ descripcion: '', cantidad: '', unidad: 'lb', precio_unitario: '', total: '' }])
    setTotalFactura('')
    setNotas('')
    if (fileRef.current) fileRef.current.value = ''
  }

  // Datos para reportes
  const gastosFiltrados = gastos.filter(g => {
    if (g.anio !== anioReporte) return false
    if (mesReporte && g.mes !== mesReporte) return false
    return true
  })

  const totalAnio = gastosFiltrados.reduce((s, g) => s + (g.total || 0), 0)

  const porCategoria = CATEGORIAS.map(cat => ({
    ...cat,
    total: gastosFiltrados.filter(g => g.categoria === cat.key).reduce((s, g) => s + (g.total || 0), 0),
    count: gastosFiltrados.filter(g => g.categoria === cat.key).length,
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

  const porMes = Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    label: MESES[i],
    total: gastos.filter(g => g.anio === anioReporte && g.mes === i + 1).reduce((s, g) => s + (g.total || 0), 0),
  })).filter(m => m.total > 0)

  const catColor = {
    materia_prima: '#1B3BAA', utilidades: '#d97706', servicios: '#7c3aed',
    renta: '#059669', equipo: '#dc2626', nomina: '#0891b2',
    marketing: '#db2777', otros: '#666',
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid #f0f0f0' }}>
        {[
          { key: 'registrar', label: '+ Registrar gasto' },
          { key: 'historial', label: '📋 Historial' },
          { key: 'reportes',  label: '📊 Reportes' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              border: 'none', borderRadius: 0, padding: '10px 18px',
              background: 'transparent', fontSize: 13,
              fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? '#1B3BAA' : '#666',
              borderBottom: tab === t.key ? '2px solid #1B3BAA' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* ===== REGISTRAR ===== */}
      {tab === 'registrar' && (
        <div>
          <div className="page-header">
            <div>
              <div className="page-title">💰 Registrar Gasto</div>
              <div className="page-subtitle">Sube una foto de la factura o entra los datos manualmente</div>
            </div>
          </div>

          {msg && (
            <div className={msg.type === 'success' ? 'alert-success' : 'alert-danger'}>{msg.text}</div>
          )}

          {/* Selector de modo */}
          {modo === 'foto' && (
            <div className="card">
              <h2>Opción 1 — Subir foto de factura</h2>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
                Claude lee la factura automáticamente y llena los campos por ti. Si algo no se lee bien, puedes corregirlo.
              </p>
              <input
                ref={fileRef} type="file" accept="image/*" capture="environment"
                onChange={handleImagenChange}
                style={{ marginBottom: 12 }}
              />
              {imagenPreview && (
                <div style={{ marginBottom: 16 }}>
                  <img src={imagenPreview} alt="Factura" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8, objectFit: 'contain' }} />
                </div>
              )}
              {imagen && (
                <button className="btn-primary" onClick={extraerConClaude} disabled={extrayendo}>
                  {extrayendo ? '⏳ Leyendo factura...' : '🔍 Leer factura con IA'}
                </button>
              )}

              <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, height: 1, background: '#e8e8e8' }} />
                <span style={{ fontSize: 12, color: '#999' }}>o</span>
                <div style={{ flex: 1, height: 1, background: '#e8e8e8' }} />
              </div>

              <button className="btn-secondary" onClick={() => setModo('manual')}>
                ✍️ Entrar datos manualmente
              </button>
            </div>
          )}

          {/* Formulario de confirmación/manual */}
          {(modo === 'confirmar' || modo === 'manual') && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ margin: 0 }}>
                  {modo === 'confirmar' ? '✓ Datos extraídos — confirma o corrige' : '✍️ Entrada manual'}
                </h2>
                <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => setModo('foto')}>
                  ← Volver
                </button>
              </div>

              {imagenPreview && (
                <img src={imagenPreview} alt="Factura" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'contain', marginBottom: 16 }} />
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Proveedor *</label>
                  <input value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Nombre del proveedor" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Número de factura</label>
                  <input value={numeroFactura} onChange={e => setNumeroFactura(e.target.value)} placeholder="Opcional" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Fecha *</label>
                  <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ width: '100%' }} />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Categoría *</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {CATEGORIAS.map(cat => (
                    <button
                      key={cat.key}
                      onClick={() => setCategoria(cat.key)}
                      style={{
                        fontSize: 12, padding: '6px 12px', borderRadius: 20,
                        border: `1px solid ${categoria === cat.key ? catColor[cat.key] : '#e0e0e0'}`,
                        background: categoria === cat.key ? catColor[cat.key] : 'white',
                        color: categoria === cat.key ? 'white' : '#444',
                        fontWeight: categoria === cat.key ? 600 : 400,
                      }}
                    >
                      {cat.emoji} {cat.label}
                    </button>
                  ))}
                </div>
                {categoria === 'materia_prima' && (
                  <div style={{ fontSize: 12, color: '#1B3BAA', marginTop: 6, background: '#f0f4ff', padding: '6px 10px', borderRadius: 6 }}>
                    💡 Los items de materia prima reconocidos se sumarán automáticamente al inventario de proteínas.
                  </div>
                )}
              </div>

              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 8 }}>Items de la factura</label>
              <div style={{ marginBottom: 12 }}>
                {items.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) 70px 70px 80px 80px 32px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                    <input
                      placeholder="Descripción del item"
                      value={item.descripcion}
                      onChange={e => updateItem(idx, 'descripcion', e.target.value)}
                    />
                    <input
                      type="number" placeholder="Cant." min="0" step="0.01"
                      value={item.cantidad}
                      onChange={e => updateItem(idx, 'cantidad', e.target.value)}
                    />
                    <select value={item.unidad} onChange={e => updateItem(idx, 'unidad', e.target.value)} style={{ fontSize: 12, padding: '7px 6px' }}>
                      <option value="lb">lb</option>
                      <option value="kg">kg</option>
                      <option value="oz">oz</option>
                      <option value="caja">caja</option>
                      <option value="unidad">unidad</option>
                      <option value="galón">galón</option>
                      <option value="mes">mes</option>
                    </select>
                    <input
                      type="number" placeholder="$/unit" min="0" step="0.01"
                      value={item.precio_unitario}
                      onChange={e => updateItem(idx, 'precio_unitario', e.target.value)}
                    />
                    <input
                      type="number" placeholder="Total" min="0" step="0.01"
                      value={item.total}
                      onChange={e => updateItem(idx, 'total', e.target.value)}
                    />
                    <button
                      onClick={() => removeItem(idx)}
                      style={{ background: 'transparent', border: 'none', color: '#dc2626', fontSize: 16, padding: '4px', cursor: 'pointer' }}
                    >×</button>
                  </div>
                ))}
                <button className="btn-secondary" style={{ fontSize: 12 }} onClick={addItem}>+ Agregar item</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Total de la factura ($)</label>
                  <input
                    type="number" placeholder={`Calculado: $${calcTotal()}`}
                    value={totalFactura}
                    onChange={e => setTotalFactura(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Notas opcionales</label>
                  <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Cualquier nota adicional" style={{ width: '100%' }} />
                </div>
              </div>

              <div style={{ background: '#f8f9ff', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#666' }}>Total a registrar:</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1B3BAA' }}>
                  ${parseFloat(totalFactura) || parseFloat(calcTotal()) || 0}
                </span>
              </div>

              <button className="btn-primary" onClick={guardarGasto} disabled={saving}>
                {saving ? 'Guardando...' : '💾 Guardar gasto'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== HISTORIAL ===== */}
      {tab === 'historial' && (
        <div>
          <div className="page-header">
            <div>
              <div className="page-title">📋 Historial de Gastos</div>
              <div className="page-subtitle">{gastos.length} registros totales</div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Cargando...</div>
          ) : !gastos.length ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>No hay gastos registrados aún.</div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-grid" style={{ gridTemplateColumns: 'auto minmax(0,1fr) auto auto auto' }}>
                <div className="table-header">Fecha</div>
                <div className="table-header">Proveedor</div>
                <div className="table-header">Categoría</div>
                <div className="table-header" style={{ textAlign: 'right' }}>Total</div>
                <div className="table-header">Factura</div>
                {gastos.map(g => {
                  const cat = CATEGORIAS.find(c => c.key === g.categoria)
                  return (
                    <>
                      <div key={g.id+'_f'} className="table-cell" style={{ color: '#666', whiteSpace: 'nowrap' }}>{g.fecha}</div>
                      <div key={g.id+'_p'} className="table-cell" style={{ fontWeight: 500 }}>{g.proveedor}</div>
                      <div key={g.id+'_c'} className="table-cell">
                        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 20, background: '#f5f5f5', color: catColor[g.categoria] || '#666' }}>
                          {cat?.emoji} {cat?.label || g.categoria}
                        </span>
                      </div>
                      <div key={g.id+'_t'} className="table-cell" style={{ textAlign: 'right', fontWeight: 700 }}>${(g.total || 0).toFixed(2)}</div>
                      <div key={g.id+'_n'} className="table-cell" style={{ fontSize: 12, color: '#999' }}>{g.numero_factura || '—'}</div>
                    </>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== REPORTES ===== */}
      {tab === 'reportes' && (
        <div>
          <div className="page-header">
            <div>
              <div className="page-title">📊 Reportes de Gastos</div>
              <div className="page-subtitle">Resumen por categoría, mes y año</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={anioReporte} onChange={e => setAnioReporte(parseInt(e.target.value))} style={{ padding: '8px 12px' }}>
              {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={mesReporte || ''} onChange={e => setMesReporte(e.target.value ? parseInt(e.target.value) : null)} style={{ padding: '8px 12px' }}>
              <option value="">Todos los meses</option>
              {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <div style={{ fontSize: 13, color: '#666', marginLeft: 8 }}>
              {gastosFiltrados.length} facturas registradas
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div className="stat-card" style={{ flex: 1, minWidth: 140 }}>
              <div className="stat-label">Total {mesReporte ? MESES[mesReporte-1] : anioReporte}</div>
              <div className="stat-value">${totalAnio.toFixed(2)}</div>
            </div>
            <div className="stat-card" style={{ flex: 1, minWidth: 140 }}>
              <div className="stat-label">Materia prima</div>
              <div className="stat-value" style={{ color: '#1B3BAA' }}>
                ${gastosFiltrados.filter(g => g.categoria === 'materia_prima').reduce((s,g) => s+(g.total||0), 0).toFixed(2)}
              </div>
            </div>
            <div className="stat-card" style={{ flex: 1, minWidth: 140 }}>
              <div className="stat-label">Gastos operacionales</div>
              <div className="stat-value" style={{ color: '#d97706' }}>
                ${gastosFiltrados.filter(g => g.categoria !== 'materia_prima').reduce((s,g) => s+(g.total||0), 0).toFixed(2)}
              </div>
            </div>
          </div>

          <h2>Por categoría</h2>
          {porCategoria.length ? (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
              <div className="table-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto auto' }}>
                <div className="table-header">Categoría</div>
                <div className="table-header" style={{ textAlign: 'right' }}>Total</div>
                <div className="table-header" style={{ textAlign: 'right' }}>%</div>
                <div className="table-header" style={{ textAlign: 'right' }}>Facturas</div>
                {porCategoria.map(cat => (
                  <>
                    <div key={cat.key+'_n'} className="table-cell">
                      <span style={{ color: catColor[cat.key] }}>{cat.emoji}</span> {cat.label}
                    </div>
                    <div key={cat.key+'_t'} className="table-cell" style={{ textAlign: 'right', fontWeight: 700 }}>${cat.total.toFixed(2)}</div>
                    <div key={cat.key+'_p'} className="table-cell" style={{ textAlign: 'right', color: '#666' }}>
                      {totalAnio > 0 ? Math.round(cat.total / totalAnio * 100) : 0}%
                    </div>
                    <div key={cat.key+'_c'} className="table-cell" style={{ textAlign: 'right', color: '#999' }}>{cat.count}</div>
                  </>
                ))}
              </div>
            </div>
          ) : <div style={{ color: '#999', fontSize: 13, marginBottom: 20 }}>Sin datos para este período.</div>}

          {!mesReporte && (
            <>
              <h2>Por mes ({anioReporte})</h2>
              {porMes.length ? (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="table-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto' }}>
                    <div className="table-header">Mes</div>
                    <div className="table-header" style={{ textAlign: 'right' }}>Total</div>
                    <div className="table-header" style={{ textAlign: 'right' }}>Facturas</div>
                    {porMes.map(m => (
                      <>
                        <div key={m.mes+'_l'} className="table-cell">
                          <button
                            onClick={() => setMesReporte(m.mes)}
                            style={{ background: 'none', border: 'none', color: '#1B3BAA', cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 500 }}
                          >{m.label}</button>
                        </div>
                        <div key={m.mes+'_t'} className="table-cell" style={{ textAlign: 'right', fontWeight: 700 }}>${m.total.toFixed(2)}</div>
                        <div key={m.mes+'_c'} className="table-cell" style={{ textAlign: 'right', color: '#999' }}>
                          {gastos.filter(g => g.anio === anioReporte && g.mes === m.mes).length}
                        </div>
                      </>
                    ))}
                  </div>
                </div>
              ) : <div style={{ color: '#999', fontSize: 13 }}>Sin datos para {anioReporte}.</div>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
