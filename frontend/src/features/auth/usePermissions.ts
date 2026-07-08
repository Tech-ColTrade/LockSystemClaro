// Hook de conveniencia: expone los flags de permiso del usuario autenticado.

import { useAuth } from '@/features/auth/context/auth-context'
import { canOperate, isAdmin } from '@/features/auth/permissions'

export function usePermissions() {
  const { user } = useAuth()
  return {
    user,
    isAdmin: isAdmin(user),
    canOperate: canOperate(user),
  }
}
