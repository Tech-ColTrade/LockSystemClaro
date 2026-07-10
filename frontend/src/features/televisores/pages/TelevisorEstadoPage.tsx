import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Ban,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  Loader2,
  Lock,
  SlidersHorizontal,
  Unlock,
} from 'lucide-react'
import { televisoresApi } from '@/features/televisores/api/televisores.api'
import type { SyncJobRecord, Televisor } from '@/features/televisores/types'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

function fecha(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
}

function EstadoBadge({ inhabilitado }: { inhabilitado: boolean }) {
  return inhabilitado ? (
    <Badge variant="destructive">
      <Ban /> Inhabilitado
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    >
      <CircleCheck /> Habilitado
    </Badge>
  )
}

function ResultadoBadge({ estado }: { estado: SyncJobRecord['estado'] }) {
  if (estado === 'terminado')
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      >
        <CircleCheck /> Aplicado
      </Badge>
    )
  if (estado === 'error')
    return (
      <Badge variant="destructive">
        <CircleX /> Error
      </Badge>
    )
  return (
    <Badge variant="secondary">
      <Clock /> En proceso
    </Badge>
  )
}

type SyncPhase = 'idle' | 'running' | 'ok' | 'error'
interface SyncState {
  phase: SyncPhase
  pct: number
  titulo: string
  texto: string
}
const SYNC_IDLE: SyncState = { phase: 'idle', pct: 0, titulo: '', texto: '' }

export function TelevisorEstadoPage() {
  const { id } = useParams()
  const [tv, setTv] = useState<Televisor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [seleccion, setSeleccion] = useState<'habilitado' | 'inhabilitado'>(
    'habilitado',
  )
  const [historial, setHistorial] = useState<SyncJobRecord[]>([])
  const [sync, setSync] = useState<SyncState>(SYNC_IDLE)
  const pollRef = useRef<number | null>(null)

  const cargarHistorial = useCallback(async () => {
    if (!id) return
    try {
      setHistorial(await televisoresApi.historial(id))
    } catch {
      // el histórico es secundario; si falla, no bloqueamos la página
    }
  }, [id])

  useEffect(() => {
    let active = true
    televisoresApi
      .get(id!)
      .then((data) => {
        if (!active) return
        setTv(data)
        setSeleccion(data.inhabilitado ? 'inhabilitado' : 'habilitado')
      })
      .catch((e) => active && setError((e as Error).message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [id])

  useEffect(() => {
    cargarHistorial()
  }, [cargarHistorial])

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [])

  function pollJob(jobId: number, inhabilitar: boolean) {
    if (pollRef.current) window.clearInterval(pollRef.current)
    pollRef.current = window.setInterval(async () => {
      try {
        const s = await televisoresApi.syncStatus(id!, jobId)
        setSync((prev) =>
          prev.phase === 'running'
            ? { ...prev, pct: Math.max(prev.pct, s.porcentaje) }
            : prev,
        )
        if (s.finalizado) {
          if (pollRef.current) window.clearInterval(pollRef.current)
          cargarHistorial()
          if (s.estado === 'terminado') {
            setSync({
              phase: 'ok',
              pct: 100,
              titulo: 'Cambio aplicado',
              texto: inhabilitar
                ? 'Televisor inhabilitado (bloqueado) en el portal remoto.'
                : 'Televisor habilitado (desbloqueado) en el portal remoto.',
            })
          } else {
            setSync({
              phase: 'error',
              pct: 100,
              titulo: 'No se pudo aplicar',
              texto: s.error || 'Error en la sincronización con el portal.',
            })
          }
        }
      } catch {
        // error transitorio: seguimos intentando
      }
    }, 1000)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    const inhabilitar = seleccion === 'inhabilitado'
    setSync({
      phase: 'running',
      pct: 5,
      titulo: 'Sincronizando con el portal',
      texto: 'Aplicando el cambio en el portal remoto…',
    })
    try {
      const launch = await televisoresApi.setEstado(id, inhabilitar)
      setTv((t) => (t ? { ...t, inhabilitado: launch.inhabilitado } : t))
      pollJob(launch.job, inhabilitar)
    } catch (err) {
      setSync({
        phase: 'error',
        pct: 100,
        titulo: 'No se pudo iniciar',
        texto: (err as Error).message,
      })
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <Skeleton className="h-8 w-44" />
        <Card>
          <CardHeader className="border-b pb-4">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="flex gap-3">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-24" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !tv) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>No se pudo cargar</AlertTitle>
          <AlertDescription>{error ?? 'Televisor no encontrado.'}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          render={<Link to="/televisores" />}
        >
          <ArrowLeft data-icon="inline-start" /> Volver
        </Button>
      </div>
    )
  }

  const ejecutando = sync.phase === 'running'
  const objetivoInhabilitar = seleccion === 'inhabilitado'
  const sinCambios = objetivoInhabilitar === tv.inhabilitado

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      {/* Encabezado */}
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit text-muted-foreground"
          render={<Link to={`/televisores/${tv.id}`} />}
        >
          <ArrowLeft data-icon="inline-start" /> Volver al detalle
        </Button>

        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <SlidersHorizontal className="size-5" />
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-bold text-foreground">Estado del televisor</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono text-foreground">{tv.mac_address}</span>
              <span>·</span>
              <EstadoBadge inhabilitado={tv.inhabilitado} />
            </div>
          </div>
        </div>
      </div>

      {/* Registrar estado */}
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle>Registrar estado</CardTitle>
          <CardDescription>
            Al guardar se aplica el cambio en el portal remoto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={guardar} className="flex flex-col gap-5">
            <ToggleGroup
              value={[seleccion]}
              onValueChange={(v) => {
                const next = v[0] as 'habilitado' | 'inhabilitado' | undefined
                if (next) setSeleccion(next)
              }}
              variant="outline"
              size="lg"
              spacing={0}
              disabled={ejecutando}
              className="w-full max-w-md"
            >
              <ToggleGroupItem
                value="habilitado"
                className="flex-1 data-[state=on]:border-emerald-500/40 data-[state=on]:bg-emerald-500/10 data-[state=on]:text-emerald-600 dark:data-[state=on]:text-emerald-400"
              >
                <Unlock data-icon="inline-start" /> Habilitado
              </ToggleGroupItem>
              <ToggleGroupItem
                value="inhabilitado"
                className="flex-1 data-[state=on]:border-destructive/40 data-[state=on]:bg-destructive/10 data-[state=on]:text-destructive"
              >
                <Lock data-icon="inline-start" /> Inhabilitado
              </ToggleGroupItem>
            </ToggleGroup>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={ejecutando || sinCambios}>
                {ejecutando && <Loader2 className="animate-spin" data-icon="inline-start" />}
                {ejecutando ? 'Sincronizando…' : 'Guardar y sincronizar'}
              </Button>
              {sinCambios && (
                <span className="text-xs text-muted-foreground">
                  El televisor ya está {objetivoInhabilitar ? 'inhabilitado' : 'habilitado'}.
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Progreso de la sincronización (polling real) */}
      {sync.phase !== 'idle' && (
        <Card className="py-4">
          <CardContent className="flex flex-col gap-3 px-4">
            <div className="flex items-center gap-3">
              {ejecutando && <Loader2 className="size-4 shrink-0 animate-spin text-primary" />}
              {sync.phase === 'ok' && (
                <CircleCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              )}
              {sync.phase === 'error' && (
                <CircleX className="size-4 shrink-0 text-destructive" />
              )}

              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {sync.titulo}
              </span>

              <span
                className={cn(
                  'text-sm font-semibold tabular-nums',
                  sync.phase === 'error'
                    ? 'text-destructive'
                    : sync.phase === 'ok'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-muted-foreground',
                )}
              >
                {Math.round(sync.pct)}%
              </span>

              {!ejecutando && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-mr-1 h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => setSync(SYNC_IDLE)}
                >
                  Cerrar
                </Button>
              )}
            </div>

            <Progress
              value={sync.pct}
              className={cn(
                'w-full [&_[data-slot=progress-track]]:h-1',
                sync.phase === 'error' &&
                  '[&_[data-slot=progress-indicator]]:bg-destructive',
                sync.phase === 'ok' &&
                  '[&_[data-slot=progress-indicator]]:bg-emerald-500',
              )}
            />

            {sync.phase !== 'running' && (
              <p className="text-xs text-muted-foreground">{sync.texto}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Histórico de cambios */}
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle>Histórico de cambios</CardTitle>
          <CardDescription>
            Registro de sincronizaciones de estado con el portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historial.length > 0 ? (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historial.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-muted-foreground">
                        {fecha(h.creado)}
                      </TableCell>
                      <TableCell>
                        <EstadoBadge inhabilitado={h.inhabilitar} />
                      </TableCell>
                      <TableCell>
                        <ResultadoBadge estado={h.estado} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Clock className="size-8 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                Aún no hay cambios de estado registrados.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
