import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { MODULO_ACCESO } from '../lib/constants'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ 
      email: email.trim(), 
      password 
    })
    return { data, error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  function puedeAcceder(modulo) {
    if (!profile) return false
    return MODULO_ACCESO[modulo]?.includes(profile.rol) ?? false
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, puedeAcceder }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
