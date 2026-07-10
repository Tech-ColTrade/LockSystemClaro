import { useCallback, useEffect, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  Download,
  X,
} from 'lucide-react'
import { registrosApi } from '@/features/televisores/api/registros.api'
import { televisoresApi } from '@/features/televisores/api/televisores.api'
import { usePaginatedList } from '@/shared/hooks/usePaginatedList'
import { RangoFechas } from '@/shared/components/RangoFechas'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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

function fecha(iso: string): string {
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

function ResultadoBadge({ resultado }: { resultado: string }) {
  if (resultado === 'Aplicado')
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      >
        <CircleCheck /> {resultado}
      </Badge>
    )
  if (resultado === 'Error')
    return (
      <Badge variant="destructive">
        <CircleX /> {resultado}
      </Badge>
    )
  return (
    <Badge variant="secondary">
      <Clock /> {resultado}
    </Badge>
  )
}

export function SincronizacionesPage() {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  // useCallback: usePaginatedList tiene el fetcher como dependencia del efecto,
  // así que sin memoizar recargaría en cada render.
  const fetcher = useCallback(
    (page: number) => registrosApi.sincronizaciones(page, { desde, hasta }),
    [desde, hasta],
  )
  const { items, count, page, setPage, loading, error } = usePaginatedList(fetcher)

  const [exportando, setExportando] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const pageError = error ?? exportError
  const hayFiltro = Boolean(desde || hasta)

  // Al cambiar el rango cambia el número de páginas: quedarse en la 5 de un
  // resultado que ahora tiene 2 mostraría una tabla vacía.
  useEffect(() => {
    setPage(1)
  }, [desde, hasta, setPage])

  function limpiar() {
    setDesde('')
    setHasta('')
  }

  async function exportar() {
    setExportError(null)
    setExportando(true)
    try {
      await televisoresApi.exportarSincronizaciones({ desde, hasta })
    } catch (e) {
      setExportError((e as Error).message)
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Sincronizaciones
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Historial de cambios de estado sincronizados con el portal remoto.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangoFechas
            desde={desde}
            hasta={hasta}
            setDesde={setDesde}
            setHasta={setHasta}
          />
          {hayFiltro && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={limpiar}
            >
              <X data-icon="inline-start" />
              Limpiar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportar} disabled={exportando}>
            <Download data-icon="inline-start" />
            {exportando ? 'Exportando...' : 'Sincronizaciones'}
          </Button>
        </div>
      </div>

      {pageError && (
        <Alert variant="destructive" className="mb-4">
          <CircleAlert />
          <AlertTitle>Ocurrió un problema</AlertTitle>
          <AlertDescription>{pageError}</AlertDescription>
        </Alert>
      )}

      {!loading && (
        <p className="mb-3 text-xs text-muted-foreground">
          {count === 0
            ? 'Sin registros'
            : `${count} registro${count === 1 ? '' : 's'}`}
          {hayFiltro && ' en el rango seleccionado'} · la exportación incluye todos
        </p>
      )}

      <Card className="gap-0 overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Número de serial</TableHead>
              <TableHead>Dirección MAC</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Resultado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full max-w-36" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {hayFiltro
                    ? 'No hay sincronizaciones en ese rango de fechas.'
                    : 'Aún no hay sincronizaciones registradas.'}
                </TableCell>
              </TableRow>
            ) : (
              items.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground">{fecha(s.fecha)}</TableCell>
                  <TableCell className="font-mono font-medium text-foreground">
                    {s.serial_number || '—'}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {s.mac_address}
                  </TableCell>
                  <TableCell>{s.usuario || '—'}</TableCell>
                  <TableCell>{s.accion}</TableCell>
                  <TableCell>
                    <ResultadoBadge resultado={s.resultado} />
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
            onClick={() => setPage(page - 1)}
            aria-label="Anterior"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            aria-label="Siguiente"
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  )
}
