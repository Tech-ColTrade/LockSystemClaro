// Provider que mantiene el estado de sesión y lo expone vía contexto.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { authApi } from '@/features/auth/api/auth.api'
import { AuthContext, type AuthContextValue } from '@/features/auth/context/auth-context'
import type { AuthStatus, User } from '@/features/auth/types'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  // Al montar: intenta restaurar la sesión a partir del refresh token guardado.
  useEffect(() => {
    let active = true
    authApi.restore().then((restored) => {
      if (!active) return
      setUser(restored)
      setStatus(restored ? 'authenticated' : 'unauthenticated')
    })
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const loggedIn = await authApi.login(email, password)
    setUser(loggedIn)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(() => {
    authApi.logout()
    setUser(null)
    setStatus('unauthenticated')
  }, [])

  const refreshUser = useCallback(async () => {
    setUser(await authApi.me())
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, logout, refreshUser }),
    [user, status, login, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
