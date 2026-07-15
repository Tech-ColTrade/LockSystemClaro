import { useState } from 'react'
import { keepPreviousData, useQuery, type QueryKey } from '@tanstack/react-query'
import type { Paginated } from '@/shared/types'

/**
 * Estado de un listado paginado sobre TanStack Query.
 *
 * `baseKey` identifica el listado en la caché (debe incluir los filtros activos,
 * p. ej. `['sincronizaciones', { desde, hasta }]`); la página se añade sola. Así
 * volver a un listado ya visto es instantáneo y cambiar de página no parpadea
 * (mantiene los datos previos mientras carga la siguiente).
 */
export function usePaginatedList<T>(
  baseKey: QueryKey,
  fetcher: (page: number) => Promise<Paginated<T>>,
) {
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: [...baseKey, page],
    queryFn: () => fetcher(page),
    placeholderData: keepPreviousData,
  })

  return {
    items: query.data?.results ?? [],
    count: query.data?.count ?? 0,
    page,
    setPage,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  }
}
