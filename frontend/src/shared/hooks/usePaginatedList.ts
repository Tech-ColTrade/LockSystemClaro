import { useEffect, useState } from 'react'
import type { Paginated } from '@/shared/types'

/** Maneja el estado de un listado paginado (página, carga, error). */
export function usePaginatedList<T>(
  fetcher: (page: number) => Promise<Paginated<T>>,
) {
  const [items, setItems] = useState<T[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    fetcher(page)
      .then((data) => {
        if (!active) return
        setItems(data.results)
        setCount(data.count)
      })
      .catch((e) => active && setError((e as Error).message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [page, fetcher])

  return { items, count, page, setPage, loading, error }
}
