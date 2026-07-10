import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleX,
  Download,
  Eye,
  ListChecks,
  Loader2,
  Lock,
  LockOpen,
  Plus,
  ShieldCheck,
  SquarePen,
  Upload,
} from 'lucide-react'
import { televisoresApi } from '@/features/televisores/api/televisores.api'
import { usePermissions } from '@/features/auth/usePermissions'
import type { BulkSyncStatus, Televisor } from '@/features/televisores/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const PAGE_SIZE = 10

function EstadoBadge({ inhabilitado }: { inhabilitado: boolean }) {
  return inhabilitado ? (
    <Badge variant="secondary">
      <Lock />
      Inhabilitado
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      <LockOpen />
      Habilitado
    </Badge>
  )
}

export function TelevisoresPage() {
  const { canOperate } = usePermissions()
  const [items, setItems] = useState<Televisor[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [valJob, setValJob] = useState<BulkSyncStatus | null>(null)
  const [validando, setValidando] = useState(false)
  const [cancelandoVal, setCancelandoVal] = useState(false)
  const [exportandoVal, setExportandoVal] = useState(false)
  const valPollRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (valPollRef.current) window.clearInterval(valPollRef.current)
    }
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    televisoresApi
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

  async function validacionMasiva() {
    setError(null)
    setValidando(true)
    setValJob(null)
    try {
      const { job } = await televisoresApi.validarMasivo()
      if (valPollRef.current) window.clearInterval(valPollRef.current)
      valPollRef.current = window.setInterval(async () => {
        try {
          const s = await televisoresApi.validarMasivoStatus(job)
          setValJob(s)
          if (s.finalizado && valPollRef.current) {
            window.clearInterval(valPollRef.current)
            setValidando(false)
          }
        } catch {
          // transitorio
        }
      }, 1000)
    } catch (e) {
      setError((e as Error).message)
      setValidando(false)
    }
  }

  async function cancelarValidacion() {
    if (!valJob) return
    setCancelandoVal(true)
    try {
      const s = await televisoresApi.cancelarValidarMasivo(valJob.id)
      setValJob(s)
      if (s.finalizado && valPollRef.current) {
        window.clearInterval(valPollRef.current)
        valPollRef.current = null
        setValidando(false)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCancelandoVal(false)
    }
  }

  async function exportarValidacion() {
    if (!valJob) return
    setExportandoVal(true)
    try {
      await televisoresApi.exportarValidarMasivo(valJob.id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setExportandoVal(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Televisores</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Parque de dispositivos, estados y reportes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canOperate && (
            <>
              <Button variant="outline" onClick={validacionMasiva} disabled={validando}>
                {validando ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                {validando ? 'Validando…' : 'Validación masiva'}
              </Button>
              <Button variant="outline" render={<Link to="/televisores/importar" />}>
                <Upload />
                Enrolar Televisores
              </Button>
              <Button variant="outline" render={<Link to="/televisores/enrolar-estado" />}>
                <ListChecks />
                Enrolar Estado
              </Button>
            </>
          )}
          {canOperate && (
            <Button render={<Link to="/televisores/nuevo" />}>
              <Plus />
              Nuevo
            </Button>
          )}
        </div>
      </div>

      <form onSubmit={onSearch} className="mb-4 flex max-w-sm gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar MAC, serial, crédito…"
        />
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <CircleAlert />
          <AlertTitle>Ocurrió un problema</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="gap-0 overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número de serial</TableHead>
              <TableHead>Dirección MAC</TableHead>
              <TableHead>N° Crédito</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full max-w-36" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  {search ? (
                    <>No se encontraron televisores para “{search}”.</>
                  ) : (
                    <>
                      Aún no hay televisores registrados.{' '}
                      {canOperate && (
                        <Link to="/televisores/nuevo" className="font-medium underline">
                          Crea el primero
                        </Link>
                      )}
                    </>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              items.map((tv) => (
                <TableRow key={tv.id}>
                  <TableCell className="font-medium">
                    <Link to={`/televisores/${tv.id}`} className="hover:underline">
                      {tv.serial_number || '—'}
                    </Link>
                  </TableCell>
                  <TableCell>{tv.mac_address}</TableCell>
                  <TableCell className="break-all">{tv.numero_credito || '—'}</TableCell>
                  <TableCell>
                    <EstadoBadge inhabilitado={tv.inhabilitado} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {canOperate ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            render={<Link to={`/televisores/${tv.id}/estado`} />}
                          >
                            Estado
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            render={<Link to={`/televisores/${tv.id}/editar`} />}
                          >
                            <SquarePen />
                            Editar
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          render={<Link to={`/televisores/${tv.id}`} />}
                        >
                          <Eye />
                          Ver
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span>
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Anterior"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Siguiente"
          >
            <ChevronRight />
          </Button>
        </div>
      )}

      {/* Modal de validación masiva */}
      <Dialog
        open={!!valJob}
        onOpenChange={(open) => {
          if (!open && valJob?.finalizado) setValJob(null)
        }}
      >
        <DialogContent showCloseButton={!!valJob?.finalizado} className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {valJob?.estado === 'cancelado'
                ? 'Validación cancelada'
                : valJob?.finalizado
                  ? 'Validación completada'
                  : 'Validando con el portal…'}
            </DialogTitle>
            <DialogDescription>
              {valJob ? `${valJob.procesados}/${valJob.total} procesados` : ''}
            </DialogDescription>
          </DialogHeader>

          {valJob && (
            <div className="space-y-4">
              <div>
                <div className="mb-1 text-3xl font-bold tabular-nums text-foreground">
                  {valJob.porcentaje}%
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${valJob.porcentaje}%` }}
                  />
                </div>
              </div>

              {valJob.finalizado && (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Coinciden: {valJob.ok_count}</Badge>
                  {valJob.error_count > 0 && (
                    <Badge variant="outline">A sincronizar: {valJob.error_count}</Badge>
                  )}
                </div>
              )}

              {valJob.items.length > 0 && (
                <div className="max-h-[45vh] overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>MAC</TableHead>
                        <TableHead>Portal</TableHead>
                        <TableHead>App</TableHead>
                        <TableHead>Coincide</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {valJob.items.map((it) => (
                        <TableRow key={it.id}>
                          <TableCell className="font-medium">{it.mac_address}</TableCell>
                          <TableCell>
                            {it.remoto_inhabilitado === null
                              ? '—'
                              : it.remoto_inhabilitado
                                ? 'Inhabilitado'
                                : 'Habilitado'}
                          </TableCell>
                          <TableCell>
                            {it.local_inhabilitado === null
                              ? '—'
                              : it.local_inhabilitado
                                ? 'Inhabilitado'
                                : 'Habilitado'}
                          </TableCell>
                          <TableCell>
                            {it.coincide === true ? (
                              <Badge variant="secondary">Sí</Badge>
                            ) : it.estado === 'error' && it.coincide === null ? (
                              <Badge variant="outline">Error</Badge>
                            ) : it.coincide === false ? (
                              <Badge variant="outline">No</Badge>
                            ) : (
                              <Badge variant="outline">…</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {valJob && !valJob.finalizado && (
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={cancelarValidacion}
                disabled={cancelandoVal}
              >
                {cancelandoVal ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <CircleX data-icon="inline-start" />
                )}
                {cancelandoVal ? 'Cancelando…' : 'Cancelar'}
              </Button>
            </DialogFooter>
          )}

          {valJob?.finalizado && (
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={exportarValidacion}
                disabled={exportandoVal}
              >
                {exportandoVal ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <Download data-icon="inline-start" />
                )}
                {exportandoVal ? 'Exportando…' : 'Exportar Excel'}
              </Button>
              <Button onClick={() => setValJob(null)}>Cerrar</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
