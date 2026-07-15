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
  list: (search: string, page: number) =>
    [...usuarioKeys.lists(), { search, page }] as const,
  details: () => [...usuarioKeys.all, 'detail'] as const,
  detail: (id: string) => [...usuarioKeys.details(), id] as const,
}

export function useUsuarios(search: string, page: number) {
  return useQuery({
    queryKey: usuarioKeys.list(search, page),
    queryFn: () => usuariosApi.list(search, page),
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
