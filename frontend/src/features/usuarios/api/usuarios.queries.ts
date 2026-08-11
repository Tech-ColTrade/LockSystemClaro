// Hooks de datos de Usuarios sobre TanStack Query. Crear/editar invalida las
// listas para que el nuevo usuario (o el cambio de rol/estado) se vea al momento.

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  usuariosApi,
  type UsuarioCreateInput,
  type UsuarioUpdateInput,
} from '@/features/usuarios/api/usuarios.api'

export const usuarioKeys = {
  all: ['usuarios'] as const,
  lists: () => [...usuarioKeys.all, 'list'] as const,
  list: (search: string, page: number, soloActivos: boolean) =>
    [...usuarioKeys.lists(), { search, page, soloActivos }] as const,
  details: () => [...usuarioKeys.all, 'detail'] as const,
  detail: (id: string) => [...usuarioKeys.details(), id] as const,
}

export function useUsuarios(search: string, page: number, soloActivos = false) {
  return useQuery({
    queryKey: usuarioKeys.list(search, page, soloActivos),
    queryFn: () => usuariosApi.list(search, page, soloActivos),
    placeholderData: keepPreviousData,
  })
}

export function useUsuario(id: string | undefined) {
  return useQuery({
    queryKey: usuarioKeys.detail(id ?? ''),
    queryFn: () => usuariosApi.get(id!),
    enabled: !!id,
  })
}

export function useCreateUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UsuarioCreateInput) => usuariosApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: usuarioKeys.lists() }),
  })
}

/**
 * Cierre forzado de la sesión de un usuario (solo admin). Invalida las listas
 * para que la columna de sesión refleje el cambio de inmediato.
 */
export function useCerrarSesionUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => usuariosApi.cerrarSesion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: usuarioKeys.all }),
  })
}

export function useUpdateUsuario(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UsuarioUpdateInput) => usuariosApi.update(id, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: usuarioKeys.lists() })
      qc.setQueryData(usuarioKeys.detail(id), updated)
    },
  })
}
