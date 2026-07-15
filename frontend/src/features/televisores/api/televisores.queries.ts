// Hooks de datos de Televisores sobre TanStack Query.
//
// Las claves (`televisorKeys`) son la única fuente de verdad para cachear e
// invalidar. Al crear/editar se invalida `televisorKeys.lists()` para que la
// tabla refleje el cambio de inmediato (sin esperar al `staleTime`).

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { televisoresApi } from '@/features/televisores/api/televisores.api'
import type { TelevisorInput } from '@/features/televisores/types'

export const televisorKeys = {
  all: ['televisores'] as const,
  lists: () => [...televisorKeys.all, 'list'] as const,
  list: (search: string, page: number) =>
    [...televisorKeys.lists(), { search, page }] as const,
  details: () => [...televisorKeys.all, 'detail'] as const,
  detail: (id: number | string) => [...televisorKeys.details(), String(id)] as const,
  registros: (id: number | string) =>
    [...televisorKeys.all, 'registros', String(id)] as const,
}

/** Lista paginada. Mantiene los datos previos mientras carga la nueva página
 * (la tabla no "parpadea" al pasar de página). */
export function useTelevisores(search: string, page: number) {
  return useQuery({
    queryKey: televisorKeys.list(search, page),
    queryFn: () => televisoresApi.list(search, page),
    placeholderData: keepPreviousData,
  })
}

/** Detalle de un televisor. `enabled` evita pedir cuando aún no hay id. */
export function useTelevisor(id: number | string | undefined) {
  return useQuery({
    queryKey: televisorKeys.detail(id ?? ''),
    queryFn: () => televisoresApi.get(id!),
    enabled: id != null && id !== '',
  })
}

/** Contadores de registros (sincronizaciones / pincodes) del detalle. */
export function useTelevisorRegistros(id: number | string | undefined) {
  return useQuery({
    queryKey: televisorKeys.registros(id ?? ''),
    queryFn: () => televisoresApi.registros(id!),
    enabled: id != null && id !== '',
  })
}

export function useCreateTelevisor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: TelevisorInput) => televisoresApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: televisorKeys.lists() })
    },
  })
}

export function useUpdateTelevisor(id: number | string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<TelevisorInput>) => televisoresApi.update(id, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: televisorKeys.lists() })
      // Refresca también el detalle cacheado con lo que devolvió el backend.
      qc.setQueryData(televisorKeys.detail(id), updated)
    },
  })
}

export function useDeleteTelevisor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number | string) => televisoresApi.remove(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: televisorKeys.lists() })
      qc.removeQueries({ queryKey: televisorKeys.detail(id) })
    },
  })
}
