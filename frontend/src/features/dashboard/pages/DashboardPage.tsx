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
  SectionTitle,
  Segmented,
  StatTile,
  type Tone,
} from '@/features/dashboard/components/DashboardUI'
import type { DashboardResumen, Periodo } from '@/features/dashboard/types'
import { ApiError } from '@/lib/http/errors'
import * as I from '@/features/dashboard/components/icons'

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
    <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-sm text-gray-400">
      <svg className="h-8 w-8 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M3 3v18h18" />
        <path d="M7 14l3-3 3 3 4-5" />
      </svg>
      {children}
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
          <span className="text-3xl font-bold tabular-nums text-gray-800 dark:text-white">
            {centerValue}
          </span>
          <span className="text-[0.7rem] font-medium tracking-wide text-gray-400 uppercase">
            {centerLabel}
          </span>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
            <span className="text-gray-500 dark:text-gray-300">{d.name}</span>
            <span className="font-semibold tabular-nums text-gray-700 dark:text-white">
              {d.value.toLocaleString('es-CO')}
            </span>
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

  // Leyenda: swatch con el color sólido de la serie (no el degradado) y el
  // texto en tinta neutra, como pide la guía de dataviz.
  const legendText = (v: ReactNode) => <span style={{ color: c.text }}>{v}</span>
  const legendPayload = (items: [string, string][]) =>
    items.map(([value, color], i) => ({
      value,
      type: 'circle' as const,
      color,
      id: String(i),
    }))

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
      {/* Hero */}
      <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[#26262d] via-[#1c1c22] to-[#141417] px-6 py-6 text-white shadow-lg">
        <div className="pointer-events-none absolute -top-20 -right-12 h-56 w-56 rounded-full bg-whale/25 blur-3xl" />
        <div className="pointer-events-none absolute top-8 right-40 h-32 w-32 rounded-full bg-sky-500/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-whale-light to-whale-dark shadow-lg shadow-whale/30">
              <I.Dashboard className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">Dashboard</h2>
              <p className="mt-0.5 text-sm text-white/50">
                Inhabilitaciones, efectividad, actividad y auditoría del parque.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {horaTxt && (
              <span className="hidden items-center gap-1.5 text-xs text-white/40 sm:flex">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Actualizado {horaTxt}
              </span>
            )}
            <button
              type="button"
              onClick={() => cargar(periodo)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-50"
            >
              <I.Refresh className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {error && <div className="msg msg-error">{error}</div>}

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
              hint="Parque total"
            />
            <StatTile
              label="Inhabilitados"
              value={data.kpis.inhabilitados.toLocaleString('es-CO')}
              tone="rose"
              icon={<I.Lock className="h-5 w-5" />}
              share={pct(data.kpis.inhabilitados)}
              hint="del parque"
            />
            <StatTile
              label="Habilitados"
              value={data.kpis.habilitados.toLocaleString('es-CO')}
              tone="emerald"
              icon={<I.Unlock className="h-5 w-5" />}
              share={pct(data.kpis.habilitados)}
              hint="del parque"
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

          <SectionTitle>Estado del parque</SectionTitle>

          {/* Fila 1: estado general (donut) + estatus por financiado (barras) */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ChartCard
              title="Estatus de inhabilitación"
              subtitle="Distribución general del parque"
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
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
                    formatter={legendText}
                    payload={legendPayload([
                      ['Financiado', c.blue],
                      ['No financiado', c.neutral],
                    ])}
                  />
                  <Bar dataKey="Financiado" stackId="a" fill="url(#dash-blue)" maxBarSize={64} />
                  <Bar dataKey="No financiado" stackId="a" fill="url(#dash-neutral)" radius={[5, 5, 0, 0]} maxBarSize={64} />
                </BarChart>
              </ResponsiveContainer>
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
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
                    formatter={legendText}
                    payload={legendPayload([
                      ['Efectivas', c.good],
                      ['En proceso', c.warning],
                      ['Error', c.critical],
                    ])}
                  />
                  <Bar dataKey="Efectivas" stackId="a" fill="url(#dash-good)" maxBarSize={64} />
                  <Bar dataKey="En proceso" stackId="a" fill="url(#dash-warning)" maxBarSize={64} />
                  <Bar dataKey="Error" stackId="a" fill="url(#dash-critical)" radius={[5, 5, 0, 0]} maxBarSize={64} />
                </BarChart>
              </ResponsiveContainer>
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
                <Segmented value={periodo} onChange={setPeriodo} options={PERIODOS} />
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
                      iconType="circle"
                      wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
                      formatter={legendText}
                      payload={legendPayload([
                        ['Inhabilitaciones', c.blue],
                        ['Habilitaciones', c.orange],
                      ])}
                    />
                    <Bar dataKey="Inhabilitaciones" fill="url(#dash-blue)" radius={[5, 5, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="Habilitaciones" fill="url(#dash-orange)" radius={[5, 5, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
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
          <div key={i} className="card !p-4">
            <div className="h-3 w-16 animate-pulse rounded bg-gray-100 dark:bg-white/5" />
            <div className="mt-2 h-8 w-20 animate-pulse rounded bg-gray-100 dark:bg-white/5" />
            <div className="mt-3 h-1.5 w-full animate-pulse rounded bg-gray-100 dark:bg-white/5" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card !p-5">
            <div className="h-4 w-40 animate-pulse rounded bg-gray-100 dark:bg-white/5" />
            <div className="mt-4 h-[240px] animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />
          </div>
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
  const chip: Record<Tone, string> = {
    brand: 'bg-whale/10 text-whale dark:bg-whale/20 dark:text-whale-light',
    rose: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    sky: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300',
  }
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 p-4 transition hover:border-gray-200 hover:bg-gray-50/60 dark:border-white/10 dark:hover:border-white/20 dark:hover:bg-white/5">
      <div className="flex items-start gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${chip[tone]}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-800 dark:text-white">{title}</div>
          <div className="mt-0.5 text-xs text-gray-400">{desc}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function ExcelBtn({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      className="btn btn-ghost btn-sm inline-flex items-center gap-1 disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
    >
      <I.Excel className="h-3.5 w-3.5" />
      {disabled ? 'Pendiente' : 'Excel'}
    </button>
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
    <div className="card">
      <p className="mb-4 text-xs text-gray-400">
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
          <input
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="Serial…"
            className="inp !w-32 !py-1.5 text-xs"
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
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="inp !w-auto !py-1.5 text-xs"
          />
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="inp !w-auto !py-1.5 text-xs"
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
    </div>
  )
}
