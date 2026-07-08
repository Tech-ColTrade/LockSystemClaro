import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CircleAlert, Loader2, Pencil, Plus } from 'lucide-react'
import { televisoresApi } from '@/features/televisores/api/televisores.api'
import type { TelevisorInput } from '@/features/televisores/types'
import { ApiError } from '@/lib/http/errors'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

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

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-destructive">{msg}</p>
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

  const titulo = isEdit ? 'Editar televisor' : 'Nuevo televisor'

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      {/* Encabezado */}
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit text-muted-foreground"
          render={<Link to="/televisores" />}
        >
          <ArrowLeft data-icon="inline-start" /> Volver a televisores
        </Button>
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {isEdit ? <Pencil className="size-5" /> : <Plus className="size-5" />}
          </span>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-lg font-bold text-foreground">{titulo}</h1>
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? 'Actualiza los datos de registro del televisor.'
                : 'Registra un nuevo televisor en el sistema.'}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle>Datos del dispositivo</CardTitle>
          <CardDescription>
            La dirección MAC es obligatoria; los demás campos son opcionales.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="grid gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
              {general && (
                <Alert variant="destructive">
                  <CircleAlert />
                  <AlertTitle>No se pudo guardar</AlertTitle>
                  <AlertDescription>{general}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-2">
                <Label htmlFor="mac">
                  Dirección MAC <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="mac"
                  className="font-mono"
                  value={form.mac_address}
                  onChange={(e) => set('mac_address', e.target.value)}
                  placeholder="B4:04:29:7E:3A:ED"
                  aria-invalid={!!fieldErrors.mac_address}
                  autoFocus
                />
                <FieldError msg={fieldErrors.mac_address} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="serial">Número de serie</Label>
                <Input
                  id="serial"
                  className="font-mono"
                  value={form.serial_number}
                  onChange={(e) => set('serial_number', e.target.value)}
                  placeholder="B4:04:29:7E:3A:ED"
                  aria-invalid={!!fieldErrors.serial_number}
                />
                <FieldError msg={fieldErrors.serial_number} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="credito">Número de crédito</Label>
                <Input
                  id="credito"
                  value={form.numero_credito}
                  onChange={(e) =>
                    set('numero_credito', e.target.value.replace(/\D/g, '').slice(0, 60))
                  }
                  placeholder="1234567890"
                  inputMode="numeric"
                  aria-invalid={!!fieldErrors.numero_credito}
                />
                <FieldError msg={fieldErrors.numero_credito} />
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="animate-spin" data-icon="inline-start" />}
                  {saving ? 'Guardando…' : 'Guardar'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/televisores')}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
