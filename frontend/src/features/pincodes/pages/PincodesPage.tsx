import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, CircleAlert, Download, X } from 'lucide-react'
import { registrosApi } from '@/features/televisores/api/registros.api'
import { televisoresApi } from '@/features/televisores/api/televisores.api'
import { usePaginatedList } from '@/shared/hooks/usePaginatedList'
import { RangoFechas } from '@/shared/components/RangoFechas'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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

export function PincodesPage() {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  // useCallback: usePaginatedList tiene el fetcher como dependencia del efecto,
  // así que sin memoizar recargaría en cada render.
  const fetcher = useCallback(
    (page: number) => registrosApi.pincodes(page, { desde, hasta }),
    [desde, hasta],
  )
  const { items, count, page, setPage, loading, error } = usePaginatedList(fetcher)

  const [exportando, setExportando] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const pageError = error ?? exportError
  const hayFiltro = Boolean(desde || hasta)

  // Al cambiar el rango, el número de páginas cambia: quedarse en la página 5
  // de un resultado que ahora tiene 2 mostraría una tabla vacía.
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
      await televisoresApi.exportarPincodes({ desde, hasta })
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Códigos Pin</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Códigos Pin/Acceso que se han usado a través de la app.
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
            {exportando ? 'Exportando...' : 'Códigos Pin'}
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
              <TableHead>Código de Acceso</TableHead>
              <TableHead>Código Pin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: PAGE_SIZE }).map((_, i) => (
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
                  {hayFiltro
                    ? 'No hay Códigos Pin usados en ese rango de fechas.'
                    : 'Aún no se ha usado ningún Código Pin.'}
                </TableCell>
              </TableRow>
            ) : (
              items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">{fecha(p.creado)}</TableCell>
                  <TableCell className="font-mono font-medium text-foreground">
                    {p.serial_number || '—'}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {p.mac_address}
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">{p.passcode}</TableCell>
                  <TableCell className="font-mono tabular-nums font-medium text-foreground">
                    {p.pin_code}
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
