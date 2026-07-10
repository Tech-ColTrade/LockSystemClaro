import { apiDownload, apiFetch } from '@/lib/http/client'
import type { DashboardResumen, Periodo } from '@/features/dashboard/types'

const EXPORT = '/api/dashboard/export'

/** Filtros globales del dashboard: se aplican al resumen y a las exportaciones. */
export interface DashboardFiltros {
  desde?: string
  hasta?: string
  estado?: string // '' | 'habilitado' | 'inhabilitado'
  serial?: string
}

/** Arma el query string combinando los filtros globales con extras (p. ej. periodo). */
function qs(filtros: DashboardFiltros = {}, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams()
  if (filtros.desde) p.set('desde', filtros.desde)
  if (filtros.hasta) p.set('hasta', filtros.hasta)
  if (filtros.estado) p.set('estado', filtros.estado)
  if (filtros.serial) p.set('serial', filtros.serial)
  for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v)
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const dashboardApi = {
  resumen: (periodo: Periodo = 'mes', filtros: DashboardFiltros = {}) =>
    apiFetch<DashboardResumen>(`/api/dashboard/resumen/${qs(filtros, { periodo })}`),

  // --- Exportaciones a Excel (respetan los filtros globales) ---
  exportEstatus: (filtros: DashboardFiltros = {}) =>
    apiDownload(`${EXPORT}/estatus/${qs(filtros)}`, 'estatus_inhabilitacion.xlsx'),

  exportEfectividad: (filtros: DashboardFiltros = {}) =>
    apiDownload(`${EXPORT}/efectividad/${qs(filtros)}`, 'efectividad_inhabilitacion.xlsx'),

  exportTendencia: (periodo: Periodo, filtros: DashboardFiltros = {}) =>
    apiDownload(`${EXPORT}/tendencia/${qs(filtros, { periodo })}`, `tendencia_${periodo}.xlsx`),

  exportHistoricoSerial: (filtros: DashboardFiltros = {}) =>
    apiDownload(`${EXPORT}/historico-serial/${qs(filtros)}`, 'historico_por_serial.xlsx'),

  exportUsuarios: () => apiDownload(`${EXPORT}/usuarios/`, 'usuarios.xlsx'),

  exportAccionesUsuario: (filtros: DashboardFiltros = {}) =>
    apiDownload(`${EXPORT}/acciones-usuario/${qs(filtros)}`, 'acciones_por_usuario.xlsx'),

  exportHistorialAcciones: (filtros: DashboardFiltros = {}) =>
    apiDownload(`${EXPORT}/historial-acciones/${qs(filtros)}`, 'historial_acciones.xlsx'),

  exportActividadEquipo: (filtros: DashboardFiltros = {}) =>
    apiDownload(`${EXPORT}/actividad-equipo/${qs(filtros)}`, 'actividad_por_equipo.xlsx'),

  exportPinesAuditoria: (filtros: DashboardFiltros = {}) =>
    apiDownload(`${EXPORT}/pines-auditoria/${qs(filtros)}`, 'auditoria_pines.xlsx'),
}
