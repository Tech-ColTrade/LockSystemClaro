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

/**
 * Diagnóstico de la API de WhaleTV: herramienta de soporte, no del producto.
 * La lista real vive en `settings.DIAGNOSTICO_API_EMAILS` del backend, que es
 * quien autoriza de verdad; aquí solo se decide si se muestra la pestaña.
 */
const CORREOS_DIAGNOSTICO = ['palaciosjulian286@gmail.com']

export function puedeDiagnosticarApi(user: User | null): boolean {
  const correo = user?.email?.trim().toLowerCase()
  return !!correo && CORREOS_DIAGNOSTICO.includes(correo)
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  operador: 'Operador',
  consulta: 'Consulta',
}
