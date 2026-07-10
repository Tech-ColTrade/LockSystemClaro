import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  Download,
} from 'lucide-react'
import { televisoresApi } from '@/features/televisores/api/televisores.api'
import { usePaginatedList } from '@/shared/hooks/usePaginatedList'
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

export function TelevisorSincronizacionesPage() {
  const { id } = useParams()
  const fetcher = useCallback(
    (page: number) => televisoresApi.sincronizacionesDeTV(id!, page),
    [id],
  )
  const { items, count, page, setPage, loading, error } = usePaginatedList(fetcher)

  const [exportando, setExportando] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const pageError = error ?? exportError

  async function exportar() {
    if (!id) return
    setExportError(null)
    setExportando(true)
    try {
      await televisoresApi.exportarSincronizacionesDeTV(id)
    } catch (e) {
      setExportError((e as Error).message)
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      {/* Encabezado */}
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit text-muted-foreground"
          render={<Link to={`/televisores/${id}`} />}
        >
          <ArrowLeft data-icon="inline-start" /> Volver al detalle
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-foreground">Sincronizaciones</h1>
            <Badge variant="secondary" className="tabular-nums">
              {count}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportar}
            disabled={exportando || count === 0}
          >
            <Download data-icon="inline-start" />
            {exportando ? 'Exportando...' : 'Exportar Excel'}
          </Button>
        </div>
      </div>

      {pageError && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Ocurrió un problema</AlertTitle>
          <AlertDescription>{pageError}</AlertDescription>
        </Alert>
      )}

      <Card className="gap-0 overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead>Tipo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full max-w-36" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  Este televisor aún no tiene sincronizaciones.
                </TableCell>
              </TableRow>
            ) : (
              items.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground">{fecha(s.fecha)}</TableCell>
                  <TableCell>{s.accion}</TableCell>
                  <TableCell>
                    <ResultadoBadge resultado={s.resultado} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.tipo}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
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
