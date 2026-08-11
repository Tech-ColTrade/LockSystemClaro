// Historial de cambios en los DATOS de los televisores (serial, MAC, crédito).
//
// No incluye los cambios de estado: esos viven en /sincronizaciones. Mezclarlos
// haría que el ruido de la operación diaria tapara las correcciones de datos,
// que es lo que esta pantalla existe para auditar.

import { useEffect, useState } from 'react'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  Search,
  X,
} from 'lucide-react'
import { registrosApi } from '@/features/televisores/api/registros.api'
import { televisoresApi } from '@/features/televisores/api/televisores.api'
import type { CampoCambio } from '@/features/televisores/types'
import { usePaginatedList } from '@/shared/hooks/usePaginatedList'
import { RangoFechas } from '@/shared/components/RangoFechas'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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

/** Filtros por campo, en el orden en que se muestran. */
const CAMPOS: { valor: CampoCambio | ''; etiqueta: string }[] = [
  { valor: '', etiqueta: 'Todos los campos' },
  { valor: 'serial_number', etiqueta: 'Serial' },
  { valor: 'mac_address', etiqueta: 'MAC' },
  { valor: 'numero_credito', etiqueta: 'Crédito' },
]

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

function OrigenBadge({ origen, texto }: { origen: string; texto: string }) {
  return origen === 'masivo' ? (
    <Badge variant="secondary">{texto}</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      {texto}
    </Badge>
  )
}

export function HistorialPage() {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  // `query` es lo que se escribe; `buscar` lo que se consulta. Separarlos evita
  // una petición por cada tecla.
  const [query, setQuery] = useState('')
  const [buscar, setBuscar] = useState('')
  const [campo, setCampo] = useState<CampoCambio | ''>('')

  const { items, count, page, setPage, loading, error } = usePaginatedList(
    ['cambios', { desde, hasta, buscar, campo }],
    (page) => registrosApi.cambios(page, { desde, hasta, buscar, campo }),
  )

  const [exportando, setExportando] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const pageError = error ?? exportError
  const hayFiltro = Boolean(desde || hasta || buscar || campo)

  // Al cambiar los filtros cambia el número de páginas: quedarse en la 5 de un
  // resultado que ahora tiene 2 mostraría una tabla vacía.
  useEffect(() => {
    setPage(1)
  }, [desde, hasta, buscar, campo, setPage])

  function limpiar() {
    setDesde('')
    setHasta('')
    setQuery('')
    setBuscar('')
    setCampo('')
  }

  async function exportar() {
    setExportError(null)
    setExportando(true)
    try {
      await televisoresApi.exportarCambios({ desde, hasta, buscar, campo })
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
            Historial
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Cambios en los datos de los televisores: serial, dirección MAC y
            número de crédito.
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
            {exportando ? 'Exportando...' : 'Exportar'}
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setBuscar(query.trim())
          }}
          className="flex max-w-sm flex-1 gap-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar serial, MAC o crédito…"
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="outline">
            Buscar
          </Button>
        </form>

        {/* Filtro por campo: son tres opciones, así que botones sueltos se leen
            más rápido que un desplegable. */}
        <div className="flex flex-wrap gap-1.5">
          {CAMPOS.map((c) => (
            <Button
              key={c.valor || 'todos'}
              type="button"
              size="sm"
              variant={campo === c.valor ? 'secondary' : 'ghost'}
              aria-pressed={campo === c.valor}
              onClick={() => setCampo(c.valor)}
            >
              {c.etiqueta}
            </Button>
          ))}
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
          {count === 0 ? 'Sin registros' : `${count} cambio${count === 1 ? '' : 's'}`}
          {hayFiltro && ' con los filtros aplicados'} · la exportación incluye lo
          mismo que ves
        </p>
      )}

      <Card className="gap-0 overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Número de serial</TableHead>
              <TableHead>Dirección MAC</TableHead>
              <TableHead>Campo</TableHead>
              <TableHead>Cambio</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Usuario</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {hayFiltro
                    ? 'No hay cambios que coincidan con los filtros.'
                    : 'Aún no se ha modificado ningún televisor.'}
                </TableCell>
              </TableRow>
            ) : (
              items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground">
                    {fecha(c.creado)}
                  </TableCell>
                  <TableCell className="font-mono font-medium text-foreground">
                    {c.serial_number || '—'}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {c.mac_address || '—'}
                  </TableCell>
                  <TableCell>{c.campo_display}</TableCell>
                  <TableCell>
                    {/* Antes → después en la misma celda: el cambio se entiende
                        de un vistazo, sin cruzar dos columnas. */}
                    <span className="flex items-center gap-1.5 font-mono text-xs">
                      <span className="text-muted-foreground line-through">
                        {c.valor_anterior || '—'}
                      </span>
                      <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                      <span className="font-medium text-foreground">
                        {c.valor_nuevo || '—'}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <OrigenBadge origen={c.origen} texto={c.origen_display} />
                  </TableCell>
                  <TableCell>{c.usuario}</TableCell>
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
