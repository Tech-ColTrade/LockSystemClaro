// Paleta de los gráficos — MONOCROMÁTICA (estilo shadcn neutro). En vez de hues
// (verde/ámbar/rojo/azul) usamos una rampa de GRISES con distinta luminosidad, así
// las series siguen siendo distinguibles pero el dashboard se ve neutro. Es un
// enfoque secuencial válido (mismo tono, claro→oscuro), no categórico por color.

import { useIsDark } from '@/shared/hooks/useIsDark'

export interface ChartColors {
  surface: string
  text: string
  muted: string
  grid: string
  axis: string
  // "Categóricos": grises con luminosidad distinta (no colores).
  blue: string
  orange: string
  neutral: string
  // Estado (outcome): también en grises, la identidad la da la leyenda/etiqueta.
  good: string
  warning: string
  critical: string
}

const LIGHT: ChartColors = {
  surface: '#ffffff',
  text: '#3f3f46',
  muted: '#71717a',
  grid: '#e4e4e7',
  axis: '#d4d4d8',
  blue: '#3f3f46', // serie 1 (oscuro)
  orange: '#a1a1aa', // serie 2 (medio)
  neutral: '#d4d4d8', // secundario (claro)
  good: '#52525b',
  warning: '#a1a1aa',
  critical: '#d4d4d8',
}

const DARK: ChartColors = {
  surface: '#262626',
  text: '#d4d4d8',
  muted: '#a1a1aa',
  grid: '#3a3a3e',
  axis: '#4a4a4f',
  blue: '#e4e4e7', // serie 1 (claro, prominente)
  orange: '#a1a1aa', // serie 2 (medio)
  neutral: '#52525b', // secundario (oscuro)
  good: '#d4d4d8',
  warning: '#a1a1aa',
  critical: '#6b6b72',
}

export function useChartColors(): ChartColors {
  return useIsDark() ? DARK : LIGHT
}
