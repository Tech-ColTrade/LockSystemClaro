// Respuesta paginada estándar de DRF (PageNumberPagination).
export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
