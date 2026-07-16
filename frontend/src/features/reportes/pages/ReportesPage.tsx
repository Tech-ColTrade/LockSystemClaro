// Constructor de reportes: el usuario elige un ORIGEN y, o bien lista sus
// columnas (modo lista), o cuenta registros por una dimensión (modo agrupado,
// con % del total). Filtra, ordena por columna, previsualiza exactamente lo
// que va a exportar y descarga el Excel.
//
// Guardados: cada usuario guarda sus configuraciones (privadas) y puede
// renombrarlas o sobrescribirlas; un administrador puede compartir una como
// plantilla para todos. Tras exportar una config nueva, se ofrece guardarla.
//
// Layout: barra de configuración colapsable (secciones y colapso maestro)
// arriba + tabla a todo el ancho abajo. Es solo lectura; la seguridad (lista
// blanca de campos/dimensiones/orden, del usuario solo el nombre) la impone el
// backend.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bookmark,
  ChartBar,
  ChartColumn,
  ChartLine,
  ChartPie,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  CircleAlert,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  ListTree,
  Loader2,
  MoreHorizontal,
  Rows3,
  Save,
  TableProperties,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { downloadChartPng } from '@/features/dashboard/chartExport'
import { useChartColors, type ChartColors } from '@/features/dashboard/chartTheme'
import {
  useActualizarGuardado,
  useCrearGuardado,
  useEliminarGuardado,
  useReportePreview,
  useReportesGuardados,
  useReportesMeta,
} from '@/features/reportes/api/reportes.queries'
import {
  reportesApi,
  type CampoTipo,
  type OrigenMeta,
  type ReporteDef,
  type ReporteFiltros,
  type ReporteGuardado,
  type ReporteModo,
} from '@/features/reportes/api/reportes.api'
import { usePermissions } from '@/features/auth/usePermissions'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

function fmtCelda(v: string | number, tipo?: CampoTipo): string {
  if (typeof v !== 'number') return v
  if (tipo === 'porcentaje')
    return `${v.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`
  return v.toLocaleString('es-CO')
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
    orden: d.orden || '',
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
    const first =
      data.detail ?? data.nombre ?? data.compartido ?? Object.values(data)[0]
    if (first) return Array.isArray(first) ? String(first[0]) : String(first)
  }
  return (err as Error)?.message ?? fallback
}

export function ReportesPage() {
  const { isAdmin } = usePermissions()
  const metaQuery = useReportesMeta()
  const origenes = useMemo(() => metaQuery.data?.origenes ?? [], [metaQuery.data])

  const guardadosQuery = useReportesGuardados()
  const guardados = useMemo(() => guardadosQuery.data ?? [], [guardadosQuery.data])
  const crearMut = useCrearGuardado()
  const actualizarMut = useActualizarGuardado()
  const eliminarMut = useEliminarGuardado()

  const [origenKey, setOrigenKey] = useState('')
  const [modo, setModo] = useState<ReporteModo>('lista')
  const [selected, setSelected] = useState<string[]>([])
  const [dimension, setDimension] = useState('')
  const [orden, setOrden] = useState('')
  const [filtros, setFiltros] = useState<ReporteFiltros>(FILTROS_VACIOS)
  const [filtrosDeb, setFiltrosDeb] = useState<ReporteFiltros>(FILTROS_VACIOS)
  const [page, setPage] = useState(1)
  const [exportError, setExportError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [configAbierta, setConfigAbierta] = useState(true)

  // Gráfica del modo agrupado.
  const [tipoGrafica, setTipoGrafica] = useState<
    'barras' | 'columnas' | 'dona' | 'linea'
  >('barras')
  const chartRef = useRef<HTMLDivElement>(null)
  const chartColors = useChartColors()

  // Guardados: menú + diálogos (guardar / renombrar / sobrescribir).
  const [guardadosOpen, setGuardadosOpen] = useState(false)
  const [guardadosError, setGuardadosError] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saveCompartir, setSaveCompartir] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [renameTarget, setRenameTarget] = useState<ReporteGuardado | null>(null)
  const [renameName, setRenameName] = useState('')
  const [renameError, setRenameError] = useState('')
  const [overwriteTarget, setOverwriteTarget] = useState<ReporteGuardado | null>(null)
  const [overwriteError, setOverwriteError] = useState('')

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
    setOrden('')
    setPage(1)
  }

  // Cargar un reporte guardado: reconstruye toda la configuración.
  function cargarGuardado(g: ReporteGuardado) {
    const d = g.definicion
    setOrigenKey(d.origen)
    setModo(d.modo === 'agrupado' ? 'agrupado' : 'lista')
    setSelected(Array.isArray(d.campos) ? d.campos : [])
    setDimension(d.dimension ?? '')
    setOrden(d.orden ?? '')
    setFiltros({ ...FILTROS_VACIOS, ...(d.filtros ?? {}) })
    setPage(1)
    setGuardadosOpen(false)
    setExpandedId(null)
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
      orden,
    }),
    [origenKey, modo, camposOrdenados, dimension, filtrosDeb, orden],
  )

  const preview = useReportePreview(def, page, Boolean(origenKey) && listo)
  const data = preview.data

  const savedKeys = useMemo(
    () => new Set(guardados.map((g) => defKey(g.definicion))),
    [guardados],
  )
  const yaGuardado = savedKeys.has(defKey(def))
  const propios = useMemo(() => guardados.filter((g) => g.es_propio), [guardados])
  const compartidosAjenos = useMemo(
    () => guardados.filter((g) => !g.es_propio),
    [guardados],
  )

  const previewError = preview.error
    ? preview.error instanceof ApiError
      ? preview.error.message
      : 'No se pudo generar la previsualización.'
    : ''

  const toggleCampo = (k: string) => {
    const removiendo = selected.includes(k)
    // Si se quita la columna por la que se ordena, se vuelve al orden default.
    if (removiendo && orden.replace(/^-/, '') === k) setOrden('')
    setSelected((s) => (removiendo ? s.filter((x) => x !== k) : [...s, k]))
  }

  const setFiltro = (patch: Partial<ReporteFiltros>) =>
    setFiltros((f) => ({ ...f, ...patch }))

  const cambiarModo = (m: ReporteModo) => {
    setModo(m)
    setOrden('') // las claves de orden difieren entre modos
    setPage(1)
  }

  // Clic en un encabezado: asc -> desc -> orden por defecto.
  function ciclarOrden(key: string) {
    setOrden((o) => (o === key ? `-${key}` : o === `-${key}` ? '' : key))
    setPage(1)
  }

  async function exportar(formato: 'xlsx' | 'csv') {
    setExportError('')
    setExporting(true)
    try {
      await reportesApi.exportar(def, formato)
      // Tras exportar, si la config es nueva (ni guardada ni descartada), se
      // ofrece guardarla.
      const key = defKey(def)
      if (listo && !savedKeys.has(key) && !dismissed.has(key)) {
        abrirSave()
      }
    } catch (e) {
      setExportError(apiErrorMessage(e, 'No se pudo generar el archivo.'))
    } finally {
      setExporting(false)
    }
  }

  // Datos de la gráfica: los grupos visibles (con el orden por defecto, la
  // página 1 son los grupos más grandes -> un "Top 10" natural).
  const chartData = useMemo(() => {
    if (!esAgrupado || !data) return []
    return data.rows.map((row) => ({
      name: String(row[0]),
      value: typeof row[1] === 'number' ? row[1] : 0,
      pct: typeof row[2] === 'number' ? row[2] : 0,
    }))
  }, [esAgrupado, data])

  async function exportarPng() {
    try {
      await downloadChartPng(
        chartRef.current,
        `reporte_${origenKey}_agrupado.png`,
        chartColors.surface,
      )
    } catch {
      /* silencioso: no bloquea la UI */
    }
  }

  function abrirSave() {
    setSaveName('')
    setSaveError('')
    setSaveCompartir(false)
    setSaveOpen(true)
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
      await crearMut.mutateAsync({ nombre, definicion: def, compartido: saveCompartir })
      setSaveOpen(false)
    } catch (e) {
      setSaveError(apiErrorMessage(e, 'No se pudo guardar el reporte.'))
    }
  }

  function abrirRename(g: ReporteGuardado) {
    setRenameTarget(g)
    setRenameName(g.nombre)
    setRenameError('')
  }

  async function renombrar() {
    if (!renameTarget) return
    const nombre = renameName.trim()
    if (!nombre) {
      setRenameError('Ponle un nombre.')
      return
    }
    setRenameError('')
    try {
      await actualizarMut.mutateAsync({ id: renameTarget.id, patch: { nombre } })
      setRenameTarget(null)
    } catch (e) {
      setRenameError(apiErrorMessage(e, 'No se pudo renombrar.'))
    }
  }

  async function sobrescribir() {
    if (!overwriteTarget) return
    setOverwriteError('')
    try {
      await actualizarMut.mutateAsync({
        id: overwriteTarget.id,
        patch: { definicion: def },
      })
      setOverwriteTarget(null)
    } catch (e) {
      setOverwriteError(apiErrorMessage(e, 'No se pudo sobrescribir.'))
    }
  }

  async function toggleCompartir(g: ReporteGuardado) {
    setGuardadosError('')
    try {
      await actualizarMut.mutateAsync({
        id: g.id,
        patch: { compartido: !g.compartido },
      })
    } catch (e) {
      setGuardadosError(apiErrorMessage(e, 'No se pudo actualizar.'))
    }
  }

  async function eliminarGuardado(g: ReporteGuardado) {
    setGuardadosError('')
    try {
      await eliminarMut.mutateAsync(g.id)
      setExpandedId(null)
    } catch (e) {
      setGuardadosError(apiErrorMessage(e, 'No se pudo eliminar.'))
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
                <Popover
                  open={guardadosOpen}
                  onOpenChange={(v) => {
                    setGuardadosOpen(v)
                    if (!v) setExpandedId(null)
                  }}
                >
                  <PopoverTrigger render={<Button variant="outline" />}>
                    <Bookmark aria-hidden="true" />
                    Guardados
                    {guardados.length > 0 && (
                      <span className="ml-0.5 rounded-full bg-muted px-1.5 text-xs tabular-nums">
                        {guardados.length}
                      </span>
                    )}
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80 p-1.5">
                    {guardadosError && (
                      <p className="px-1.5 py-1 text-xs text-destructive">
                        {guardadosError}
                      </p>
                    )}
                    <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
                      Tus reportes guardados
                    </div>
                    {guardadosQuery.isLoading ? (
                      <div className="px-1.5 py-2">
                        <Skeleton className="h-4 w-full" />
                      </div>
                    ) : propios.length === 0 ? (
                      <p className="px-1.5 py-2 text-xs text-muted-foreground">
                        Aún no tienes. Exporta un reporte y guárdalo para reutilizarlo.
                      </p>
                    ) : (
                      <ul className="max-h-56 overflow-y-auto">
                        {propios.map((g) => (
                          <li key={g.id}>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => cargarGuardado(g)}
                                className="min-w-0 flex-1 rounded-md px-1.5 py-1.5 text-left outline-none hover:bg-muted focus-visible:bg-muted"
                              >
                                <span className="flex items-center gap-1.5 text-sm">
                                  <span className="truncate">{g.nombre}</span>
                                  {g.compartido && (
                                    <Users
                                      className="size-3 shrink-0 text-muted-foreground"
                                      aria-label="Compartida con todos"
                                    />
                                  )}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {resumenDef(g.definicion, origenes)}
                                </span>
                              </button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Acciones de ${g.nombre}`}
                                aria-expanded={expandedId === g.id}
                                onClick={() =>
                                  setExpandedId((id) => (id === g.id ? null : g.id))
                                }
                              >
                                <MoreHorizontal aria-hidden="true" />
                              </Button>
                            </div>
                            {expandedId === g.id && (
                              <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-muted/50 px-2 py-1.5 text-xs">
                                <AccionMenu
                                  disabled={!listo}
                                  onClick={() => {
                                    setOverwriteError('')
                                    setOverwriteTarget(g)
                                  }}
                                >
                                  Sobrescribir
                                </AccionMenu>
                                <AccionMenu onClick={() => abrirRename(g)}>
                                  Renombrar
                                </AccionMenu>
                                {isAdmin && (
                                  <AccionMenu onClick={() => toggleCompartir(g)}>
                                    {g.compartido
                                      ? 'Dejar de compartir'
                                      : 'Compartir con todos'}
                                  </AccionMenu>
                                )}
                                <AccionMenu
                                  destructive
                                  onClick={() => eliminarGuardado(g)}
                                >
                                  Eliminar
                                </AccionMenu>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {compartidosAjenos.length > 0 && (
                      <>
                        <div className="mt-1 border-t px-1.5 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                          Plantillas compartidas
                        </div>
                        <ul className="max-h-40 overflow-y-auto">
                          {compartidosAjenos.map((g) => (
                            <li key={g.id}>
                              <button
                                type="button"
                                onClick={() => cargarGuardado(g)}
                                className="w-full min-w-0 rounded-md px-1.5 py-1.5 text-left outline-none hover:bg-muted focus-visible:bg-muted"
                              >
                                <span className="block truncate text-sm">{g.nombre}</span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {resumenDef(g.definicion, origenes)} · de {g.creado_por}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    <div className="mt-1 border-t pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        disabled={!listo || yaGuardado}
                        onClick={() => {
                          setGuardadosOpen(false)
                          abrirSave()
                        }}
                      >
                        <Save aria-hidden="true" />
                        {yaGuardado ? 'Ya está guardada' : 'Guardar configuración actual'}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        disabled={!listo || exporting || (data?.count ?? 0) === 0}
                      />
                    }
                  >
                    {exporting ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Download aria-hidden="true" />
                    )}
                    Exportar
                    <ChevronDown className="size-3.5" aria-hidden="true" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => exportar('xlsx')}>
                      <FileSpreadsheet aria-hidden="true" />
                      Excel (.xlsx)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportar('csv')}>
                      <FileText aria-hidden="true" />
                      CSV (.csv)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
                <TablaSkeleton columnas={esAgrupado ? 3 : camposOrdenados.length} />
              ) : data && data.count === 0 ? (
                <EstadoVacio
                  icon={<Database className="size-6 opacity-50" aria-hidden="true" />}
                  titulo="Sin resultados"
                  detalle="Ningún registro cumple con los filtros seleccionados."
                />
              ) : data ? (
                <>
                  {esAgrupado && chartData.length > 0 && (
                    <div className="mb-4 rounded-lg border p-4">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          Gráfica de los grupos visibles (página actual).
                        </p>
                        <div className="flex items-center gap-1.5">
                          <div
                            className="flex flex-wrap gap-1"
                            role="group"
                            aria-label="Tipo de gráfica"
                          >
                            <GraficaBtn
                              activo={tipoGrafica === 'barras'}
                              onClick={() => setTipoGrafica('barras')}
                              icon={<ChartBar className="size-3.5" aria-hidden="true" />}
                              label="Barras"
                            />
                            <GraficaBtn
                              activo={tipoGrafica === 'columnas'}
                              onClick={() => setTipoGrafica('columnas')}
                              icon={<ChartColumn className="size-3.5" aria-hidden="true" />}
                              label="Columnas"
                            />
                            <GraficaBtn
                              activo={tipoGrafica === 'dona'}
                              onClick={() => setTipoGrafica('dona')}
                              icon={<ChartPie className="size-3.5" aria-hidden="true" />}
                              label="Dona"
                            />
                            <GraficaBtn
                              activo={tipoGrafica === 'linea'}
                              onClick={() => setTipoGrafica('linea')}
                              icon={<ChartLine className="size-3.5" aria-hidden="true" />}
                              label="Línea"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={exportarPng}
                            title="Descargar imagen PNG"
                          >
                            <Download aria-hidden="true" />
                            PNG
                          </Button>
                        </div>
                      </div>
                      <div ref={chartRef}>
                        {tipoGrafica === 'barras' ? (
                          <GraficaBarras data={chartData} colors={chartColors} />
                        ) : tipoGrafica === 'columnas' ? (
                          <GraficaColumnas data={chartData} colors={chartColors} />
                        ) : tipoGrafica === 'linea' ? (
                          <GraficaLinea data={chartData} colors={chartColors} />
                        ) : (
                          <GraficaDona data={chartData} colors={chartColors} />
                        )}
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {data.campos.map((c) => {
                            const esNum = c.tipo === 'numero' || c.tipo === 'porcentaje'
                            const dir =
                              orden === c.key
                                ? 'ascending'
                                : orden === `-${c.key}`
                                  ? 'descending'
                                  : undefined
                            return (
                              <TableHead
                                key={c.key}
                                aria-sort={dir}
                                className={cn('whitespace-nowrap', esNum && 'text-right')}
                              >
                                {c.sortable ? (
                                  <button
                                    type="button"
                                    onClick={() => ciclarOrden(c.key)}
                                    className={cn(
                                      'inline-flex items-center gap-1 rounded outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
                                      dir && 'text-foreground',
                                    )}
                                  >
                                    {c.label}
                                    {dir === 'ascending' ? (
                                      <ChevronUp className="size-3.5" aria-hidden="true" />
                                    ) : dir === 'descending' ? (
                                      <ChevronDown className="size-3.5" aria-hidden="true" />
                                    ) : (
                                      <ChevronsUpDown
                                        className="size-3.5 opacity-40"
                                        aria-hidden="true"
                                      />
                                    )}
                                  </button>
                                ) : (
                                  c.label
                                )}
                              </TableHead>
                            )
                          })}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.rows.map((row, i) => (
                          <TableRow key={i}>
                            {row.map((v, j) => {
                              const tipo = data.campos[j]?.tipo
                              const esNum = tipo === 'numero' || tipo === 'porcentaje'
                              return (
                                <TableCell
                                  key={j}
                                  className={cn(
                                    'whitespace-nowrap',
                                    esNum && 'text-right font-medium tabular-nums',
                                  )}
                                >
                                  {fmtCelda(v, tipo)}
                                </TableCell>
                              )
                            })}
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
              Guárdala con un nombre para reutilizarla sin volver a armarla.
              {!saveCompartir && ' Solo tú la verás.'}
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

          {isAdmin && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                style={{ accentColor: 'var(--primary)' }}
                checked={saveCompartir}
                onChange={(e) => setSaveCompartir(e.target.checked)}
              />
              Compartir como plantilla para todos
            </label>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => cerrarSave(false)}>
              Ahora no
            </Button>
            <Button type="button" onClick={guardar} disabled={crearMut.isPending}>
              {crearMut.isPending && (
                <Loader2 className="animate-spin" aria-hidden="true" />
              )}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: renombrar un guardado */}
      <Dialog open={renameTarget !== null} onOpenChange={(v) => !v && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renombrar reporte</DialogTitle>
            <DialogDescription>Nuevo nombre para «{renameTarget?.nombre}».</DialogDescription>
          </DialogHeader>

          {renameError && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{renameError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="rename-nombre">Nombre</Label>
            <Input
              id="rename-nombre"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  renombrar()
                }
              }}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={renombrar} disabled={actualizarMut.isPending}>
              {actualizarMut.isPending && (
                <Loader2 className="animate-spin" aria-hidden="true" />
              )}
              Renombrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: sobrescribir un guardado con la configuración actual */}
      <Dialog
        open={overwriteTarget !== null}
        onOpenChange={(v) => !v && setOverwriteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sobrescribir reporte</DialogTitle>
            <DialogDescription>
              «{overwriteTarget?.nombre}» se reemplazará con la configuración actual del
              constructor. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          {overwriteError && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{overwriteError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOverwriteTarget(null)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={sobrescribir} disabled={actualizarMut.isPending}>
              {actualizarMut.isPending && (
                <Loader2 className="animate-spin" aria-hidden="true" />
              )}
              Sobrescribir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Gráfica del modo agrupado (los grupos visibles de la página actual)
// ---------------------------------------------------------------------------
interface GrupoChart {
  name: string
  value: number
  pct: number
}

function paletaChart(c: ChartColors): string[] {
  return [c.blue, c.orange, c.good, c.warning, c.critical, c.neutral]
}

function tooltipChart(c: ChartColors) {
  return {
    contentStyle: {
      background: c.surface,
      border: `1px solid ${c.grid}`,
      borderRadius: 12,
      fontSize: 12,
      color: c.text,
      boxShadow: '0 8px 24px rgba(16,24,40,0.14)',
    },
    labelStyle: { color: c.text, fontWeight: 600 },
    itemStyle: { color: c.text },
  }
}

function GraficaBtn({
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
        'flex h-7 items-center gap-1 rounded-lg border px-2 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
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

/** Barras horizontales: aguantan etiquetas largas (usuarios, seriales). */
function GraficaBarras({ data, colors }: { data: GrupoChart[]; colors: ChartColors }) {
  const alto = Math.max(180, data.length * 36 + 30)
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
      >
        <CartesianGrid stroke={colors.grid} horizontal={false} />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fill: colors.muted, fontSize: 11 }}
          axisLine={{ stroke: colors.axis }}
          tickLine={{ stroke: colors.axis }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          tick={{ fill: colors.muted, fontSize: 11 }}
          axisLine={{ stroke: colors.axis }}
          tickLine={{ stroke: colors.axis }}
        />
        <Tooltip
          {...tooltipChart(colors)}
          cursor={{ fill: colors.grid, opacity: 0.3 }}
          formatter={(v) => [Number(v ?? 0).toLocaleString('es-CO'), 'Cantidad']}
        />
        <Bar dataKey="value" fill={colors.blue} radius={[0, 5, 5, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Trunca etiquetas largas en ejes de categoría (el tooltip muestra la completa). */
function truncar(s: string, max = 12): string {
  return s.length > max ? `${s.slice(0, max)}…` : s
}

/** Columnas verticales: para grupos con etiquetas cortas (Acción, Estado, meses). */
function GraficaColumnas({ data, colors }: { data: GrupoChart[]; colors: ChartColors }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={colors.grid} vertical={false} />
        <XAxis
          dataKey="name"
          interval={0}
          tickFormatter={(v) => truncar(String(v))}
          tick={{ fill: colors.muted, fontSize: 11 }}
          axisLine={{ stroke: colors.axis }}
          tickLine={{ stroke: colors.axis }}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: colors.muted, fontSize: 11 }}
          axisLine={{ stroke: colors.axis }}
          tickLine={{ stroke: colors.axis }}
        />
        <Tooltip
          {...tooltipChart(colors)}
          cursor={{ fill: colors.grid, opacity: 0.3 }}
          formatter={(v) => [Number(v ?? 0).toLocaleString('es-CO'), 'Cantidad']}
        />
        <Bar dataKey="value" fill={colors.blue} radius={[5, 5, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Clave de orden cronológico para etiquetas de fecha; alfabético si no lo son.
 *  Soporta 'dd/mm/yyyy' (dimensión Día) y 'yyyy-mm' (Mes, que ya ordena solo). */
function claveCronologica(name: string): string {
  const dia = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(name)
  if (dia) return `${dia[3]}-${dia[2]}-${dia[1]}`
  return name
}

/** Línea/área de tendencia: pensada para las dimensiones de tiempo (Día/Mes).
 *  Ordena los grupos cronológicamente sin importar cómo esté la tabla. */
function GraficaLinea({ data, colors }: { data: GrupoChart[]; colors: ChartColors }) {
  const serie = [...data].sort((a, b) =>
    claveCronologica(a.name).localeCompare(claveCronologica(b.name)),
  )
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={serie} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="reporte-linea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.blue} stopOpacity={0.35} />
            <stop offset="100%" stopColor={colors.blue} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={colors.grid} vertical={false} />
        <XAxis
          dataKey="name"
          interval="preserveStartEnd"
          tickFormatter={(v) => truncar(String(v))}
          tick={{ fill: colors.muted, fontSize: 11 }}
          axisLine={{ stroke: colors.axis }}
          tickLine={{ stroke: colors.axis }}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: colors.muted, fontSize: 11 }}
          axisLine={{ stroke: colors.axis }}
          tickLine={{ stroke: colors.axis }}
        />
        <Tooltip
          {...tooltipChart(colors)}
          formatter={(v) => [Number(v ?? 0).toLocaleString('es-CO'), 'Cantidad']}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={colors.blue}
          strokeWidth={2}
          fill="url(#reporte-linea)"
          dot={{ r: 3, fill: colors.blue, strokeWidth: 0 }}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Dona con leyenda (nombre · cantidad · %). */
function GraficaDona({ data, colors }: { data: GrupoChart[]; colors: ChartColors }) {
  const paleta = paletaChart(colors)
  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            cornerRadius={6}
            startAngle={90}
            endAngle={-270}
          >
            {data.map((d, i) => (
              <Cell
                key={d.name}
                fill={paleta[i % paleta.length]}
                stroke={colors.surface}
                strokeWidth={3}
              />
            ))}
          </Pie>
          <Tooltip
            {...tooltipChart(colors)}
            formatter={(v) => [Number(v ?? 0).toLocaleString('es-CO'), 'Cantidad']}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs">
            <span
              className="size-2.5 rounded-full"
              style={{ background: paleta[i % paleta.length] }}
            />
            <span className="max-w-40 truncate text-muted-foreground">{d.name}</span>
            <span className="font-semibold tabular-nums text-foreground">
              {d.value.toLocaleString('es-CO')}
            </span>
            <span className="text-muted-foreground">
              ({d.pct.toLocaleString('es-CO', { maximumFractionDigits: 1 })}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Acción de texto dentro del menú de guardados.
function AccionMenu({
  children,
  onClick,
  disabled,
  destructive,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:no-underline',
        destructive ? 'text-destructive' : 'text-foreground/80',
      )}
    >
      {children}
    </button>
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
