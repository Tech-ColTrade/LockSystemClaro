import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usuariosApi } from '@/features/usuarios/api/usuarios.api'
import { ROLE_LABELS } from '@/features/auth/permissions'
import { usePermissions } from '@/features/auth/usePermissions'
import type { Role } from '@/features/auth/types'
import { ApiError } from '@/lib/http/errors'

const ROLES: Role[] = ['admin', 'operador', 'consulta']

/** Descripción corta de cada rol (ayuda contextual en el formulario). */
const ROLE_HINT: Record<Role, string> = {
  admin: 'Todos los módulos + gestión de usuarios y parametrizaciones.',
  operador:
    'Habilitaciones, inhabilitaciones, enrolamiento/desenrolamiento, pines y reportes.',
  consulta: 'Solo lectura: validar estado del dispositivo y consultar pines.',
}

/** Extrae errores por campo y un mensaje general de un ApiError de DRF. */
function parseErrors(err: unknown): {
  fields: Record<string, string>
  general: string | null
} {
  if (err instanceof ApiError && err.data && typeof err.data === 'object') {
    const data = err.data as Record<string, unknown>
    const fields: Record<string, string> = {}
    let general: string | null = null
    for (const [key, val] of Object.entries(data)) {
      const msg = Array.isArray(val) ? String(val[0]) : String(val)
      if (key === 'detail' || key === 'non_field_errors') general = msg
      else fields[key] = msg
    }
    return { fields, general }
  }
  return { fields: {}, general: (err as Error)?.message ?? 'Error inesperado.' }
}

export function UsuarioFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user: current } = usePermissions()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState<Role>('consulta')
  const [isActive, setIsActive] = useState(true)

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  const isSelf = isEdit && current?.id === id

  useEffect(() => {
    if (!isEdit) return
    let active = true
    usuariosApi
      .get(id!)
      .then((u) => {
        if (!active) return
        setEmail(u.email)
        setFirstName(u.first_name)
        setLastName(u.last_name)
        setRole(u.role)
        setIsActive(u.is_active)
      })
      .catch((e) => active && setGeneral((e as Error).message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [id, isEdit])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFieldErrors({})
    setGeneral(null)
    try {
      if (isEdit) {
        await usuariosApi.update(id!, {
          first_name: firstName,
          last_name: lastName,
          role,
          is_active: isActive,
        })
      } else {
        await usuariosApi.create({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          role,
        })
      }
      navigate('/usuarios')
    } catch (err) {
      const { fields, general: g } = parseErrors(err)
      setFieldErrors(fields)
      setGeneral(g)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="card max-w-xl py-12 text-center text-gray-400">Cargando…</div>
    )
  }

  return (
    <div className="card max-w-xl">
      <h2 className="mb-5 text-xl font-bold text-gray-800">
        {isEdit ? 'Editar usuario' : 'Nuevo usuario'}
      </h2>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {general && <div className="msg msg-error">{general}</div>}

        <div>
          <label className="lbl" htmlFor="email">
            Correo electrónico {!isEdit && <span className="text-red-600">*</span>}
          </label>
          <input
            id="email"
            type="email"
            className="inp"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@claro.com"
            autoFocus={!isEdit}
            required={!isEdit}
            disabled={isEdit}
          />
          {fieldErrors.email && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
          )}
        </div>

        {!isEdit && (
          <div>
            <label className="lbl" htmlFor="password">
              Contraseña <span className="text-red-600">*</span>
            </label>
            <input
              id="password"
              type="password"
              className="inp"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 10 caracteres"
              autoComplete="new-password"
              required
            />
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
            )}
          </div>
        )}

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="lbl" htmlFor="first_name">
              Nombres
            </label>
            <input
              id="first_name"
              className="inp"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            {fieldErrors.first_name && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.first_name}</p>
            )}
          </div>
          <div className="flex-1">
            <label className="lbl" htmlFor="last_name">
              Apellidos
            </label>
            <input
              id="last_name"
              className="inp"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
            {fieldErrors.last_name && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.last_name}</p>
            )}
          </div>
        </div>

        <div>
          <label className="lbl" htmlFor="role">
            Rol <span className="text-red-600">*</span>
          </label>
          <select
            id="role"
            className="inp"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            disabled={isSelf}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">{ROLE_HINT[role]}</p>
          {isSelf && (
            <p className="mt-1 text-xs text-amber-600">
              No puedes cambiar tu propio rol.
            </p>
          )}
          {fieldErrors.role && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.role}</p>
          )}
        </div>

        {isEdit && (
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={isSelf}
              />
              Cuenta activa
            </label>
            {isSelf && (
              <p className="mt-1 text-xs text-amber-600">
                No puedes desactivar tu propia cuenta.
              </p>
            )}
            {fieldErrors.is_active && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.is_active}</p>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate('/usuarios')}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
