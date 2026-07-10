import { apiFetch } from '@/lib/http/client'
import type { Paginated } from '@/shared/types'
import type {
  PincodeRow,
  SincronizacionRow,
} from '@/features/televisores/types'

/** Rango de fechas en 'YYYY-MM-DD'. Los extremos vacíos no se envían. */
export interface RangoFiltro {
  desde?: string
  hasta?: string
}

export function queryRango(filtro: RangoFiltro = {}, page = 1): string {
  const p = new URLSearchParams()
  if (page > 1) p.set('page', String(page))
  if (filtro.desde) p.set('desde', filtro.desde)
  if (filtro.hasta) p.set('hasta', filtro.hasta)
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const registrosApi = {
  sincronizaciones: (page = 1, filtro: RangoFiltro = {}) =>
    apiFetch<Paginated<SincronizacionRow>>(
      `/api/sincronizaciones/${queryRango(filtro, page)}`,
    ),

  pincodes: (page = 1, filtro: RangoFiltro = {}) =>
    apiFetch<Paginated<PincodeRow>>(`/api/pincodes/${queryRango(filtro, page)}`),
}
