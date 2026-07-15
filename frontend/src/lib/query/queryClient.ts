// Cliente global de TanStack Query.
//
// Política de caché DELIBERADAMENTE moderada: se cachea para que la app se
// sienta instantánea (volver a una lista no vuelve a pedir todo), pero NO tan
// agresiva como para que un registro recién creado no se vea. Dos mecanismos lo
// garantizan:
//   1) `staleTime` corto: pasados unos segundos el dato se considera "viejo" y
//      se refresca solo al volver a montar o al enfocar la ventana.
//   2) Invalidación en las mutaciones (crear/editar/borrar): cada mutación
//      invalida las listas afectadas, así el cambio se refleja de inmediato sin
//      esperar al `staleTime`. Ver los hooks `use*` de cada feature.

import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/http/errors'

/** No reintentar errores del cliente (4xx): un 400/403/404 no se arregla
 * repitiendo la petición; solo los transitorios (red/5xx) valen la pena. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false
  }
  return failureCount < 2
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Fresco 30 s: navegar entre páginas dentro de esa ventana usa la caché
      // sin volver a pedir. Después se revalida en segundo plano.
      staleTime: 30_000,
      // Se conserva en memoria 5 min tras dejar de usarse (vuelta atrás rápida).
      gcTime: 5 * 60_000,
      // Al volver a la pestaña se revalida: captura cambios hechos en otro lado.
      refetchOnWindowFocus: true,
      retry: shouldRetry,
    },
    mutations: {
      retry: false,
    },
  },
})
