import { useRef, type ReactNode } from 'react'
import { downloadChartPng } from '@/features/dashboard/chartExport'
import type { ChartColors } from '@/features/dashboard/chartTheme'

// ---------------------------------------------------------------------------
// Paleta de acentos para las tarjetas (chip del icono + textos de apoyo).
// Los VALORES de los KPI se mantienen en tinta neutra; la identidad la lleva
// el chip de color, para no competir con los colores de los gráficos.
// ---------------------------------------------------------------------------
export type Tone = 'brand' | 'rose' | 'emerald' | 'sky' | 'amber' | 'slate'

const TONE_CHIP: Record<Tone, string> = {
  brand: 'bg-whale/10 text-whale dark:bg-whale/20 dark:text-whale-light',
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300',
}

const TONE_BAR: Record<Tone, string> = {
  brand: 'bg-whale',
  rose: 'bg-rose-500',
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  amber: 'bg-amber-500',
  slate: 'bg-slate-400',
}

// --- Tarjeta de indicador (KPI) ---
export function StatTile({
  label,
  value,
  hint,
  tone = 'slate',
  icon,
  share,
}: {
  label: string
  value: number | string
  hint?: string
  tone?: Tone
  icon?: ReactNode
  /** Proporción 0–100 para la barrita inferior + porcentaje. */
  share?: number
}) {
  return (
    <div className="group card relative overflow-hidden !p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:hover:border-white/15">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[0.7rem] font-semibold tracking-wide text-gray-400 uppercase">
            {label}
          </div>
          <div className="mt-1 text-3xl font-bold tabular-nums text-gray-800 dark:text-white">
            {value}
          </div>
        </div>
        {icon && (
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONE_CHIP[tone]}`}
          >
            {icon}
          </div>
        )}
      </div>

      {typeof share === 'number' ? (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[0.7rem] font-medium text-gray-400">
            <span>{hint ?? 'del total'}</span>
            <span className="tabular-nums">{share}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
            <div
              className={`h-full rounded-full ${TONE_BAR[tone]} transition-all duration-500`}
              style={{ width: `${Math.min(100, Math.max(0, share))}%` }}
            />
          </div>
        </div>
      ) : (
        hint && <div className="mt-1.5 text-xs text-gray-400">{hint}</div>
      )}
    </div>
  )
}

// --- Título de grupo de secciones ---
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <h3 className="text-[0.7rem] font-bold tracking-widest text-gray-400 uppercase">
        {children}
      </h3>
      <div className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent dark:from-white/10" />
    </div>
  )
}

// --- Control segmentado (selector de período) ---
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="inline-flex rounded-lg bg-gray-100 p-0.5 dark:bg-white/5">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
              active
                ? 'bg-white text-whale shadow-sm dark:bg-whale/20 dark:text-whale-light'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// --- Botón pequeño de exportación (con icono) ---
function ExportBtn({
  onClick,
  children,
  title,
}: {
  onClick: () => void
  children: ReactNode
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[0.7rem] font-semibold text-gray-500 transition hover:border-gray-300 hover:text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
    >
      <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
      {children}
    </button>
  )
}

// --- Tarjeta contenedora de un gráfico, con exportación PNG + Excel ---
export function ChartCard({
  title,
  subtitle,
  filename,
  colors,
  onExcel,
  headerRight,
  icon,
  tone = 'brand',
  children,
}: {
  title: string
  subtitle?: string
  filename: string
  colors: ChartColors
  onExcel?: () => void
  headerRight?: ReactNode
  icon?: ReactNode
  tone?: Tone
  children: ReactNode
}) {
  const chartRef = useRef<HTMLDivElement>(null)

  const exportarPng = async () => {
    try {
      await downloadChartPng(chartRef.current, `${filename}.png`, colors.surface)
    } catch {
      /* silencioso: no bloquea la UI */
    }
  }

  return (
    <div className="card flex flex-col !p-5 transition-all duration-200 hover:shadow-md dark:hover:border-white/15">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONE_CHIP[tone]}`}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-800 dark:text-white">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {headerRight}
          <ExportBtn onClick={exportarPng} title="Descargar imagen PNG">
            PNG
          </ExportBtn>
          {onExcel && (
            <ExportBtn onClick={onExcel} title="Descargar Excel">
              Excel
            </ExportBtn>
          )}
        </div>
      </div>
      <div ref={chartRef} className="min-w-0 flex-1">
        {children}
      </div>
    </div>
  )
}
