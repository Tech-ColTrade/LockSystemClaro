// Guarda de rutas por rol: si el usuario no cumple el predicado, lo redirige
// al inicio. Se anida dentro de <ProtectedRoute> (que ya garantiza sesión).

import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/context/auth-context'
import type { User } from '@/features/auth/types'

interface RequireRoleProps {
  /** Predicado que decide si el usuario puede ver las rutas hijas. */
  allow: (user: User | null) => boolean
}

export function RequireRole({ allow }: RequireRoleProps) {
  const { user } = useAuth()

  if (!allow(user)) return <Navigate to="/" replace />

  return <Outlet />
}
