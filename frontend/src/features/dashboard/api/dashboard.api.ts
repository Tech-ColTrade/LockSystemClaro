import { apiDownload, apiFetch } from '@/lib/http/client'
import type { DashboardResumen, Periodo } from '@/features/dashboard/types'

const EXPORT = '/api/dashboard/export'

export const dashboardApi = {
  resumen: (periodo: Periodo = 'mes') =>
    apiFetch<DashboardResumen>(`/api/dashboard/resumen/?periodo=${periodo}`),

  // --- Exportaciones a Excel ---
  exportEstatus: () =>
    apiDownload(`${EXPORT}/estatus/`, 'estatus_inhabilitacion.xlsx'),

  exportEfectividad: () =>
    apiDownload(`${EXPORT}/efectividad/`, 'efectividad_inhabilitacion.xlsx'),

  exportTendencia: (periodo: Periodo) =>
    apiDownload(`${EXPORT}/tendencia/?periodo=${periodo}`, `tendencia_${periodo}.xlsx`),

  exportHistoricoSerial: (serial = '') =>
    apiDownload(
      `${EXPORT}/historico-serial/${serial ? `?serial=${encodeURIComponent(serial)}` : ''}`,
      'historico_por_serial.xlsx',
    ),

  exportUsuarios: () => apiDownload(`${EXPORT}/usuarios/`, 'usuarios.xlsx'),

  exportAccionesUsuario: () =>
    apiDownload(`${EXPORT}/acciones-usuario/`, 'acciones_por_usuario.xlsx'),

  exportHistorialAcciones: () =>
    apiDownload(`${EXPORT}/historial-acciones/`, 'historial_acciones.xlsx'),

  exportPinesAuditoria: (desde = '', hasta = '') => {
    const params = new URLSearchParams()
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    const qs = params.toString()
    return apiDownload(
      `${EXPORT}/pines-auditoria/${qs ? `?${qs}` : ''}`,
      'auditoria_pines.xlsx',
    )
  },
}
