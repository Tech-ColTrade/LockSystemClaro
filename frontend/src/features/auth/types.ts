// Tipos del dominio de autenticación (alineados con la API de Django `users`).

export type Role = 'admin' | 'operador' | 'consulta'

/** Sesión abierta de un usuario. Solo una a la vez (sesión única). */
export interface SesionInfo {
  /** Texto legible: 'Chrome en Windows'. */
  dispositivo: string
  iniciada: string
  ultima_actividad: string
  ip: string | null
}

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
  /** Sesión abierta ahora mismo, o null si no tiene ninguna. */
  sesion: SesionInfo | null
}

export interface AuthTokens {
  access: string
  refresh: string
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'
