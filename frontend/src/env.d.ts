/// <reference types="vite/client" />

// Tipado de las variables de entorno expuestas por Vite (prefijo VITE_).
interface ImportMetaEnv {
  /** URL base del backend en producción. En dev se usa el proxy de Vite. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Import de documentos como URL de asset (Vite resuelve la ruta con hash,
// respetando el `base` de despliegue: sirve igual en dev y en la web).
declare module '*.docx' {
  const src: string
  export default src
}
