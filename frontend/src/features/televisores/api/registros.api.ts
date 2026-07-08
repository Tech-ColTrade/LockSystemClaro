import { apiFetch } from '@/lib/http/client'
import type { Paginated } from '@/shared/types'
import type {
  PincodeRow,
  SincronizacionRow,
} from '@/features/televisores/types'

const qs = (page: number) => (page > 1 ? `?page=${page}` : '')

export const registrosApi = {
  sincronizaciones: (page = 1) =>
    apiFetch<Paginated<SincronizacionRow>>(`/api/sincronizaciones/${qs(page)}`),

  pincodes: (page = 1) =>
    apiFetch<Paginated<PincodeRow>>(`/api/pincodes/${qs(page)}`),
}
