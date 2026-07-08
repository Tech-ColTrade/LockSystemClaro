// Almacén de tokens JWT.
//
// Decisión de seguridad:
// - El ACCESS token vive SOLO en memoria (variable de módulo). No se persiste,
//   así un XSS no puede leerlo desde localStorage tras recargar, y su vida es
//   corta (15 min en el backend).
// - El REFRESH token se persiste en localStorage para mantener la sesión entre
//   recargas. Es el mínimo imprescindible que se guarda.
//
// Nota: la opción más segura sería guardar el refresh en una cookie httpOnly
// emitida por el backend. Eso requiere cambios en el backend (hoy usa Bearer en
// el header Authorization con CORS sin credenciales), por lo que queda como
// mejora futura documentada.

import { config } from '@/lib/config'

let accessToken: string | null = null

export const tokenStore = {
  getAccess: (): string | null => accessToken,

  setAccess: (token: string | null): void => {
    accessToken = token
  },

  getRefresh: (): string | null =>
    localStorage.getItem(config.storage.refreshToken),

  setRefresh: (token: string | null): void => {
    if (token) localStorage.setItem(config.storage.refreshToken, token)
    else localStorage.removeItem(config.storage.refreshToken)
  },

  /** Borra ambos tokens (logout / sesión inválida). */
  clear: (): void => {
    accessToken = null
    localStorage.removeItem(config.storage.refreshToken)
  },
}
