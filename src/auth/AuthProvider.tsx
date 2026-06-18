import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'
import { AuthContext, type AuthState } from './context'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [inactiveNotice, setInactiveNotice] = useState(false)
  const currentUserId = useRef<string | null>(null)

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Falha ao carregar perfil:', error.message)
      setProfile(null)
      return
    }
    const prof = data as Profile | null
    if (prof && prof.ativo === false) {
      // Conta desativada: derruba a sessão e sinaliza o aviso pra LoginPage.
      // Zera session já aqui (não só via onAuthStateChange) pra ProtectedRoute
      // não piscar a área logada antes do callback do signOut chegar.
      setInactiveNotice(true)
      setProfile(null)
      setSession(null)
      currentUserId.current = null
      await supabase.auth.signOut()
      return
    }
    setProfile(prof)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (currentUserId.current) await loadProfile(currentUserId.current)
  }, [loadProfile])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      currentUserId.current = data.session?.user.id ?? null
      if (data.session) await loadProfile(data.session.user.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!active) return
        setSession(newSession)
        const uid = newSession?.user.id ?? null
        currentUserId.current = uid
        if (uid) await loadProfile(uid)
        else setProfile(null)
      },
    )

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const clearInactiveNotice = useCallback(() => setInactiveNotice(false), [])

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      loading,
      isAdmin: profile?.role === 'admin',
      signOut,
      refreshProfile,
      inactiveNotice,
      clearInactiveNotice,
    }),
    [session, profile, loading, signOut, refreshProfile, inactiveNotice, clearInactiveNotice],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
