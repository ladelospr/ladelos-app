import { useState } from 'react'
import { useProduccion } from '../hooks/useProduccion'
import { DOW_ES } from '../lib/constants'

const monthMap = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11}
const DOW_ORDER_JS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]

function parseDateRange(line) {
  const m = line.match(/([A-Za-z]+) (\d+), (\d+) 12:00 AM\s*-\s*([A-Za-z]+) (\d+), (\d+) 11:59 PM/)
  if (!m) return null
  const [_, mo1, d1, y1, mo2, d2, y2] = m
  if (mo1 !== mo2 || d1 !== d2 || y1 !== y2) return null
  const mi = monthMap[mo1]
  if (mi === undefined) return null
  const dt = new Date(parseInt(y1), mi, parseInt(d1))
  const dow = DOW_ORDER_JS[dt.getDay()]
  const dateKey = y1 + '-' + String(mi+1).padStart(2,'0') + '-' + String(d1).padStart(2,'0')
  return { dateKey, dow }
}

function detectDelim(lines) {
  for (const l of lines) {
    if (l.indexOf('Category Name') === 0) {
      return (l.match(/\t/g)||[]).length > (l.match(/,/g)||[]).length ? '\t' : ','
    }
  }
  return ','
}

function parseLine(line, delim) {
  if (delim === '\t') return line.split('\t')
  const r = []; let cur = '', iq = false
  for (const c of line) {
    if (c === '"') { iq = !iq }
    else if (c === ',' && !iq) { r.push(cur); cur = '' }
    else { cur += c }
  }
  r.push(cur); return r
}

function clean(s) { return s ? s.replace(/"/g,'').trim() : '' }

function parseReport(text) {
  const lines = text.split('\n').map(l => l.replace(/\r$/,''))
  let di = null, hi = -1
  for (let i = 0; i < lines.length; i++) {
    if (!di) { const d = parseDateRange(lines[i]); if (d) di = d }
    if (lines[i].indexOf('Category Name') === 0) { hi = i; break }
  }
  if (!di || hi === -1) return null
  const delim = detectDelim(lines)
  const products = {}; let total = null, cat = ''
  for (let i = hi+1; i < lines.length; i++) {
    const line = lines[i]; if (!line || !line.trim()) continue
    const row = parseLine(line, delim).map(clean)
    if (row.every(c => c === '')) continue
    if (row[0] === 'TOTAL') { const v = parseInt(row[4]); if (!isNaN(v)) total = v; continue }
    if (row[0] && row[0].startsWith('Total (')) continue
    if (row.slice(1).every(c => c === '')) { if (row[0].trim()) cat = row[0].trim(); continue }
    if (row[0] && row[0].trim()) cat = row[0].trim()
    const name = row[1] ? row[1].trim() : ''; if (!name) continue
    const sold = parseInt(row[4]) || 0
    const key = cat + '|' + name; products[key] = (products[key] || 0) + sold
  }
  return { dateKey: di.dateKey, dow: di.dow, totalSold: total, products }
}

function splitReports(text) {
  const lines = text.split('\n'); const chunks = []; let cur = []
  for (const l of lines) {
    if (l.trim() === 'Items Report' && cur.length > 0) { chunks.push(cur.join('\n')); cur = [l] }
    else { cur.push(l) }
  }
  if (cur.length > 0) chunks.push(cur.join('\n'))
  return chunks
}

export default function Ventas() {
  const { diasVentas, guardarDiaVentas } = useProduccion()
  const [texto, setTexto] = useState('')
  const [msg, setMsg] = useState(null)
  const [procesando, setProcesando] = useState(false)

  async function procesar() {
    if (!texto.trim()) return
    setProcesando(true); setMsg(null)
    const chunks = splitReports(texto)
    let added = 0, updated = 0, skipped = 0
    for (const chunk of chunks) {
      const p = parseReport(chunk)
      if (!p) { skipped++; continue }
      const exists = diasVentas.find(d => d.fecha === p.dateKey)
      const { error } = await guardarDiaVentas(p.dateKey, p.dow, p.totalSold, p.products)
      if (!error) { if (exists) updated++; else added++ }
    }
    setTexto('')
    setMsg({ type: 'success', text: `${added} día(s) nuevo(s)${updated ? `, ${updated} actualizado(s)` : ''}${skipped ? `, ${skipped} no reconocido(s)` : ''}.` })
    setProcesando(false)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📊 Cargar Ventas</div>
          <div className="page-subtitle">Pega el reporte de Clover (CSV o copiado desde Excel)</div>
        </div>
      </div>

      <div className="card">
        <textarea
          rows={8} value={texto} onChange={e => setTexto(e.target.value)}
          placeholder={'Items Report\nMay 16, 2026 12:00 AM - May 16, 2026 11:59 PM\n...pega aquí el reporte...'}
          style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center' }}>
          <button className="btn-primary" onClick={procesar} disabled={procesando || !texto.trim()}>
            {procesando ? 'Procesando...' : 'Procesar y guardar'}
          </button>
          {msg && (
            <span style={{ fontSize: 13, color: msg.type === 'success' ? '#166534' : '#dc2626' }}>
              {msg.text}
            </span>
          )}
        </div>
      </div>

      <h2 style={{ marginTop: 8 }}>Días cargados ({diasVentas.length})</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {diasVentas.slice().reverse().map(d => (
          <span key={d.fecha} style={{
            fontSize: 12, padding: '4px 10px', borderRadius: 20,
            background: '#f0f4ff', color: '#1B3BAA', border: '1px solid #c7d4f7',
          }}>
            {d.fecha} · {DOW_ES[d.dia_semana]?.slice(0,3)} · {d.total_vendido}
          </span>
        ))}
      </div>
    </div>
  )
}
