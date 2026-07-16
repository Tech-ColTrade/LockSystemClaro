// Constructor de reportes: el usuario elige un ORIGEN y, o bien lista sus
// columnas (modo lista), o cuenta registros por una dimensión (modo agrupado).
// Filtra, previsualiza exactamente lo que va a exportar y descarga el Excel.
//
// Además puede GUARDAR la configuración (privada por usuario) para reutilizarla:
// tras exportar, si es nueva, se ofrece guardarla con un nombre. El menú
// "Guardados" permite volver a cargar cualquiera y exportarla.
//
// Layout: barra de configuración colapsable (secciones y colapso maestro)
// arriba + tabla a todo el ancho abajo. Es solo lectura; la seguridad (lista
// blanca de campos/dimensiones, del usuario solo el nombre) la impone el backend.

import { useEffect, useMemo, useState } from 'react'
import {
  Bookmark,
  ChevronDown,
  CircleAlert,
  Database,
  FileSpreadsheet,
  ListTree,
  Loader2,
  Rows3,
  Save,
  TableProperties,
  Trash2,
} from 'lucide-react'
import {
  useCrearGuardado,
  useEliminarGuardado,
  useReportePreview,
  useReportesGuardados,
  useReportesMeta,
} from '@/features/reportes/api/reportes.queries'
import {
  reportesApi,
  type OrigenMeta,
  type ReporteDef,
  type ReporteFiltros,
  type ReporteGuardado,
  type ReporteModo,
} from '@/features/reportes/api/reportes.api'
import { ApiError } from '@/lib/http/errors'
import { RangoFechas } from '@/shared/components/RangoFechas'
import { Paginacion } from '@/shared/components/Paginacion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

const INHAB_LABELS: Record<string, string> = {
  todos: 'Todos los estados',
  true: 'Inhabilitados',
  false: 'Habilitados',
}

const FILTROS_VACIOS: ReporteFiltros = { desde: '', hasta: '', inhabilitado: '', q: '' }

function fmtCelda(v: string | number): string {
  return typeof v === 'number' ? v.toLocaleString('es-CO') : v
}

/** Clave canónica de una definición: identifica si dos configuraciones son la
 *  misma (para no volver a pedir guardar algo ya guardado). */
function defKey(d: ReporteDef): string {
  const f = d.filtros ?? {}
  return JSON.stringify({
    origen: d.origen,
    modo: d.modo,
    campos: d.modo === 'lista' ? d.campos : [],
    dimension: d.modo === 'agrupado' ? d.dimension : '',
    filtros: {
      desde: f.desde || '',
      hasta: f.hasta || '',
      inhabilitado: f.inhabilitado || '',
      q: (f.q || '').trim(),
    },
  })
}

function resumenDef(d: ReporteDef, origenes: OrigenMeta[]): string {
  const label = origenes.find((o) => o.key === d.origen)?.label ?? d.origen
  return `${label} · ${d.modo === 'agrupado' ? 'Agrupado' : 'Lista'}`
}

function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.data && typeof err.data === 'object') {
    const data = err.data as Record<string, unknown>
    const first = data.detail ?? data.nombre ?? Object.values(data)[0]
    if (first) return Array.isArray(first) ? String(first[0]) : String(first)
  }
  return (err as Error)?.message ?? fallback
}

export function ReportesPage() {
  const metaQuery = useReportesMeta()
  const origenes = useMemo(() => metaQuery.data?.origenes ?? [], [metaQuery.data])

  const guardadosQuery = useReportesGuardados()
  const guardados = useMemo(() => guardadosQuery.data ?? [], [guardadosQuery.data])
  const crearMut = useCrearGuardado()
  const eliminarMut = useEliminarGuardado()

  const [origenKey, setOrigenKey] = useState('')
  const [modo, setModo] = useState<ReporteModo>('lista')
  const [selected, setSelected] = useState<string[]>([])
  const [dimension, setDimension] = useState('')
  const [filtros, setFiltros] = useState<ReporteFiltros>(FILTROS_VACIOS)
  const [filtrosDeb, setFiltrosDeb] = useState<ReporteFiltros>(FILTROS_VACIOS)
  const [page, setPage] = useState(1)
  const [exportError, setExportError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [configAbierta, setConfigAbierta] = useState(true)

  // Guardar / cargar
  const [guardadosOpen, setGuardadosOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveError, setSaveError] = useState('')
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  // Selección inicial: primer origen con todas sus columnas.
  useEffect(() => {
    if (origenKey || origenes.length === 0) return
    const o = origenes[0]
    setOrigenKey(o.key)
    setSelected(o.campos.map((c) => c.key))
    setDimension(o.dimensiones[0]?.key ?? '')
  }, [origenes, origenKey])

  const origen = origenes.find((o) => o.key === origenKey) ?? null

  // Debounce de filtros: al escribir en la búsqueda no se dispara por tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      setFiltrosDeb(filtros)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [filtros])

  // Cambiar de origen (acción del usuario): re-inicializa columnas/dimensión.
  function elegirOrigen(key: string) {
    const o = origenes.find((x) => x.key === key)
    if (!o) return
    setOrigenKey(key)
    setSelected(o.campos.map((c) => c.key))
    setDimension(o.dimensiones[0]?.key ?? '')
    setFiltros(FILTROS_VACIOS)
    setPage(1)
  }

  // Cargar un reporte guardado: reconstruye toda la configuración.
  function cargarGuardado(g: ReporteGuardado) {
    const d = g.definicion
    setOrigenKey(d.origen)
    setModo(d.modo === 'agrupado' ? 'agrupado' : 'lista')
    setSelected(Array.isArray(d.campos) ? d.campos : [])
    setDimension(d.dimension ?? '')
    setFiltros({ ...FILTROS_VACIOS, ...(d.filtros ?? {}) })
    setPage(1)
    setGuardadosOpen(false)
  }

  // Campos elegidos, en el orden del origen (el mismo del Excel).
  const camposOrdenados = useMemo(
    () =>
      origen
        ? origen.campos.filter((c) => selected.includes(c.key)).map((c) => c.key)
        : [],
    [origen, selected],
  )

  const esAgrupado = modo === 'agrupado'
  const listo = esAgrupado ? Boolean(dimension) : camposOrdenados.length > 0

  const def: ReporteDef = useMemo(
    () => ({
      origen: origenKey,
      modo,
      campos: camposOrdenados,
      dimension,
      filtros: filtrosDeb,
    }),
    [origenKey, modo, camposOrdenados, dimension, filtrosDeb],
  )

  const preview = useReportePreview(def, page, Boolean(origenKey) && listo)
  const data = preview.data

  const savedKeys = useMemo(
    () => new Set(guardados.map((g) => defKey(g.definicion))),
    [guardados],
  )
  const yaGuardado = savedKeys.has(defKey(def))

  const previewError = preview.error
    ? preview.error instanceof ApiError
      ? preview.error.message
      : 'No se pudo generar la previsualización.'
    : ''

  const toggleCampo = (k: string) =>
    setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))

  const setFiltro = (patch: Partial<ReporteFiltros>) =>
    setFiltros((f) => ({ ...f, ...patch }))

  const cambiarModo = (m: ReporteModo) => {
    setModo(m)
    setPage(1)
  }

  async function exportar() {
    setExportError('')
    setExporting(true)
    try {
      await reportesApi.exportar(def)
      // Tras exportar, si la config es nueva (ni guardada ni descartada), se
      // ofrece guardarla.
      const key = defKey(def)
      if (listo && !savedKeys.has(key) && !dismissed.has(key)) {
        setSaveName('')
        setSaveError('')
        setSaveOpen(true)
      }
    } catch (e) {
      setExportError(apiErrorMessage(e, 'No se pudo generar el Excel.'))
    } finally {
      setExporting(false)
    }
  }

  // Cerrar el diálogo de guardar sin guardar = descartar esta config (no se
  // vuelve a preguntar por ella en esta sesión).
  function cerrarSave(v: boolean) {
    if (!v) setDismissed((s) => new Set(s).add(defKey(def)))
    setSaveOpen(v)
  }

  async function guardar() {
    const nombre = saveName.trim()
    if (!nombre) {
      setSaveError('Ponle un nombre.')
      return
    }
    setSaveError('')
    try {
      await crearMut.mutateAsync({ nombre, definicion: def })
      setSaveOpen(false)
    } catch (e) {
      setSaveError(apiErrorMessage(e, 'No se pudo guardar el reporte.'))
    }
  }

  const tieneFiltros =
    Boolean(origen) &&
    (origen!.filtros.fecha || origen!.filtros.inhabilitado || origen!.filtros.busqueda)

  // Resúmenes que se muestran cuando una sección (o toda la barra) está plegada.
  const dimLabel = origen?.dimensiones.find((d) => d.key === dimension)?.label ?? ''
  const nFiltros = [
    filtros.desde || filtros.hasta,
    filtros.inhabilitado,
    filtros.q?.trim(),
  ].filter(Boolean).length
  const resumenGlobal = origen
    ? [
        origen.label,
        esAgrupado
          ? `Agrupado${dimLabel ? ` por ${dimLabel}` : ''}`
          : `${camposOrdenados.length} columna${camposOrdenados.length === 1 ? '' : 's'}`,
        nFiltros ? `${nFiltros} filtro${nFiltros === 1 ? '' : 's'}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-balance text-foreground">
          Constructor de reportes
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Arma tu reporte: lista los datos o cuéntalos por grupo, y exporta a Excel.
        </p>
      </div>

      {metaQuery.isError ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>No se pudo cargar</AlertTitle>
          <AlertDescription>
            No se pudieron cargar los orígenes de reporte. Reintenta más tarde.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-4">
          {/* ---------- Barra de configuración (colapsable completa) ---------- */}
          <Card>
            <CardHeader className={cn(configAbierta && 'border-b')}>
              <button
                type="button"
                aria-expanded={configAbierta}
                onClick={() => setConfigAbierta((o) => !o)}
                className="flex w-full items-center gap-2 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronDown
                  className={cn(
                    'size-4 shrink-0 text-muted-foreground transition-transform',
                    !configAbierta && '-rotate-90',
                  )}
                  aria-hidden="true"
                />
                <CardTitle className="text-base">Configuración</CardTitle>
                {!configAbierta && resumenGlobal && (
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    · {resumenGlobal}
                  </span>
                )}
              </button>
            </CardHeader>
            {configAbierta && (
              <CardContent className="divide-y py-0">
                {/* Origen + modo */}
                <Seccion
                  titulo="Origen y modo"
                  resumen={
                    origen ? `${origen.label} · ${esAgrupado ? 'Agrupado' : 'Lista'}` : ''
                  }
                >
                  <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
                    <div className="grid gap-1.5">
                      <Label htmlFor="reporte-origen">Origen de datos</Label>
                      {metaQuery.isLoading ? (
                        <Skeleton className="h-8 w-56" />
                      ) : (
                        <Select value={origenKey} onValueChange={(v) => v && elegirOrigen(v)}>
                          <SelectTrigger id="reporte-origen" className="w-56">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {origenes.map((o) => (
                              <SelectItem key={o.key} value={o.key}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {origen && (
                      <div className="grid gap-1.5">
                        <span className="text-sm font-medium">Modo</span>
                        <div
                          className="flex gap-2"
                          role="group"
                          aria-label="Modo de reporte"
                        >
                          <ModoBtn
                            activo={!esAgrupado}
                            onClick={() => cambiarModo('lista')}
                            icon={<Rows3 className="size-4" aria-hidden="true" />}
                            label="Lista"
                          />
                          <ModoBtn
                            activo={esAgrupado}
                            onClick={() => cambiarModo('agrupado')}
                            icon={<ListTree className="size-4" aria-hidden="true" />}
                            label="Agrupado"
                          />
                        </div>
                      </div>
                    )}

                    {origen && (
                      <p className="min-w-0 flex-1 self-center text-xs text-muted-foreground">
                        {esAgrupado
                          ? 'Cuenta cuántos registros hay por cada grupo.'
                          : origen.descripcion}
                      </p>
                    )}
                  </div>
                </Seccion>

                {/* Columnas (lista) o Agrupar por (agrupado) */}
                {origen && !esAgrupado && (
                  <Seccion
                    titulo="Columnas"
                    resumen={`${camposOrdenados.length} de ${origen.campos.length}`}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {origen.campos.map((c) => {
                          const on = selected.includes(c.key)
                          return (
                            <button
                              key={c.key}
                              type="button"
                              aria-pressed={on}
                              onClick={() => toggleCampo(c.key)}
                              className={cn(
                                'rounded-full border px-2.5 py-1 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                on
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border text-muted-foreground hover:bg-muted',
                              )}
                            >
                              {c.label}
                            </button>
                          )
                        })}
                      </div>
                      <div className="ml-auto flex items-center gap-1.5 text-xs">
                        <button
                          type="button"
                          className="rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => setSelected(origen.campos.map((c) => c.key))}
                        >
                          Todas
                        </button>
                        <span className="text-muted-foreground">·</span>
                        <button
                          type="button"
                          className="rounded text-muted-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => setSelected([])}
                        >
                          Ninguna
                        </button>
                      </div>
                      {camposOrdenados.length === 0 && (
                        <p className="w-full text-xs text-destructive">
                          Elige al menos una columna.
                        </p>
                      )}
                    </div>
                  </Seccion>
                )}

                {origen && esAgrupado && (
                  <Seccion titulo="Agrupar por" resumen={dimLabel}>
                    <div className="flex flex-wrap items-center gap-3">
                      <Label htmlFor="reporte-dimension" className="sr-only">
                        Agrupar por
                      </Label>
                      <Select value={dimension} onValueChange={(v) => v && setDimension(v)}>
                        <SelectTrigger id="reporte-dimension" size="sm" className="w-52">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {origen.dimensiones.map((d) => (
                            <SelectItem key={d.key} value={d.key}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">
                        Cuenta cuántos registros hay por cada valor.
                      </span>
                    </div>
                  </Seccion>
                )}

                {/* Filtros */}
                {tieneFiltros && (
                  <Seccion
                    titulo="Filtros"
                    resumen={
                      nFiltros ? `${nFiltros} activo${nFiltros === 1 ? '' : 's'}` : 'ninguno'
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {origen!.filtros.fecha && (
                        <RangoFechas
                          desde={filtros.desde ?? ''}
                          hasta={filtros.hasta ?? ''}
                          setDesde={(v) => setFiltro({ desde: v })}
                          setHasta={(v) => setFiltro({ hasta: v })}
                        />
                      )}

                      {origen!.filtros.inhabilitado && (
                        <Select
                          value={filtros.inhabilitado || 'todos'}
                          onValueChange={(v) =>
                            setFiltro({
                              inhabilitado: v === 'todos' ? '' : (v as 'true' | 'false'),
                            })
                          }
                        >
                          <SelectTrigger size="sm" className="w-44">
                            <SelectValue>{(v: string) => INHAB_LABELS[v]}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todos">Todos los estados</SelectItem>
                            <SelectItem value="true">Inhabilitados</SelectItem>
                            <SelectItem value="false">Habilitados</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      {origen!.filtros.busqueda && (
                        <Input
                          value={filtros.q ?? ''}
                          onChange={(e) => setFiltro({ q: e.target.value })}
                          placeholder="Buscar serial, MAC…"
                          className="h-8 w-52"
                          spellCheck={false}
                        />
                      )}
                    </div>
                  </Seccion>
                )}
              </CardContent>
            )}
          </Card>

          {/* ---------- Previsualización (ancho completo) ---------- */}
          <Card className="min-w-0">
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b pb-4">
              <div className="min-w-0">
                <CardTitle className="text-base">Previsualización</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground" aria-live="polite">
                  {data && listo
                    ? esAgrupado
                      ? `${data.count.toLocaleString('es-CO')} grupo${data.count === 1 ? '' : 's'} · ${(data.total ?? 0).toLocaleString('es-CO')} registros en total`
                      : `${data.count.toLocaleString('es-CO')} resultado${data.count === 1 ? '' : 's'}`
                    : 'Configura el reporte para ver una vista previa.'}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {/* Reportes guardados */}
                <Popover open={guardadosOpen} onOpenChange={setGuardadosOpen}>
                  <PopoverTrigger render={<Button variant="outline" />}>
                    <Bookmark aria-hidden="true" />
                    Guardados
                    {guardados.length > 0 && (
                      <span className="ml-0.5 rounded-full bg-muted px-1.5 text-xs tabular-nums">
                        {guardados.length}
                      </span>
                    )}
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 p-1.5">
                    <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
                      Tus reportes guardados
                    </div>
                    {guardadosQuery.isLoading ? (
                      <div className="px-1.5 py-2">
                        <Skeleton className="h-4 w-full" />
                      </div>
                    ) : guardados.length === 0 ? (
                      <p className="px-1.5 py-2 text-xs text-muted-foreground">
                        Aún no tienes. Exporta un reporte y guárdalo para reutilizarlo.
                      </p>
                    ) : (
                      <ul className="max-h-64 overflow-y-auto">
                        {guardados.map((g) => (
                          <li key={g.id} className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => cargarGuardado(g)}
                              className="min-w-0 flex-1 rounded-md px-1.5 py-1.5 text-left outline-none hover:bg-muted focus-visible:bg-muted"
                            >
                              <span className="block truncate text-sm">{g.nombre}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {resumenDef(g.definicion, origenes)}
                              </span>
                            </button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Eliminar ${g.nombre}`}
                              onClick={() => eliminarMut.mutate(g.id)}
                            >
                              <Trash2 className="text-destructive" aria-hidden="true" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-1 border-t pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        disabled={!listo || yaGuardado}
                        onClick={() => {
                          setGuardadosOpen(false)
                          setSaveName('')
                          setSaveError('')
                          setSaveOpen(true)
                        }}
                      >
                        <Save aria-hidden="true" />
                        {yaGuardado ? 'Ya está guardada' : 'Guardar configuración actual'}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                <Button
                  onClick={exportar}
                  disabled={!listo || exporting || (data?.count ?? 0) === 0}
                >
                  {exporting ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <FileSpreadsheet aria-hidden="true" />
                  )}
                  Exportar Excel
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {exportError && (
                <Alert variant="destructive" className="mb-4">
                  <CircleAlert />
                  <AlertDescription>{exportError}</AlertDescription>
                </Alert>
              )}
              {previewError && (
                <Alert variant="destructive" className="mb-4">
                  <CircleAlert />
                  <AlertDescription>{previewError}</AlertDescription>
                </Alert>
              )}

              {!listo ? (
                <EstadoVacio
                  icon={<TableProperties className="size-6 opacity-50" aria-hidden="true" />}
                  titulo={esAgrupado ? 'Sin agrupación' : 'Sin columnas'}
                  detalle={
                    esAgrupado
                      ? 'Elige una dimensión para agrupar en la barra de arriba.'
                      : 'Elige al menos una columna en la barra de arriba para armar el reporte.'
                  }
                />
              ) : preview.isLoading ? (
                <TablaSkeleton columnas={esAgrupado ? 2 : camposOrdenados.length} />
              ) : data && data.count === 0 ? (
                <EstadoVacio
                  icon={<Database className="size-6 opacity-50" aria-hidden="true" />}
                  titulo="Sin resultados"
                  detalle="Ningún registro cumple con los filtros seleccionados."
                />
              ) : data ? (
                <>
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {data.campos.map((c) => (
                            <TableHead
                              key={c.key}
                              className={cn(
                                'whitespace-nowrap',
                                c.tipo === 'numero' && 'text-right',
                              )}
                            >
                              {c.label}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.rows.map((row, i) => (
                          <TableRow key={i}>
                            {row.map((v, j) => (
                              <TableCell
                                key={j}
                                className={cn(
                                  'whitespace-nowrap',
                                  typeof v === 'number' &&
                                    'text-right font-medium tabular-nums',
                                )}
                              >
                                {fmtCelda(v)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Paginacion page={page} count={data.count} onPage={setPage} />
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Diálogo: ofrecer guardar tras exportar (o desde "Guardar actual") */}
      <Dialog open={saveOpen} onOpenChange={cerrarSave}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Guardar esta configuración?</DialogTitle>
            <DialogDescription>
              Guárdala con un nombre para reutilizarla sin volver a armarla. Solo tú la
              verás.
            </DialogDescription>
          </DialogHeader>

          {saveError && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="save-nombre">Nombre</Label>
            <Input
              id="save-nombre"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Ej. Inhabilitados de este mes"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  guardar()
                }
              }}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => cerrarSave(false)}>
              Ahora no
            </Button>
            <Button type="button" onClick={guardar} disabled={crearMut.isPending}>
              {crearMut.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Sección colapsable de la barra de configuración (abierta por defecto).
function Seccion({
  titulo,
  resumen,
  children,
  defaultOpen = true,
}: {
  titulo: string
  resumen?: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="py-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            !open && '-rotate-90',
          )}
          aria-hidden="true"
        />
        <span className="text-sm font-medium">{titulo}</span>
        {!open && resumen && (
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            · {resumen}
          </span>
        )}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}

function ModoBtn({
  activo,
  onClick,
  icon,
  label,
}: {
  activo: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={cn(
        'flex h-8 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
        activo
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border text-muted-foreground hover:bg-muted',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function EstadoVacio({
  icon,
  titulo,
  detalle,
}: {
  icon: React.ReactNode
  titulo: string
  detalle: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      {icon}
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{detalle}</p>
    </div>
  )
}

function TablaSkeleton({ columnas }: { columnas: number }) {
  const cols = Math.max(columnas, 1)
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: cols }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-4 w-20" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: cols }).map((__, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-4 w-full max-w-28" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
