import { apiDownload, apiFetch } from '@/lib/http/client'
import { queryRango, type RangoFiltro } from '@/features/televisores/api/registros.api'
import type { Paginated } from '@/shared/types'
import type {
  BulkSyncStatus,
  EnrolarEstadoResult,
  ImportResult,
  PincodeRow,
  PinCodesResponse,
  RegistrosResumen,
  SincronizacionRow,
  SyncJobRecord,
  SyncLaunch,
  SyncStatus,
  Televisor,
  TelevisorInput,
  UsarPincodeResult,
  ValidarResult,
} from '@/features/televisores/types'

const pageQs = (page: number) => (page > 1 ? `?page=${page}` : '')

export const televisoresApi = {
  list: (search = '', page = 1) => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (page > 1) params.set('page', String(page))
    const qs = params.toString()
    return apiFetch<Paginated<Televisor>>(
      `/api/televisores/${qs ? `?${qs}` : ''}`,
    )
  },

  get: (id: number | string) =>
    apiFetch<Televisor>(`/api/televisores/${id}/`),

  create: (data: TelevisorInput) =>
    apiFetch<Televisor>('/api/televisores/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number | string, data: Partial<TelevisorInput>) =>
    apiFetch<Televisor>(`/api/televisores/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  remove: (id: number | string) =>
    apiFetch<void>(`/api/televisores/${id}/`, { method: 'DELETE' }),

  import: (file: File) => {
    const form = new FormData()
    form.append('archivo', file)
    return apiFetch<ImportResult>('/api/televisores/importar/', {
      method: 'POST',
      body: form,
    })
  },

  // --- Estado + sincronización con el portal remoto (segundo plano) ---
  // Guarda el estado local y lanza el job de sincronización. Devuelve el job.
  setEstado: (id: number | string, inhabilitar: boolean) =>
    apiFetch<SyncLaunch>(`/api/televisores/${id}/estado/`, {
      method: 'POST',
      body: JSON.stringify({ inhabilitar }),
    }),

  // Progreso del job (polling).
  syncStatus: (id: number | string, jobId: number) =>
    apiFetch<SyncStatus>(`/api/televisores/${id}/sync/${jobId}/`),

  // Histórico de cambios de estado.
  historial: (id: number | string) =>
    apiFetch<SyncJobRecord[]>(`/api/televisores/${id}/historial/`),

  // --- Enrolar Estado (masivo) ---
  enrolarEstado: (file: File) => {
    const form = new FormData()
    form.append('archivo', file)
    return apiFetch<EnrolarEstadoResult>('/api/televisores/enrolar-estado/', {
      method: 'POST',
      body: form,
    })
  },

  bulkStatus: (jobId: number) =>
    apiFetch<BulkSyncStatus>(`/api/televisores/enrolar-estado/${jobId}/`),

  cancelarEnrolarEstado: (jobId: number) =>
    apiFetch<BulkSyncStatus>(`/api/televisores/enrolar-estado/${jobId}/cancelar/`, {
      method: 'POST',
    }),

  exportarEnrolarEstado: (jobId: number) =>
    apiDownload(
      `/api/televisores/enrolar-estado/${jobId}/exportar/`,
      `sincronizacion_masiva_${jobId}.xlsx`,
    ),

  // --- Validación (dry-run) ---
  validar: (id: number | string) =>
    apiFetch<ValidarResult>(`/api/televisores/${id}/validar/`),

  validarMasivo: () =>
    apiFetch<{ job: number; total: number }>(
      '/api/televisores/validar-masivo/',
      { method: 'POST' },
    ),

  validarMasivoStatus: (jobId: number) =>
    apiFetch<BulkSyncStatus>(`/api/televisores/validar-masivo/${jobId}/`),

  cancelarValidarMasivo: (jobId: number) =>
    apiFetch<BulkSyncStatus>(`/api/televisores/validar-masivo/${jobId}/cancelar/`, {
      method: 'POST',
    }),

  exportarValidarMasivo: (jobId: number) =>
    apiDownload(
      `/api/televisores/validar-masivo/${jobId}/exportar/`,
      `validacion_masiva_${jobId}.xlsx`,
    ),

  // --- Registros del televisor (sección "Registros" del detalle) ---
  registros: (id: number | string) =>
    apiFetch<RegistrosResumen>(`/api/televisores/${id}/registros/`),

  sincronizacionesDeTV: (id: number | string, page = 1) =>
    apiFetch<Paginated<SincronizacionRow>>(
      `/api/televisores/${id}/sincronizaciones/${pageQs(page)}`,
    ),

  pincodesUsadosDeTV: (id: number | string, page = 1) =>
    apiFetch<Paginated<PincodeRow>>(
      `/api/televisores/${id}/pincodes-usados/${pageQs(page)}`,
    ),

  // Exportan TODOS los registros del televisor, no la página visible.
  exportarSincronizacionesDeTV: (id: number | string) =>
    apiDownload(
      `/api/televisores/${id}/exportar-sincronizaciones/`,
      'sincronizaciones.xlsx',
    ),

  exportarPincodesDeTV: (id: number | string) =>
    apiDownload(`/api/televisores/${id}/exportar-pincodes/`, 'pincodes.xlsx'),

  // --- Códigos Pin ---
  pincodes: (id: number | string) =>
    apiFetch<PinCodesResponse>(`/api/televisores/${id}/pincodes/`),

  // Obtiene el Código Pin de un Código de Acceso, lo marca usado y lo registra.
  usarPincode: (id: number | string, passcode: string) =>
    apiFetch<UsarPincodeResult>(`/api/televisores/${id}/pincodes/usar/`, {
      method: 'POST',
      body: JSON.stringify({ passcode }),
    }),

  // --- Exportaciones a Excel ---
  exportarSincronizaciones: (filtro: RangoFiltro = {}) =>
    apiDownload(
      `/api/televisores/exportar-sincronizaciones/${queryRango(filtro)}`,
      'sincronizaciones.xlsx',
    ),

  // Se manda el mismo rango que filtra la tabla: el Excel contiene exactamente
  // las filas que el usuario está viendo.
  exportarPincodes: (filtro: RangoFiltro = {}) =>
    apiDownload(
      `/api/televisores/exportar-pincodes/${queryRango(filtro)}`,
      'pincodes.xlsx',
    ),

  // --- Plantillas Excel ---
  plantillaTelevisores: () =>
    apiDownload(
      '/api/televisores/plantilla-televisores/',
      'plantilla_televisores.xlsx',
    ),

  plantillaEstados: () =>
    apiDownload('/api/televisores/plantilla-estados/', 'plantilla_estados.xlsx'),
}
