// "Sincronizaciones en curso": qué se está ejecutando ahora mismo.
//
// Existe porque el progreso vivía solo en la pantalla que lanzó la operación:
// si cerrabas la pestaña o entrabas desde otro equipo, no había forma de volver
// a encontrar el job ni de cancelarlo.
//
// Distingue "trabajando" de "colgado" con el campo `vivo` (el latido del
// backend, ver televisores/watchdog.py): un job sin latido perdió su hilo en un
// reinicio del servidor y lo que procede es descartarlo, no esperarlo.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  CircleAlert,
  ListChecks,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Unlock,
} from 'lucide-react'
import { televisoresApi } from '@/features/televisores/api/televisores.api'
import type {
  JobIndividualActivo,
  JobLoteActivo,
  JobsActivos,
} from '@/features/televisores/types'
import { usePermissions } from '@/features/auth/usePermissions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

const INTERVALO_MS = 3000

/** "hace 12 s" / "hace 4 min" — para ver de un vistazo si algo se quedó quieto. */
function desde(iso: string): string {
  const segundos = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (segundos < 60) return `hace ${segundos} s`
  const minutos = Math.round(segundos / 60)
  if (minutos < 60) return `hace ${minutos} min`
  return `hace ${Math.round(minutos / 60)} h`
}

export function JobsEnCursoPage() {
  const { canOperate } = usePermissions()
  const [datos, setDatos] = useState<JobsActivos | null>(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [cancelando, setCancelando] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)

  const cargar = useCallback(async () => {
    try {
      setDatos(await televisoresApi.jobsActivos())
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    void cargar()
    pollRef.current = window.setInterval(cargar, INTERVALO_MS)
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [cargar])

  async function cancelarIndividual(j: JobIndividualActivo) {
    setCancelando(`ind-${j.job}`)
    setAviso('')
    setError('')
    try {
      await televisoresApi.cancelarSync(j.televisor_id, j.job)
      setAviso(`Sincronización #${j.job} descartada.`)
      await cargar()
    } catch (e) {
      // 409: el backend se niega a cancelar algo que sigue avanzando.
      setError((e as Error).message)
    } finally {
      setCancelando(null)
    }
  }

  async function cancelarLote(j: JobLoteActivo) {
    setCancelando(`lote-${j.job}`)
    setAviso('')
    setError('')
    try {
      if (j.modo === 'validacion') {
        await televisoresApi.cancelarValidarMasivo(j.job)
      } else {
        await televisoresApi.cancelarEnrolarEstado(j.job)
      }
      setAviso(
        j.vivo
          ? `Se pidió cancelar el lote #${j.job}: se detendrá en el siguiente televisor.`
          : `Lote #${j.job} descartado.`,
      )
      await cargar()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCancelando(null)
    }
  }

  const individuales = datos?.individuales ?? []
  const lotes = datos?.lotes ?? []
  const nada = datos !== null && individuales.length === 0 && lotes.length === 0

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1"
            render={<Link to="/televisores" />}
          >
            <ArrowLeft />
            Televisores
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Sincronizaciones en curso
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Lo que se está ejecutando ahora mismo, lo hayas lanzado tú o no. Se
            actualiza solo cada {INTERVALO_MS / 1000} segundos.
          </p>
        </div>
        <Button variant="outline" onClick={() => void cargar()}>
          <RefreshCw />
          Actualizar
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <CircleAlert />
          <AlertTitle>No se pudo completar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {aviso && (
        <Alert className="mb-4">
          <ShieldCheck />
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
      )}

      {datos === null && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Consultando…
        </div>
      )}

      {nada && (
        <Card>
          <CardContent className="py-10 text-center">
            <ShieldCheck className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="font-medium text-foreground">No hay nada en curso</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Todas las sincronizaciones y validaciones han terminado.
            </p>
          </CardContent>
        </Card>
      )}

      {lotes.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="size-4 text-muted-foreground" />
              Procesos masivos ({lotes.length})
            </CardTitle>
            <CardDescription>
              Enrolar Estado y validaciones masivas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lotes.map((j) => (
              <div key={j.job} className="rounded-xl border border-border p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={j.modo === 'validacion' ? 'secondary' : 'default'}>
                      {j.modo === 'validacion' ? 'Validación masiva' : 'Enrolar Estado'}
                    </Badge>
                    <span className="text-sm font-medium text-foreground">
                      Lote #{j.job}
                    </span>
                    {!j.vivo && <Badge variant="destructive">Sin respuesta</Badge>}
                    {j.cancelar_solicitado && j.vivo && (
                      <Badge variant="secondary">Cancelando…</Badge>
                    )}
                  </div>
                  {canOperate && (
                    <Button
                      variant={j.vivo ? 'outline' : 'destructive'}
                      size="sm"
                      disabled={cancelando === `lote-${j.job}`}
                      onClick={() => void cancelarLote(j)}
                    >
                      {cancelando === `lote-${j.job}` ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Trash2 />
                      )}
                      {j.vivo ? 'Cancelar' : 'Descartar'}
                    </Button>
                  )}
                </div>

                <Progress value={j.porcentaje} className="h-2" />
                <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {j.procesados} de {j.total} · {j.porcentaje}%
                    {j.error_count > 0 && ` · ${j.error_count} con error`}
                  </span>
                  <span>
                    {j.usuario && `${j.usuario} · `}
                    iniciado {desde(j.creado)} · señal {desde(j.actualizado)}
                  </span>
                </div>

                {!j.vivo && (
                  <p className="mt-2 text-xs text-destructive">
                    Lleva demasiado tiempo sin dar señales: su proceso murió
                    (probablemente un reinicio del servidor). Descártalo y vuelve
                    a lanzarlo.
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {individuales.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="size-4 text-muted-foreground" />
              Televisores individuales ({individuales.length})
            </CardTitle>
            <CardDescription>
              Cambios de estado lanzados desde la ficha de un televisor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {individuales.map((j) => (
              <div key={j.job} className="rounded-xl border border-border p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={j.inhabilitar ? 'destructive' : 'default'}>
                      {j.inhabilitar ? (
                        <>
                          <Lock className="size-3" /> Inhabilitar
                        </>
                      ) : (
                        <>
                          <Unlock className="size-3" /> Habilitar
                        </>
                      )}
                    </Badge>
                    <Link
                      to={`/televisores/${j.televisor_id}`}
                      className="text-sm font-medium text-foreground hover:underline"
                    >
                      {j.serial_number || j.mac_address}
                    </Link>
                    {!j.vivo && <Badge variant="destructive">Sin respuesta</Badge>}
                  </div>
                  {canOperate && (
                    <Button
                      variant={j.vivo ? 'outline' : 'destructive'}
                      size="sm"
                      disabled={cancelando === `ind-${j.job}` || j.vivo}
                      title={
                        j.vivo
                          ? 'No se puede cortar a mitad: espera a que termine'
                          : 'Descartar este job colgado'
                      }
                      onClick={() => void cancelarIndividual(j)}
                    >
                      {cancelando === `ind-${j.job}` ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Trash2 />
                      )}
                      Descartar
                    </Button>
                  )}
                </div>

                <Progress value={j.porcentaje} className="h-2" />
                <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {j.estado} · {j.porcentaje}%
                  </span>
                  <span>
                    {j.usuario && `${j.usuario} · `}
                    iniciado {desde(j.creado)} · señal {desde(j.actualizado)}
                  </span>
                </div>

                {j.vivo ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    En marcha. Un cambio de estado es una sola operación en el
                    portal y no se puede interrumpir a mitad; suele tardar menos
                    de un minuto.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-destructive">
                    Sin señales: su proceso murió. El cambio NO se aplicó en el
                    portal. Descártalo y vuelve a lanzarlo desde la ficha.
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
