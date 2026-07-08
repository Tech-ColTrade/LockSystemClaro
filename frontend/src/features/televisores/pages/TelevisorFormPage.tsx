import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { televisoresApi } from '@/features/televisores/api/televisores.api'
import type { TelevisorInput } from '@/features/televisores/types'
import { ApiError } from '@/lib/http/errors'

const emptyForm: TelevisorInput = {
  mac_address: '',
  serial_number: '',
  numero_credito: '',
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

export function TelevisorFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [form, setForm] = useState<TelevisorInput>(emptyForm)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isEdit) return
    let active = true
    televisoresApi
      .get(id!)
      .then((tv) => {
        if (!active) return
        setForm({
          mac_address: tv.mac_address,
          serial_number: tv.serial_number,
          numero_credito: tv.numero_credito,
        })
      })
      .catch((e) => active && setGeneral((e as Error).message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [id, isEdit])

  function set<K extends keyof TelevisorInput>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFieldErrors({})
    setGeneral(null)
    try {
      const saved = isEdit
        ? await televisoresApi.update(id!, form)
        : await televisoresApi.create(form)
      navigate(`/televisores/${saved.id}`)
    } catch (err) {
      const { fields, general: g } = parseErrors(err)
      setFieldErrors(fields)
      setGeneral(g)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="card max-w-xl py-12 text-center text-gray-400">Cargando…</div>
  }

  return (
    <div className="card max-w-xl">
      <h2 className="mb-5 text-xl font-bold text-gray-800">
        {isEdit ? 'Editar televisor' : 'Nuevo televisor'}
      </h2>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {general && <div className="msg msg-error">{general}</div>}

        <div>
          <label className="lbl" htmlFor="mac">
            Dirección MAC <span className="text-red-600">*</span>
          </label>
          <input
            id="mac"
            className="inp"
            value={form.mac_address}
            onChange={(e) => set('mac_address', e.target.value)}
            placeholder="B4:04:29:7E:3A:ED"
            autoFocus
            required
          />
          {fieldErrors.mac_address && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.mac_address}</p>
          )}
        </div>

        <div>
          <label className="lbl" htmlFor="serial">
            Número de serie
          </label>
          <input
            id="serial"
            className="inp"
            value={form.serial_number}
            onChange={(e) => set('serial_number', e.target.value)}
            placeholder="B4:04:29:7E:3A:ED"
          />
          {fieldErrors.serial_number && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.serial_number}</p>
          )}
        </div>

        <div>
          <label className="lbl" htmlFor="credito">
            Número de crédito
          </label>
          <input
            id="credito"
            className="inp"
            value={form.numero_credito}
            onChange={(e) =>
              set('numero_credito', e.target.value.replace(/\D/g, '').slice(0, 60))
            }
            placeholder="1234567890"
            inputMode="numeric"
          />
          {fieldErrors.numero_credito && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.numero_credito}</p>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate('/televisores')}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
