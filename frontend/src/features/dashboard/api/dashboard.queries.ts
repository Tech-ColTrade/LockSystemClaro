// Hook de datos del Dashboard sobre TanStack Query.
//
// El resumen se cachea por (periodo + filtros). Con `keepPreviousData` los
// gráficos no parpadean al cambiar un filtro: se ven los datos anteriores
// mientras llega el nuevo corte. El botón "Actualizar" usa `refetch`.

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  dashboardApi,
  type DashboardFiltros,
} from '@/features/dashboard/api/dashboard.api'
import type { Periodo } from '@/features/dashboard/types'

export const dashboardKeys = {
  all: ['dashboard'] as const,
  resumen: (periodo: Periodo, filtros: DashboardFiltros) =>
    [...dashboardKeys.all, 'resumen', periodo, filtros] as const,
}

export function useDashboardResumen(periodo: Periodo, filtros: DashboardFiltros) {
  return useQuery({
    queryKey: dashboardKeys.resumen(periodo, filtros),
    queryFn: () => dashboardApi.resumen(periodo, filtros),
    placeholderData: keepPreviousData,
  })
}
