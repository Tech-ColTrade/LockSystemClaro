/// <reference types="vite/client" />

// Tipado de las variables de entorno expuestas por Vite (prefijo VITE_).
interface ImportMetaEnv {
  /** URL base del backend en producción. En dev se usa el proxy de Vite. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
