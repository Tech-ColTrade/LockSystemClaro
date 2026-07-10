import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowLeftRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  Download,
  FileSpreadsheet,
  Loader2,
  Lock,
  RefreshCw,
  Unlock,
  UploadCloud,
} from 'lucide-react'
import { televisoresApi } from '@/features/televisores/api/televisores.api'
import type {
  BulkSyncItemRecord,
  BulkSyncStatus,
  EnrolarEstadoResult,
} from '@/features/televisores/types'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

const COLUMNAS = [
  { columna: 'mac_address', ejemplo: 'B4:04:29:7E:3A:AA', obligatoria: true },
  { columna: 'estado', ejemplo: 'habilitado / inhabilitado', obligatoria: true },
  { columna: 'serial_number', ejemplo: 'B4:04:29:7E:3A:AA', obligatoria: false },
]

type Tone = 'emerald' | 'primary' | 'violet' | 'destructive' | 'muted'

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  tone: Tone
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-4">
      <span
        className={cn(
          'flex size-10 items-center justify-center rounded-lg',
          tone === 'emerald' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
          tone === 'primary' && 'bg-primary/10 text-primary',
          tone === 'violet' && 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
          tone === 'destructive' && 'bg-destructive/10 text-destructive',
          tone === 'muted' && 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="flex flex-col">
        <span className="text-2xl font-bold tabular-nums text-foreground">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

function ObjetivoBadge({ inhabilitar }: { inhabilitar: boolean }) {
  return inhabilitar ? (
    <Badge variant="destructive">
      <Lock /> Inhabilitar
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    >
      <Unlock /> Habilitar
    </Badge>
  )
}

function ItemResultado({ item }: { item: BulkSyncItemRecord }) {
  if (item.estado === 'ok')
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      >
        <CircleCheck /> {item.mensaje || 'OK'}
      </Badge>
    )
  if (item.estado === 'error')
    return (
      <Badge variant="destructive">
        <CircleX /> {item.mensaje || 'Error'}
      </Badge>
    )
  return (
    <Badge variant="secondary">
      <Loader2 className="animate-spin" /> En proceso…
    </Badge>
  )
}

export function EnrolarEstadoPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<number | null>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [resumen, setResumen] = useState<EnrolarEstadoResult | null>(null)
  const [bulk, setBulk] = useState<BulkSyncStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [])

  function pollBulk(jobId: number) {
    if (pollRef.current) window.clearInterval(pollRef.current)
    pollRef.current = window.setInterval(async () => {
      try {
        const s = await televisoresApi.bulkStatus(jobId)
        setBulk(s)
        if (s.finalizado && pollRef.current) {
          window.clearInterval(pollRef.current)
        }
      } catch {
        // transitorio: seguimos intentando
      }
    }, 1000)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const file = inputRef.current?.files?.[0]
    if (!file) {
      setError('Selecciona un archivo.')
      return
    }
    setError(null)
    setResumen(null)
    setBulk(null)
    setSubiendo(true)
    try {
      const r = await televisoresApi.enrolarEstado(file)
      setResumen(r)
      if (r.job) pollBulk(r.job)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubiendo(false)
    }
  }

  async function cancelar() {
    if (!bulk) return
    setCancelando(true)
    try {
      const s = await televisoresApi.cancelarEnrolarEstado(bulk.id)
      setBulk(s)
      if (s.finalizado && pollRef.current) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCancelando(false)
    }
  }

  async function exportar() {
    if (!bulk) return
    setExportando(true)
    try {
      await televisoresApi.exportarEnrolarEstado(bulk.id)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setExportando(false)
    }
  }

  async function descargarPlantilla() {
    setError(null)
    setDescargando(true)
    try {
      await televisoresApi.plantillaEstados()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setDescargando(false)
    }
  }

  const enProgreso = bulk !== null && !bulk.finalizado

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
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
            <ArrowLeftRight className="size-5" />
          </span>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-lg font-bold text-foreground">Enrolar estado</h1>
            <p className="text-sm text-muted-foreground">
              Fija el estado en masa y sincroniza el portal remoto.
            </p>
          </div>
        </div>
      </div>

      {/* Resumen de importación */}
      {resumen && (
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle>Resultado de la importación</CardTitle>
            <CardDescription>Resumen del último archivo procesado.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Creados" value={resumen.creados} icon={CircleCheck} tone="emerald" />
              <Stat
                label="Actualizados"
                value={resumen.actualizados}
                icon={RefreshCw}
                tone="primary"
              />
              <Stat
                label="Con cambio"
                value={resumen.cambios}
                icon={ArrowLeftRight}
                tone="violet"
              />
              <Stat
                label="Con error"
                value={resumen.errores.length}
                icon={CircleX}
                tone={resumen.errores.length > 0 ? 'destructive' : 'muted'}
              />
            </div>

            {resumen.errores.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-destructive/30 bg-destructive/5">
                <div className="flex items-center gap-2 border-b border-destructive/20 px-4 py-2 text-sm font-medium text-destructive">
                  <CircleAlert className="size-4" /> {resumen.errores.length} fila(s) con
                  error
                </div>
                <div className="max-h-40 divide-y divide-destructive/10 overflow-auto">
                  {resumen.errores.map((e, i) => (
                    <div key={i} className="px-4 py-1.5 text-sm text-destructive/90">
                      {e}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resumen.job === null && (
              <p className="text-sm text-muted-foreground">
                No hubo cambios de estado que sincronizar con el portal.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Progreso de la sincronización masiva */}
      {bulk && (
        <Card>
          <CardHeader className="border-b pb-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                {enProgreso ? (
                  <>
                    <Loader2 className="size-4 animate-spin text-primary" />
                    Sincronizando con el portal…
                  </>
                ) : bulk.estado === 'terminado' ? (
                  <>
                    <CircleCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                    Sincronización completada
                  </>
                ) : bulk.estado === 'cancelado' ? (
                  <>
                    <CircleX className="size-4 text-muted-foreground" />
                    Sincronización cancelada
                  </>
                ) : (
                  <>
                    <CircleAlert className="size-4 text-destructive" />
                    Sincronización con errores
                  </>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="tabular-nums">
                  {bulk.procesados}/{bulk.total}
                </Badge>
                {enProgreso && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={cancelar}
                    disabled={cancelando}
                  >
                    {cancelando ? (
                      <Loader2 className="animate-spin" data-icon="inline-start" />
                    ) : (
                      <CircleX data-icon="inline-start" />
                    )}
                    {cancelando ? 'Cancelando…' : 'Cancelar'}
                  </Button>
                )}
                {bulk.finalizado && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={exportar}
                    disabled={exportando}
                  >
                    {exportando ? (
                      <Loader2 className="animate-spin" data-icon="inline-start" />
                    ) : (
                      <Download data-icon="inline-start" />
                    )}
                    {exportando ? 'Exportando…' : 'Exportar Excel'}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-end justify-between gap-3">
              <div
                className={cn(
                  'text-4xl font-extrabold tabular-nums',
                  bulk.finalizado && bulk.estado !== 'terminado'
                    ? 'text-destructive'
                    : bulk.estado === 'terminado'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-primary',
                )}
              >
                {bulk.porcentaje}%
              </div>
              {bulk.finalizado && (
                <div className="flex gap-2">
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  >
                    <CircleCheck /> OK: {bulk.ok_count}
                  </Badge>
                  {bulk.error_count > 0 && (
                    <Badge variant="destructive">
                      <CircleX /> Error: {bulk.error_count}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <Progress
              value={bulk.porcentaje}
              className={cn(
                'w-full [&_[data-slot=progress-track]]:h-2.5',
                bulk.finalizado &&
                  bulk.estado !== 'terminado' &&
                  '[&_[data-slot=progress-indicator]]:bg-destructive',
                bulk.estado === 'terminado' &&
                  '[&_[data-slot=progress-indicator]]:bg-emerald-500',
              )}
            />

            {bulk.items.length > 0 && (
              <div className="max-h-96 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>MAC</TableHead>
                      <TableHead>Objetivo</TableHead>
                      <TableHead>Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulk.items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="font-mono text-foreground">
                          {it.mac_address}
                        </TableCell>
                        <TableCell>
                          <ObjetivoBadge inhabilitar={it.inhabilitar} />
                        </TableCell>
                        <TableCell>
                          <ItemResultado item={it} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Formulario de carga */}
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle>Subir archivo</CardTitle>
          <CardDescription>
            Sube un <b>Excel (.xlsx)</b> o <b>CSV</b> con el estado de cada televisor. Se
            fija el estado y, para los que cambian, se sincroniza el portal remoto
            automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Especificación de columnas */}
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Columna</TableHead>
                  <TableHead>Ejemplo</TableHead>
                  <TableHead>Obligatoria</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {COLUMNAS.map((c) => (
                  <TableRow key={c.columna}>
                    <TableCell className="font-mono text-foreground">{c.columna}</TableCell>
                    <TableCell className="text-muted-foreground">{c.ejemplo}</TableCell>
                    <TableCell>
                      {c.obligatoria ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        >
                          Sí
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">No</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>No se pudo procesar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {/* Zona de carga */}
            <label
              htmlFor="archivo"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 px-6 py-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/40"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                {fileName ? (
                  <FileSpreadsheet className="size-6" />
                ) : (
                  <UploadCloud className="size-6" />
                )}
              </span>
              {fileName ? (
                <>
                  <span className="text-sm font-medium text-foreground">{fileName}</span>
                  <span className="text-xs text-muted-foreground">
                    Haz clic para cambiar el archivo
                  </span>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-foreground">
                    Haz clic para seleccionar un archivo
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Excel (.xlsx) o CSV
                  </span>
                </>
              )}
              <input
                id="archivo"
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="sr-only"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={subiendo || enProgreso}>
                {(subiendo || enProgreso) && (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                )}
                {subiendo
                  ? 'Importando…'
                  : enProgreso
                    ? 'Sincronizando…'
                    : 'Importar y sincronizar'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={descargarPlantilla}
                disabled={descargando}
              >
                {descargando ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <Download data-icon="inline-start" />
                )}
                {descargando ? 'Descargando…' : 'Descargar plantilla Excel'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
