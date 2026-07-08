// Tipos del dominio de autenticación (alineados con la API de Django `users`).

export type Role = 'admin' | 'operador' | 'consulta'

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  role: Role
  role_display: string
  is_active: boolean
  date_joined: string
  /** Preferencia de color de acento (clave del preset, p. ej. 'neutro'). */
  accent: string
}

export interface AuthTokens {
  access: string
  refresh: string
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'
