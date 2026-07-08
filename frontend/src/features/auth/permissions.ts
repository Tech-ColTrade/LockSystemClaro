// Política de permisos del frontend (espejo de `users/permissions.py` en el
// backend). Aquí solo se decide qué se MUESTRA; la autorización real la impone
// el backend. Mantener ambas listas alineadas.

import type { Role, User } from '@/features/auth/types'

/** Administrador: gestión de usuarios + todos los módulos. */
export function isAdmin(user: User | null): boolean {
  return user?.role === 'admin'
}

/** Operador o Administrador: puede realizar gestiones de escritura. */
export function canOperate(user: User | null): boolean {
  return user?.role === 'admin' || user?.role === 'operador'
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  operador: 'Operador',
  consulta: 'Consulta',
}
