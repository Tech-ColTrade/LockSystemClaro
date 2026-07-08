// Paleta de los gráficos, con pasos validados para superficie clara y oscura
// (script validate_palette de la skill dataviz). Los colores de "estado"
// (bien/advertencia/crítico) siempre se acompañan de etiqueta y leyenda.

import { useIsDark } from '@/shared/hooks/useIsDark'

export interface ChartColors {
  surface: string
  text: string
  muted: string
  grid: string
  axis: string
  // Categóricos CVD-safe (serie temporal, discriminadores).
  blue: string
  orange: string
  neutral: string
  // Estado (outcome): siempre con etiqueta/leyenda.
  good: string
  warning: string
  critical: string
}

const LIGHT: ChartColors = {
  surface: '#ffffff',
  text: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  blue: '#2a78d6',
  orange: '#eb6834',
  neutral: '#9aa0a6',
  good: '#0ca30c',
  warning: '#e0900a',
  critical: '#d03b3b',
}

const DARK: ChartColors = {
  surface: '#1d1d22',
  text: '#c3c2b7',
  muted: '#a1a1aa',
  grid: '#2c2c2a',
  axis: '#383835',
  blue: '#3987e5',
  orange: '#d95926',
  neutral: '#7b8085',
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#e66767',
}

export function useChartColors(): ChartColors {
  return useIsDark() ? DARK : LIGHT
}
