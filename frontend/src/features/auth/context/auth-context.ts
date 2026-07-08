// Definición del contexto de autenticación y su hook de acceso.
// Se separa del Provider (auth-provider.tsx) para respetar la regla de
// Fast Refresh de exportar hooks/valores aparte de los componentes.

import { createContext, useContext } from 'react'
import type { AuthStatus, User } from '@/features/auth/types'

export interface AuthContextValue {
  user: User | null
  status: AuthStatus
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  /** Vuelve a leer el perfil desde la API (p. ej. tras editarlo). */
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  }
  return ctx
}
