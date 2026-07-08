import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
} from 'lucide-react'
import { registrosApi } from '@/features/televisores/api/registros.api'
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

export function SincronizacionesPage() {
  const { items, count, page, setPage, loading, error } = usePaginatedList(
    registrosApi.sincronizaciones,
  )

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Sincronizaciones
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Historial de cambios de estado sincronizados con el portal remoto.
        </p>
      </div>

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
              <TableHead>Fecha</TableHead>
              <TableHead>Dirección MAC</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead>Tipo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
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
                  Aún no hay sincronizaciones registradas.
                </TableCell>
              </TableRow>
            ) : (
              items.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground">{fecha(s.fecha)}</TableCell>
                  <TableCell className="font-mono font-medium text-foreground">
                    {s.mac_address}
                  </TableCell>
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
