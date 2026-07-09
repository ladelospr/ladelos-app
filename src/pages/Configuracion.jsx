import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ROLE_LABELS } from '../lib/constants'

export default function Configuracion() {
  const [usuarios, setUsuarios] = useState([])
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState('cocina')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => { loadUsuarios() }, [])

  async function loadUsuarios() {
    const { data } = await supabase.from('profiles').select('*').order('nombre')
    setUsuarios(data || [])
  }

  async function crearUsuario() {
    if (!email || !password || !nombre) return
    setSaving(true)
    // Crear usuario en Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (!error && data.user) {
      // Actualizar perfil con nombre y rol
      await supabase.from('profiles').update({ nombre, rol }).eq('id', data.user.id)
      setEmail(''); setPassword(''); setNombre(''); setRol('cocina')
      setMsg('✓ Usuario creado exitosamente.')
      await loadUsuarios()
    } else {
      setMsg('Error: ' + (error?.message || 'No se pudo crear el usuario.'))
    }
    setSaving(false)
    setTimeout(() => setMsg(null), 4000)
  }

  async function cambiarRol(id, nuevoRol) {
    await supabase.from('profiles').update({ rol: nuevoRol }).eq('id', id)
    await loadUsuarios()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">⚙️ Configuración</div>
          <div className="page-subtitle">Gestión de usuarios y accesos</div>
        </div>
      </div>

      <div className="card">
        <h2>Crear nuevo usuario</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Nombre</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre completo" style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@ejemplo.com" style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Contraseña inicial</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Rol</label>
            <select value={rol} onChange={e => setRol(e.target.value)} style={{ width: '100%' }}>
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn-primary" onClick={crearUsuario} disabled={saving}>
            {saving ? 'Creando...' : '+ Crear usuario'}
          </button>
          {msg && <span style={{ fontSize: 13, color: msg.startsWith('✓') ? '#166534' : '#dc2626' }}>{msg}</span>}
        </div>
      </div>

      <h2>Usuarios activos</h2>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) auto' }}>
          <div className="table-header">Nombre</div>
          <div className="table-header">Email / ID</div>
          <div className="table-header">Rol</div>
          {usuarios.map(u => (
            <>
              <div key={u.id+'_n'} className="table-cell" style={{ fontWeight: 500 }}>{u.nombre}</div>
              <div key={u.id+'_e'} className="table-cell" style={{ color: '#666', fontSize: 12 }}>{u.id.slice(0,8)}...</div>
              <div key={u.id+'_r'} className="table-cell">
                <select
                  value={u.rol}
                  onChange={e => cambiarRol(u.id, e.target.value)}
                  style={{ fontSize: 12, padding: '4px 8px' }}
                >
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </>
          ))}
        </div>
      </div>
    </div>
  )
}
