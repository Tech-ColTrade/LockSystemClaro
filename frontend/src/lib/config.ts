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
    // Marca de la última interacción del usuario, para el cierre por
    // inactividad. En localStorage porque se comparte entre pestañas.
    lastActivity: 'ls.auth.lastActivity',
    // Bandera de "la sesión se cerró sola": la pone el cierre por inactividad
    // y la consume el login para explicar por qué está ahí. En sessionStorage
    // para que no reaparezca en una pestaña nueva.
    sesionExpirada: 'ls.auth.expirada',
  },

  /** Rutas de la API de autenticación (centralizadas para no repetir strings). */
  endpoints: {
    login: '/api/auth/token/',
    refresh: '/api/auth/token/refresh/',
    logout: '/api/auth/logout/',
    changePassword: '/api/auth/password/',
    // Recuperación de contraseña olvidada (endpoints públicos).
    passwordReset: '/api/auth/password/reset/',
    passwordResetValidate: '/api/auth/password/reset/validar/',
    passwordResetConfirm: '/api/auth/password/reset/confirmar/',
    me: '/api/me/',
    // Parámetros que define el backend (ventana de inactividad, etc.).
    config: '/api/config/',
  },

  /**
   * Ventana de inactividad por defecto, en minutos. Solo se usa si el backend
   * no responde a /api/config/; el valor real lo manda él.
   */
  inactividadPorDefectoMin: 15,
} as const
