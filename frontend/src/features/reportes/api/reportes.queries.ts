// Hooks de datos del Constructor de reportes (TanStack Query).

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { reportesApi, type ReporteDef } from '@/features/reportes/api/reportes.api'

export const reportesKeys = {
  all: ['reportes'] as const,
  meta: () => [...reportesKeys.all, 'meta'] as const,
  preview: (def: ReporteDef, page: number) =>
    [...reportesKeys.all, 'preview', def, page] as const,
  guardados: () => [...reportesKeys.all, 'guardados'] as const,
}

/** Metadatos (orígenes/campos/dimensiones/filtros). Caché larga: casi no cambian. */
export function useReportesMeta() {
  return useQuery({
    queryKey: reportesKeys.meta(),
    queryFn: reportesApi.meta,
    staleTime: 1000 * 60 * 60,
  })
}

/** Previsualización paginada. `enabled` evita pedir sin selección válida. */
export function useReportePreview(def: ReporteDef, page: number, enabled: boolean) {
  return useQuery({
    queryKey: reportesKeys.preview(def, page),
    queryFn: () => reportesApi.preview(def, page),
    enabled,
    placeholderData: keepPreviousData,
  })
}

/** Reportes guardados del usuario (privados). */
export function useReportesGuardados() {
  return useQuery({
    queryKey: reportesKeys.guardados(),
    queryFn: reportesApi.guardados.list,
  })
}

export function useCrearGuardado() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { nombre: string; definicion: ReporteDef }) =>
      reportesApi.guardados.crear(v.nombre, v.definicion),
    onSuccess: () => qc.invalidateQueries({ queryKey: reportesKeys.guardados() }),
  })
}

export function useEliminarGuardado() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => reportesApi.guardados.eliminar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: reportesKeys.guardados() }),
  })
}
