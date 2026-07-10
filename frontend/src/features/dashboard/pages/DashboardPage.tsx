import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { dashboardApi } from '@/features/dashboard/api/dashboard.api'
import { useChartColors, type ChartColors } from '@/features/dashboard/chartTheme'
import {
  ChartCard,
  PeriodSelector,
  SectionTitle,
  StatTile,
  type Tone,
} from '@/features/dashboard/components/DashboardUI'
import type { DashboardResumen, Periodo } from '@/features/dashboard/types'
import { ApiError } from '@/lib/http/errors'
import * as I from '@/features/dashboard/components/icons'
import { RangoFechas } from '@/shared/components/RangoFechas'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: 'dia', label: 'Día' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'anio', label: 'Año' },
]

function tooltipStyle(c: ChartColors) {
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

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      <svg className="h-8 w-8 text-muted-foreground/50" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M3 3v18h18" />
        <path d="M7 14l3-3 3 3 4-5" />
      </svg>
      {children}
    </div>
  )
}

function ChartLegend({
  items,
  textColor,
}: {
  items: { value: string; color: string }[]
  textColor: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1 text-xs">
      {items.map((item) => (
        <div key={item.value} className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span style={{ color: textColor }}>{item.value}</span>
        </div>
      ))}
    </div>
  )
}

function fmtNum(value: number | string) {
  return typeof value === 'number' ? value.toLocaleString('es-CO') : value
}

function fmtPct(value: number, total: number) {
  return total ? `${Math.round((value / total) * 100)}%` : '0%'
}

function DataLabels({
  groups,
  note,
}: {
  groups: {
    label: string
    values: { label: string; value: number | string; color?: string }[]
  }[]
  note?: string
}) {
  if (groups.length === 0) return null

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3 text-xs">
      <div className="grid gap-2 sm:grid-cols-2">
        {groups.map((group) => (
          <div key={group.label} className="min-w-0">
            <div className="font-medium text-foreground">{group.label}</div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
              {group.values.map((item) => (
                <span key={`${group.label}-${item.label}`} className="inline-flex items-center gap-1.5">
                  {item.color && (
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                  )}
                  <span>{item.label}</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {fmtNum(item.value)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {note && <div className="text-[0.7rem] text-muted-foreground">{note}</div>}
    </div>
  )
}

// --- Donut reutilizable con total al centro + leyenda propia (exportable) ---
function Donut({
  data,
  colors,
  centerValue,
  centerLabel,
}: {
  data: { name: string; value: number; color: string }[]
  colors: ChartColors
  centerValue: number | string
  centerLabel: string
}) {
  const t = tooltipStyle(colors)
  const total = data.reduce((acc, d) => acc + d.value, 0)

  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={208}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={92}
              paddingAngle={3}
              cornerRadius={6}
              startAngle={90}
              endAngle={-270}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} stroke={colors.surface} strokeWidth={3} />
              ))}
            </Pie>
            <Tooltip {...t} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums text-foreground">
            {centerValue}
          </span>
          <span className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
            {centerLabel}
          </span>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="font-semibold tabular-nums text-foreground">
              {d.value.toLocaleString('es-CO')}
            </span>
            <span className="text-muted-foreground">({fmtPct(d.value, total)})</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const c = useChartColors()
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [data, setData] = useState<DashboardResumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updated, setUpdated] = useState<Date | null>(null)
  const [serial, setSerial] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const cargar = useCallback(async (p: Periodo) => {
    setLoading(true)
    setError('')
    try {
      setData(await dashboardApi.resumen(p))
      setUpdated(new Date())
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo cargar el dashboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargar(periodo)
  }, [cargar, periodo])

  const descargar = async (fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo generar el archivo.')
    }
  }

  const t = tooltipStyle(c)
  const axis = {
    tick: { fill: c.muted, fontSize: 11 },
    axisLine: { stroke: c.axis },
    tickLine: { stroke: c.axis },
  }

  const legendItems = (items: [string, string][]) =>
    items.map(([value, color]) => ({ value, color }))

  const tendenciaLabels = data?.serie_tiempo.datos.slice(-8).map((d) => ({
    label: d.periodo,
    values: [
      { label: 'Inh.', value: d.inhabilitaciones, color: c.blue },
      { label: 'Hab.', value: d.habilitaciones, color: c.orange },
    ],
  })) ?? []
  const tendenciaNote =
    data && data.serie_tiempo.datos.length > tendenciaLabels.length
      ? `Mostrando últimos ${tendenciaLabels.length} de ${data.serie_tiempo.datos.length} períodos.`
      : undefined

  const actividadLabels =
    data?.actividad_por_equipo
      .slice()
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
      .map((eq) => ({
        label: eq.serial || eq.mac,
        values: [
          { label: 'Inh.', value: eq.inhabilitaciones, color: c.blue },
          { label: 'Hab.', value: eq.habilitaciones, color: c.orange },
          { label: 'Total', value: eq.total },
        ],
      })) ?? []
  const actividadNote =
    data && data.actividad_por_equipo.length > actividadLabels.length
      ? `Equipos con mayor actividad: ${actividadLabels.length} de ${data.actividad_por_equipo.length}.`
      : undefined

  // Degradado vertical sutil por color (se inyecta dentro de cada gráfico para
  // que la exportación PNG lo conserve). Ids estables, definición idéntica.
  const barDefs = useMemo(
    () => (
      <defs>
        {(
          [
            ['dash-blue', c.blue],
            ['dash-orange', c.orange],
            ['dash-good', c.good],
            ['dash-warning', c.warning],
            ['dash-critical', c.critical],
            ['dash-neutral', c.neutral],
          ] as [string, string][]
        ).map(([id, col]) => (
          <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={col} stopOpacity={0.95} />
            <stop offset="100%" stopColor={col} stopOpacity={0.68} />
          </linearGradient>
        ))}
      </defs>
    ),
    [c],
  )

  const total = data?.kpis.televisores ?? 0
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0)

  const horaTxt = updated
    ? updated.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <>
      {/* Encabezado */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Inhabilitaciones, efectividad, actividad y auditoría.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {horaTxt && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Actualizado {horaTxt}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => cargar(periodo)}
            disabled={loading}
          >
            <I.Refresh className={loading ? 'animate-spin' : ''} />
            Actualizar
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <I.Shield />
          <AlertTitle>Ocurrió un problema</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading || !data ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            <StatTile
              label="Televisores"
              value={total.toLocaleString('es-CO')}
              tone="brand"
              icon={<I.Tv className="h-5 w-5" />}
              hint="Total registrados"
            />
            <StatTile
              label="Inhabilitados"
              value={data.kpis.inhabilitados.toLocaleString('es-CO')}
              tone="rose"
              icon={<I.Lock className="h-5 w-5" />}
              share={pct(data.kpis.inhabilitados)}
              hint="del total"
            />
            <StatTile
              label="Habilitados"
              value={data.kpis.habilitados.toLocaleString('es-CO')}
              tone="emerald"
              icon={<I.Unlock className="h-5 w-5" />}
              share={pct(data.kpis.habilitados)}
              hint="del total"
            />
            <StatTile
              label="Financiados"
              value={data.kpis.financiados.toLocaleString('es-CO')}
              tone="sky"
              icon={<I.Card className="h-5 w-5" />}
              share={pct(data.kpis.financiados)}
              hint="con crédito"
            />
            <StatTile
              label="Pines entregados"
              value={data.kpis.pines_entregados.toLocaleString('es-CO')}
              tone="amber"
              icon={<I.Key className="h-5 w-5" />}
              hint="Total histórico"
            />
          </div>

          <SectionTitle>Estado general</SectionTitle>

          {/* Fila 1: estado general (donut) + estatus por financiado (barras) */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ChartCard
              title="Estatus de inhabilitación"
              subtitle="Distribución general de televisores"
              filename="estatus_general"
              colors={c}
              tone="brand"
              icon={<I.PieIcon className="h-5 w-5" />}
              onExcel={() => descargar(dashboardApi.exportEstatus)}
            >
              {total === 0 ? (
                <Empty>Aún no hay televisores registrados.</Empty>
              ) : (
                <Donut
                  colors={c}
                  centerValue={total.toLocaleString('es-CO')}
                  centerLabel="Televisores"
                  data={[
                    { name: 'Habilitados', value: data.kpis.habilitados, color: c.good },
                    { name: 'Inhabilitados', value: data.kpis.inhabilitados, color: c.critical },
                  ]}
                />
              )}
            </ChartCard>

            <ChartCard
              title="Estatus por producto financiado"
              subtitle="Financiado = tiene número de crédito"
              filename="estatus_financiado"
              colors={c}
              tone="sky"
              icon={<I.Bars className="h-5 w-5" />}
              onExcel={() => descargar(dashboardApi.exportEstatus)}
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={[
                    {
                      estado: 'Inhabilitados',
                      Financiado: data.estatus_inhabilitacion.inhabilitado.financiado,
                      'No financiado': data.estatus_inhabilitacion.inhabilitado.no_financiado,
                    },
                    {
                      estado: 'Habilitados',
                      Financiado: data.estatus_inhabilitacion.habilitado.financiado,
                      'No financiado': data.estatus_inhabilitacion.habilitado.no_financiado,
                    },
                  ]}
                  margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                >
                  {barDefs}
                  <CartesianGrid stroke={c.grid} vertical={false} />
                  <XAxis dataKey="estado" {...axis} />
                  <YAxis allowDecimals={false} {...axis} />
                  <Tooltip {...t} cursor={{ fill: c.grid, opacity: 0.3 }} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
                    content={() => (
                      <ChartLegend
                        textColor={c.text}
                        items={legendItems([
                          ['Financiado', c.blue],
                          ['No financiado', c.neutral],
                        ])}
                      />
                    )}
                  />
                  <Bar dataKey="Financiado" stackId="a" fill="url(#dash-blue)" maxBarSize={64} />
                  <Bar dataKey="No financiado" stackId="a" fill="url(#dash-neutral)" radius={[5, 5, 0, 0]} maxBarSize={64} />
                </BarChart>
              </ResponsiveContainer>
              <DataLabels
                groups={[
                  {
                    label: 'Inhabilitados',
                    values: [
                      {
                        label: 'Financiado',
                        value: data.estatus_inhabilitacion.inhabilitado.financiado,
                        color: c.blue,
                      },
                      {
                        label: 'No financiado',
                        value: data.estatus_inhabilitacion.inhabilitado.no_financiado,
                        color: c.neutral,
                      },
                    ],
                  },
                  {
                    label: 'Habilitados',
                    values: [
                      {
                        label: 'Financiado',
                        value: data.estatus_inhabilitacion.habilitado.financiado,
                        color: c.blue,
                      },
                      {
                        label: 'No financiado',
                        value: data.estatus_inhabilitacion.habilitado.no_financiado,
                        color: c.neutral,
                      },
                    ],
                  },
                ]}
              />
            </ChartCard>
          </div>

          <SectionTitle>Efectividad y tendencia</SectionTitle>

          {/* Fila 2: efectividad (barras apiladas) + serie temporal (barras) */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ChartCard
              title="Efectividad de la inhabilitación"
              subtitle="Acción enviada vs. efectiva / en proceso / error"
              filename="efectividad"
              colors={c}
              tone="emerald"
              icon={<I.Target className="h-5 w-5" />}
              onExcel={() => descargar(dashboardApi.exportEfectividad)}
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={[
                    {
                      accion: 'Inhabilitación',
                      Efectivas: data.efectividad.inhabilitacion.efectivas,
                      'En proceso': data.efectividad.inhabilitacion.en_proceso,
                      Error: data.efectividad.inhabilitacion.error,
                    },
                    {
                      accion: 'Habilitación',
                      Efectivas: data.efectividad.habilitacion.efectivas,
                      'En proceso': data.efectividad.habilitacion.en_proceso,
                      Error: data.efectividad.habilitacion.error,
                    },
                  ]}
                  margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                >
                  {barDefs}
                  <CartesianGrid stroke={c.grid} vertical={false} />
                  <XAxis dataKey="accion" {...axis} />
                  <YAxis allowDecimals={false} {...axis} />
                  <Tooltip {...t} cursor={{ fill: c.grid, opacity: 0.3 }} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
                    content={() => (
                      <ChartLegend
                        textColor={c.text}
                        items={legendItems([
                          ['Efectivas', c.good],
                          ['En proceso', c.warning],
                          ['Error', c.critical],
                        ])}
                      />
                    )}
                  />
                  <Bar dataKey="Efectivas" stackId="a" fill="url(#dash-good)" maxBarSize={64} />
                  <Bar dataKey="En proceso" stackId="a" fill="url(#dash-warning)" maxBarSize={64} />
                  <Bar dataKey="Error" stackId="a" fill="url(#dash-critical)" radius={[5, 5, 0, 0]} maxBarSize={64} />
                </BarChart>
              </ResponsiveContainer>
              <DataLabels
                groups={[
                  {
                    label: 'Inhabilitación',
                    values: [
                      {
                        label: 'Efectivas',
                        value: data.efectividad.inhabilitacion.efectivas,
                        color: c.good,
                      },
                      {
                        label: 'En proceso',
                        value: data.efectividad.inhabilitacion.en_proceso,
                        color: c.warning,
                      },
                      {
                        label: 'Error',
                        value: data.efectividad.inhabilitacion.error,
                        color: c.critical,
                      },
                    ],
                  },
                  {
                    label: 'Habilitación',
                    values: [
                      {
                        label: 'Efectivas',
                        value: data.efectividad.habilitacion.efectivas,
                        color: c.good,
                      },
                      {
                        label: 'En proceso',
                        value: data.efectividad.habilitacion.en_proceso,
                        color: c.warning,
                      },
                      {
                        label: 'Error',
                        value: data.efectividad.habilitacion.error,
                        color: c.critical,
                      },
                    ],
                  },
                ]}
              />
            </ChartCard>

            <ChartCard
              title="Inhabilitaciones vs. habilitaciones"
              subtitle="Tendencia por período"
              filename={`tendencia_${periodo}`}
              colors={c}
              tone="brand"
              icon={<I.Trend className="h-5 w-5" />}
              onExcel={() => descargar(() => dashboardApi.exportTendencia(periodo))}
              headerRight={
                <PeriodSelector value={periodo} onChange={setPeriodo} options={PERIODOS} />
              }
            >
              {data.serie_tiempo.datos.length === 0 ? (
                <Empty>Aún no hay acciones registradas.</Empty>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={data.serie_tiempo.datos.map((d) => ({
                      periodo: d.periodo,
                      Inhabilitaciones: d.inhabilitaciones,
                      Habilitaciones: d.habilitaciones,
                    }))}
                    margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                  >
                    {barDefs}
                    <CartesianGrid stroke={c.grid} vertical={false} />
                    <XAxis dataKey="periodo" {...axis} />
                    <YAxis allowDecimals={false} {...axis} />
                    <Tooltip {...t} cursor={{ fill: c.grid, opacity: 0.3 }} />
                    <Legend
                      wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
                      content={() => (
                        <ChartLegend
                          textColor={c.text}
                          items={legendItems([
                            ['Inhabilitaciones', c.blue],
                            ['Habilitaciones', c.orange],
                          ])}
                        />
                      )}
                    />
                    <Bar dataKey="Inhabilitaciones" fill="url(#dash-blue)" radius={[5, 5, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="Habilitaciones" fill="url(#dash-orange)" radius={[5, 5, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <DataLabels groups={tendenciaLabels} note={tendenciaNote} />
            </ChartCard>
          </div>

          <SectionTitle>Actividad y usuarios</SectionTitle>

          {/* Fila 3: dispersión actividad por equipo + usuarios (donut) */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ChartCard
              title="Actividad por equipo"
              subtitle="Inhabilitaciones vs. habilitaciones por serial"
              filename="actividad_por_equipo"
              colors={c}
              tone="sky"
              icon={<I.Activity className="h-5 w-5" />}
              onExcel={() => descargar(dashboardApi.exportHistorialAcciones)}
            >
              {data.actividad_por_equipo.length === 0 ? (
                <Empty>Aún no hay acciones registradas.</Empty>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <ScatterChart margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                    <CartesianGrid stroke={c.grid} />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name="Inhabilitaciones"
                      allowDecimals={false}
                      {...axis}
                      label={{
                        value: 'Inhabilitaciones',
                        position: 'insideBottom',
                        offset: -2,
                        fill: c.muted,
                        fontSize: 11,
                      }}
                    />
                    <YAxis type="number" dataKey="y" name="Habilitaciones" allowDecimals={false} {...axis} />
                    <ZAxis type="number" dataKey="z" range={[60, 420]} name="Total" />
                    <Tooltip
                      {...t}
                      cursor={{ strokeDasharray: '3 3', stroke: c.axis }}
                      formatter={(value, name) => [value as number, name as string]}
                    />
                    <Scatter
                      name="Equipos"
                      data={data.actividad_por_equipo.map((eq) => ({
                        x: eq.inhabilitaciones,
                        y: eq.habilitaciones,
                        z: eq.total,
                        serial: eq.serial || eq.mac,
                      }))}
                      fill={c.blue}
                      fillOpacity={0.65}
                      stroke={c.surface}
                      strokeWidth={1.5}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              )}
              <DataLabels groups={actividadLabels} note={actividadNote} />
            </ChartCard>

            <ChartCard
              title="Usuarios de la plataforma"
              subtitle={`${data.usuarios.total} registrados · ${data.usuarios.staff} staff`}
              filename="usuarios"
              colors={c}
              tone="amber"
              icon={<I.Users className="h-5 w-5" />}
              onExcel={() => descargar(dashboardApi.exportUsuarios)}
            >
              {data.usuarios.total === 0 ? (
                <Empty>No hay usuarios registrados.</Empty>
              ) : (
                <Donut
                  colors={c}
                  centerValue={data.usuarios.total.toLocaleString('es-CO')}
                  centerLabel="Usuarios"
                  data={[
                    { name: 'Activos', value: data.usuarios.activos, color: c.good },
                    { name: 'Inactivos', value: data.usuarios.inactivos, color: c.neutral },
                  ]}
                />
              )}
            </ChartCard>
          </div>

          <SectionTitle>Reportes descargables</SectionTitle>

          <ReportesDescargables
            serial={serial}
            setSerial={setSerial}
            desde={desde}
            setDesde={setDesde}
            hasta={hasta}
            setHasta={setHasta}
            periodo={periodo}
            descargar={descargar}
          />
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Skeleton de carga
// ---------------------------------------------------------------------------
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="gap-0 p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-8 w-20" />
            <Skeleton className="mt-3 h-1.5 w-full" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="gap-4 p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-[240px] w-full rounded-xl" />
          </Card>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sección de reportes descargables (Excel a nivel de registro)
// ---------------------------------------------------------------------------
function ReportItem({
  icon,
  tone,
  title,
  desc,
  children,
}: {
  icon: ReactNode
  tone: Tone
  title: string
  desc: string
  children: ReactNode
}) {
  // Monocromático: mismo gris neutro para todos.
  const chipClass = 'bg-muted text-muted-foreground'
  const chip: Record<Tone, string> = {
    brand: chipClass,
    rose: chipClass,
    emerald: chipClass,
    sky: chipClass,
    amber: chipClass,
    slate: chipClass,
  }
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4 transition hover:bg-muted/50">
      <div className="flex items-start gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${chip[tone]}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function ExcelBtn({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <I.Excel />
      {disabled ? 'Pendiente' : 'Excel'}
    </Button>
  )
}

function ReportesDescargables({
  serial,
  setSerial,
  desde,
  setDesde,
  hasta,
  setHasta,
  periodo,
  descargar,
}: {
  serial: string
  setSerial: (v: string) => void
  desde: string
  setDesde: (v: string) => void
  hasta: string
  setHasta: (v: string) => void
  periodo: Periodo
  descargar: (fn: () => Promise<void>) => Promise<void>
}) {
  return (
    <Card className="gap-4 p-5">
      <p className="text-xs text-muted-foreground">
        Descarga los registros a nivel de detalle en Excel (.xlsx).
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <ReportItem
          icon={<I.PieIcon className="h-4 w-4" />}
          tone="brand"
          title="Estatus de inhabilitación"
          desc="Por equipo, discriminando producto financiado."
        >
          <ExcelBtn onClick={() => descargar(dashboardApi.exportEstatus)} />
        </ReportItem>

        <ReportItem
          icon={<I.Target className="h-4 w-4" />}
          tone="emerald"
          title="Efectividad de la inhabilitación"
          desc="Enviadas vs. efectivas / en proceso / error."
        >
          <ExcelBtn onClick={() => descargar(dashboardApi.exportEfectividad)} />
        </ReportItem>

        <ReportItem
          icon={<I.Trend className="h-4 w-4" />}
          tone="sky"
          title="Tendencia (comparativos)"
          desc="Inhabilitaciones/habilitaciones por período."
        >
          <ExcelBtn onClick={() => descargar(() => dashboardApi.exportTendencia(periodo))} />
        </ReportItem>

        <ReportItem
          icon={<I.Search className="h-4 w-4" />}
          tone="amber"
          title="Histórico por Serial"
          desc="Fechas y horas de cada acción. Filtra por serial."
        >
          <Input
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="Serial…"
            className="w-32"
          />
          <ExcelBtn onClick={() => descargar(() => dashboardApi.exportHistoricoSerial(serial))} />
        </ReportItem>

        <ReportItem
          icon={<I.Activity className="h-4 w-4" />}
          tone="sky"
          title="Historial de acciones por equipo"
          desc="Masivo y unitario, con usuario e IP."
        >
          <ExcelBtn onClick={() => descargar(dashboardApi.exportHistorialAcciones)} />
        </ReportItem>

        <ReportItem
          icon={<I.Users className="h-4 w-4" />}
          tone="amber"
          title="Usuarios registrados"
          desc="Todos los usuarios y su estado (activo/inactivo/staff)."
        >
          <ExcelBtn onClick={() => descargar(dashboardApi.exportUsuarios)} />
        </ReportItem>

        <ReportItem
          icon={<I.Shield className="h-4 w-4" />}
          tone="rose"
          title="Acciones por usuario (auditoría)"
          desc="Quién envía cada acción, con IP, fecha y hora."
        >
          <ExcelBtn onClick={() => descargar(dashboardApi.exportAccionesUsuario)} />
        </ReportItem>

        <ReportItem
          icon={<I.Key className="h-4 w-4" />}
          tone="amber"
          title="Auditoría de pines por usuario"
          desc="Pines entregados por usuario en un período."
        >
          <RangoFechas
            desde={desde}
            hasta={hasta}
            setDesde={setDesde}
            setHasta={setHasta}
          />
          <ExcelBtn onClick={() => descargar(() => dashboardApi.exportPinesAuditoria(desde, hasta))} />
        </ReportItem>

        <ReportItem
          icon={<I.Popup className="h-4 w-4" />}
          tone="slate"
          title="Mensajería Pop Up por Serial"
          desc="Requiere registrar los mensajes pop-up (no disponible aún)."
        >
          <ExcelBtn disabled />
        </ReportItem>
      </div>
    </Card>
  )
}
