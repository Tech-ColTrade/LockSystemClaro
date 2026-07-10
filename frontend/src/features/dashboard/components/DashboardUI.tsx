import { useRef, type ReactNode } from 'react'
import { Download } from 'lucide-react'
import { downloadChartPng } from '@/features/dashboard/chartExport'
import type { ChartColors } from '@/features/dashboard/chartTheme'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Paleta de acentos para las tarjetas (chip del icono + barra de proporción).
// Los VALORES de los KPI se mantienen en tinta neutra; la identidad la lleva
// el chip de color, para no competir con los colores de los gráficos.
// ---------------------------------------------------------------------------
export type Tone = 'brand' | 'rose' | 'emerald' | 'sky' | 'amber' | 'slate'

// Monocromático: todos los tonos usan el mismo gris neutro (look shadcn).
const CHIP = 'bg-muted text-muted-foreground'
const TONE_CHIP: Record<Tone, string> = {
  brand: CHIP,
  rose: CHIP,
  emerald: CHIP,
  sky: CHIP,
  amber: CHIP,
  slate: CHIP,
}

const BAR = 'bg-muted-foreground'
const TONE_BAR: Record<Tone, string> = {
  brand: BAR,
  rose: BAR,
  emerald: BAR,
  sky: BAR,
  amber: BAR,
  slate: BAR,
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
    <Card className="gap-0 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
            {label}
          </div>
          <div className="mt-1 text-3xl font-bold tabular-nums text-foreground">
            {value}
          </div>
        </div>
        {icon && (
          <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', TONE_CHIP[tone])}>
            {icon}
          </div>
        )}
      </div>

      {typeof share === 'number' ? (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[0.7rem] font-medium text-muted-foreground">
            <span>{hint ?? 'del total'}</span>
            <span className="tabular-nums">{share}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all duration-500', TONE_BAR[tone])}
              style={{ width: `${Math.min(100, Math.max(0, share))}%` }}
            />
          </div>
        </div>
      ) : (
        hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>
      )}
    </Card>
  )
}

// --- Título de grupo de secciones ---
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <h3 className="text-[0.7rem] font-bold tracking-widest text-muted-foreground uppercase">
        {children}
      </h3>
      <Separator className="flex-1" />
    </div>
  )
}

// --- Selector de período (shadcn Tabs como control segmentado) ---
export function PeriodSelector<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as T)}>
      <TabsList>
        {options.map((o) => (
          <TabsTrigger key={o.value} value={o.value}>
            {o.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

// --- Botón pequeño de exportación (shadcn Button) ---
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
    <Button type="button" variant="outline" size="sm" onClick={onClick} title={title}>
      <Download />
      {children}
    </Button>
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
  hidePng = false,
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
  /** Oculta el botón PNG (p. ej. cuando el contenido es una tabla). */
  hidePng?: boolean
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
    // overflow-visible: evita que la Card recorte los tooltips de recharts.
    <Card className="gap-4 overflow-visible p-5 transition-all duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', TONE_CHIP[tone])}>
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {headerRight}
          {!hidePng && (
            <ExportBtn onClick={exportarPng} title="Descargar imagen PNG">
              PNG
            </ExportBtn>
          )}
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
    </Card>
  )
}
