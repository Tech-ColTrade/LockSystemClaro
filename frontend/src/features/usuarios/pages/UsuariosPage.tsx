import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usuariosApi } from '@/features/usuarios/api/usuarios.api'
import type { Role, User } from '@/features/auth/types'

const PAGE_SIZE = 10

const rolePill: Record<Role, string> = {
  admin: 'pill pill-lock',
  operador: 'pill pill-ok',
  consulta: 'pill pill-unlock',
}

export function UsuariosPage() {
  const [items, setItems] = useState<User[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    usuariosApi
      .list(search, page)
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
  }, [search, page])

  function onSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setSearch(query.trim())
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-800">Usuarios</h2>
        <Link to="/usuarios/nuevo" className="btn btn-primary">
          + Nuevo usuario
        </Link>
      </div>

      <form onSubmit={onSearch} className="mb-5 flex max-w-md gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por correo o nombre..."
          className="inp"
        />
        <button type="submit" className="btn btn-ghost">
          Buscar
        </button>
      </form>

      {error && <div className="msg msg-error">{error}</div>}

      {loading ? (
        <div className="card py-12 text-center text-gray-400">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="card py-12 text-center text-gray-400">
          No se encontraron usuarios.
        </div>
      ) : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Correo</th>
                <th className="th">Nombre</th>
                <th className="th !text-center">Rol</th>
                <th className="th !text-center">Estado</th>
                <th className="th !text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="td font-medium">
                    <Link
                      to={`/usuarios/${u.id}/editar`}
                      className="text-whale hover:underline"
                    >
                      {u.email}
                    </Link>
                  </td>
                  <td className="td">{u.full_name || '—'}</td>
                  <td className="td text-center">
                    <span className={rolePill[u.role]}>{u.role_display}</span>
                  </td>
                  <td className="td text-center">
                    {u.is_active ? (
                      <span className="pill pill-unlock">Activo</span>
                    ) : (
                      <span className="pill pill-lock">Inactivo</span>
                    )}
                  </td>
                  <td className="td whitespace-nowrap text-center">
                    <Link
                      to={`/usuarios/${u.id}/editar`}
                      className="btn btn-sm btn-edit"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm text-gray-500">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Anterior
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente →
          </button>
        </div>
      )}
    </>
  )
}
