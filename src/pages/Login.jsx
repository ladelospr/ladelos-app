import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data, error } = await signIn(email, password)
    if (error) {
      setError('Error: ' + error.message + ' | Status: ' + error.status)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f5f7fa',
    }}>
      <div style={{
        background: 'white', borderRadius: 16, padding: '48px 40px',
        width: '100%', maxWidth: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 56, fontWeight: 900, color: '#5b8db8', fontStyle: 'italic', lineHeight: 1 }}>L</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1B3BAA', letterSpacing: 2, marginTop: 4 }}>LADELOS</div>
          <div style={{ fontSize: 11, color: '#5b8db8', letterSpacing: 3 }}>PASTELILLOS</div>
          <div style={{ fontSize: 13, color: '#666', marginTop: 12 }}>Sistema Operacional</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: '#444', display: 'block', marginBottom: 6 }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required placeholder="tu@email.com"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 14px',
                borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 14,
              }}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13, color: '#444', display: 'block', marginBottom: 6 }}>Contraseña</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required placeholder="••••••••"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 14px',
                borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 14,
              }}
            />
          </div>
          {error && (
            <div style={{ background: '#fef2f2', color: '#dc2626', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
              {error}
            </div>
          )}
          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: '12px', background: '#1B3BAA', color: 'white',
              border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
