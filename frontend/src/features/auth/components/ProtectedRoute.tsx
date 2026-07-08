// Guarda de rutas: exige sesión autenticada para renderizar las rutas hijas.

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/context/auth-context'
import { Spinner } from '@/shared/components/Spinner'

export function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <Spinner />

  if (status === 'unauthenticated') {
    // Guarda el destino para volver a él tras iniciar sesión.
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
