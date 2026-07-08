// Configuración central de la app. Único punto que lee `import.meta.env`,
// para no dispersar accesos a variables de entorno por todo el código.

export const config = {
  /**
   * URL base de la API.
   * - En desarrollo queda vacía y se usa el proxy de Vite (`/api` -> Django).
   * - En producción se define `VITE_API_URL` con la URL completa del backend.
   */
  apiBaseUrl: import.meta.env.VITE_API_URL ?? '',

  /** Claves de almacenamiento en el navegador. */
  storage: {
    // Solo persiste el refresh token; el access token vive en memoria.
    refreshToken: 'ls.auth.refresh',
  },

  /** Rutas de la API de autenticación (centralizadas para no repetir strings). */
  endpoints: {
    login: '/api/auth/token/',
    refresh: '/api/auth/token/refresh/',
    logout: '/api/auth/logout/',
    changePassword: '/api/auth/password/',
    me: '/api/me/',
  },
} as const
