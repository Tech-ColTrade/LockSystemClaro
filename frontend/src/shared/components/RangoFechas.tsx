import { CalendarDays } from 'lucide-react'
import { es } from 'react-day-picker/locale'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/** Date -> 'YYYY-MM-DD' en hora local (no UTC: toISOString() correría el día). */
function toISO(d: Date | undefined): string {
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fromISO(s: string): Date | undefined {
  if (!s) return undefined
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

function fmtCorta(d: Date | undefined): string {
  return d
    ? d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    : ''
}

/** Selector de rango de fechas: Calendar de shadcn dentro de un Popover. */
export function RangoFechas({
  desde,
  hasta,
  setDesde,
  setHasta,
}: {
  desde: string
  hasta: string
  setDesde: (v: string) => void
  setHasta: (v: string) => void
}) {
  const from = fromISO(desde)
  const to = fromISO(hasta)
  const range: DateRange | undefined = from ? { from, to } : undefined
  const label = from
    ? to
      ? `${fmtCorta(from)} – ${fmtCorta(to)}`
      : fmtCorta(from)
    : 'Rango de fechas'

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="justify-start font-normal" />
        }
      >
        <CalendarDays data-icon="inline-start" />
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={range}
          onSelect={(r) => {
            setDesde(toISO(r?.from))
            setHasta(toISO(r?.to))
          }}
          captionLayout="dropdown"
          locale={es}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
