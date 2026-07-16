// Cliente del Constructor de reportes.
//
// El backend expone orígenes (televisores / sincronizaciones / pincodes) con
// una lista blanca de campos (modo lista) y de dimensiones (modo agrupado).
// Aquí solo se arman las URLs; la validación y el ORM viven en el backend
// (televisores/api/reportes_builder.py).

import { apiDownload, apiFetch } from '@/lib/http/client'

export type CampoTipo = 'texto' | 'fecha' | 'booleano' | 'usuario' | 'numero'

export interface CampoMeta {
  key: string
  label: string
  tipo: CampoTipo
}

export interface OrigenFiltros {
  fecha: boolean
  inhabilitado: boolean
  busqueda: boolean
}

export interface OrigenMeta {
  key: string
  label: string
  descripcion: string
  filtros: OrigenFiltros
  campos: CampoMeta[]
  /** Dimensiones agrupables (modo agrupado). */
  dimensiones: CampoMeta[]
}

export interface ReportesMeta {
  origenes: OrigenMeta[]
}

/** Estado inhabilitado: '' = todos. */
export interface ReporteFiltros {
  desde?: string
  hasta?: string
  inhabilitado?: '' | 'true' | 'false'
  q?: string
}

export type ReporteModo = 'lista' | 'agrupado'

/** Definición completa de un reporte (la elección del usuario). */
export interface ReporteDef {
  origen: string
  modo: ReporteModo
  /** Modo lista: columnas elegidas (en orden). */
  campos: string[]
  /** Modo agrupado: dimensión por la que se cuenta. */
  dimension: string
  filtros: ReporteFiltros
}

export interface PreviewResponse {
  count: number
  next: string | null
  previous: string | null
  campos: CampoMeta[]
  /** Filas alineadas al orden de `campos` (en agrupado, la 2ª col es número). */
  rows: (string | number)[][]
  /** Total general de registros en modo agrupado (null en modo lista). */
  total: number | null
}

function buildParams(def: ReporteDef, page?: number): string {
  const p = new URLSearchParams()
  p.set('origen', def.origen)
  p.set('modo', def.modo)
  if (def.modo === 'agrupado') {
    if (def.dimension) p.set('dimension', def.dimension)
  } else if (def.campos.length) {
    p.set('campos', def.campos.join(','))
  }
  const f = def.filtros
  if (f.desde) p.set('desde', f.desde)
  if (f.hasta) p.set('hasta', f.hasta)
  if (f.inhabilitado) p.set('inhabilitado', f.inhabilitado)
  const q = f.q?.trim()
  if (q) p.set('q', q)
  if (page && page > 1) p.set('page', String(page))
  return p.toString()
}

/** Un reporte guardado por el usuario (privado). */
export interface ReporteGuardado {
  id: number
  nombre: string
  definicion: ReporteDef
  creado: string
}

export const reportesApi = {
  meta: () => apiFetch<ReportesMeta>('/api/reportes/campos/'),

  preview: (def: ReporteDef, page = 1) =>
    apiFetch<PreviewResponse>(`/api/reportes/consultar/?${buildParams(def, page)}`),

  // Baja TODAS las filas del reporte (no solo la página visible).
  exportar: (def: ReporteDef) =>
    apiDownload(
      `/api/reportes/exportar/?${buildParams(def)}`,
      `reporte_${def.origen}${def.modo === 'agrupado' ? '_agrupado' : ''}.xlsx`,
    ),

  // --- Reportes guardados (privados por usuario) ---
  guardados: {
    list: () => apiFetch<ReporteGuardado[]>('/api/reportes/guardados/'),
    crear: (nombre: string, definicion: ReporteDef) =>
      apiFetch<ReporteGuardado>('/api/reportes/guardados/', {
        method: 'POST',
        body: JSON.stringify({ nombre, definicion }),
      }),
    eliminar: (id: number) =>
      apiFetch<void>(`/api/reportes/guardados/${id}/`, { method: 'DELETE' }),
  },
}
