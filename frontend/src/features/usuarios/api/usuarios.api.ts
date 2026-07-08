// Capa de acceso a la API de gestión de usuarios (solo Administrador).

import { apiFetch } from '@/lib/http/client'
import type { Role, User } from '@/features/auth/types'
import type { Paginated } from '@/shared/types'

export interface UsuarioCreateInput {
  email: string
  password: string
  first_name?: string
  last_name?: string
  role: Role
}

export interface UsuarioUpdateInput {
  first_name?: string
  last_name?: string
  role?: Role
  is_active?: boolean
}

export const usuariosApi = {
  list: (search = '', page = 1) => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (page > 1) params.set('page', String(page))
    const qs = params.toString()
    return apiFetch<Paginated<User>>(`/api/usuarios/${qs ? `?${qs}` : ''}`)
  },

  get: (id: string) => apiFetch<User>(`/api/usuarios/${id}/`),

  create: (data: UsuarioCreateInput) =>
    apiFetch<User>('/api/usuarios/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UsuarioUpdateInput) =>
    apiFetch<User>(`/api/usuarios/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
}
