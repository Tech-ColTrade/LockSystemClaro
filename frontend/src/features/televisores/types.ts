// Tipos del dominio Televisor (alineados con la API de Django `televisores`).

export interface Televisor {
  id: number
  mac_address: string
  serial_number: string
  numero_credito: string
  inhabilitado: boolean
  eui64: string
  created_at: string
}

// Respuesta al lanzar la sincronización en segundo plano.
export interface SyncLaunch {
  job: number
  estado: string
  inhabilitado: boolean
}

// Estado/progreso de un SyncJob (polling).
export interface SyncStatus {
  job: number
  estado: 'pendiente' | 'corriendo' | 'terminado' | 'error'
  porcentaje: number
  finalizado: boolean
  error: string
  inhabilitar: boolean
}

// Registro del histórico de cambios de estado.
export interface SyncJobRecord {
  id: number
  inhabilitar: boolean
  estado: 'pendiente' | 'corriendo' | 'terminado' | 'error'
  porcentaje: number
  error: string
  creado: string
  terminado_en: string | null
}

// --- Listados del sidebar ---
export interface SincronizacionRow {
  fecha: string
  mac_address: string
  serial_number: string
  usuario: string
  accion: string
  resultado: string
  tipo: string
}

// Registro de un Código Pin usado (bitácora).
export interface PincodeRow {
  id: number
  mac_address: string
  serial_number: string
  passcode: string
  pin_code: string
  creado: string
}

// Contadores de la sección "Registros" del detalle.
export interface RegistrosResumen {
  sincronizaciones: number
  pincodes: number
}

// Resultado de usar/obtener un Código Pin.
export interface UsarPincodeResult {
  passcode: string
  pin_code: string
  creado: string
}

// --- Validación (dry-run: portal vs app) ---
export interface ValidarResult {
  coincide: boolean
  remoto_inhabilitado: boolean
  local_inhabilitado: boolean
  mensaje: string
}

// --- Códigos Pin ---
export interface PinCodeGroup {
  codeId: string
  passCode: string
  pinCode: string
}

export interface PinCodesResponse {
  eui64: string
  grupos: PinCodeGroup[]
}

// --- Enrolar Estado (cambio de estado masivo + sync) ---
export interface EnrolarEstadoResult {
  job: number | null
  creados: number
  actualizados: number
  cambios: number
  errores: string[]
}

export interface BulkSyncItemRecord {
  id: number
  mac_address: string
  inhabilitar: boolean
  estado: 'pendiente' | 'ok' | 'error'
  mensaje: string
  remoto_inhabilitado: boolean | null
  local_inhabilitado: boolean | null
  coincide: boolean | null
}

export interface BulkSyncStatus {
  id: number
  modo: 'sync' | 'validacion'
  estado: 'pendiente' | 'corriendo' | 'terminado' | 'error' | 'cancelado'
  total: number
  procesados: number
  ok_count: number
  error_count: number
  porcentaje: number
  finalizado: boolean
  creados: number
  actualizados: number
  errores_import: string[]
  items: BulkSyncItemRecord[]
  creado: string
  terminado_en: string | null
}

// Campos editables al crear/editar (el estado y las fechas son de solo lectura).
export interface TelevisorInput {
  mac_address: string
  serial_number: string
  numero_credito: string
}

// Resultado del endpoint de importación masiva.
export interface ImportResult {
  creados: number
  actualizados: number
  errores: string[]
}
