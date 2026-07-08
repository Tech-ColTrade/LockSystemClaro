// Color de acento de la app. Tailwind v4 emite `var(--color-whale[-dark|-light])`
// en todas las utilidades `*-whale`, así que retematizamos en runtime
// sobrescribiendo esas 3 variables en <html>. Además fijamos `--primary-foreground`
// (color del texto sobre el acento) para que negro/blanco se lean bien. Se
// persiste en localStorage y se re-aplica antes de pintar en el script inline de
// index.html (misma clave y formato: "base|dark|light|fg").

import { useCallback, useState } from 'react'

export interface Accent {
  key: string
  name: string
  base: string
  dark: string
  light: string
  /** Color del texto/íconos sobre el acento (contraste). */
  fg: string
}

const WHITE = '#ffffff'
// Acento neutro ADAPTATIVO: usa los tokens del tema, así el acento es oscuro en
// modo claro y blanco en modo oscuro (nunca queda invisible). `fg` es el color
// del texto sobre el acento (el opuesto).
const FG = 'var(--foreground)'
const BG = 'var(--background)'

// Tripletas curadas (base + sombra + brillo) para que los degradados de marca
// se vean bien tanto en claro como en oscuro.
export const ACCENTS: Accent[] = [
  { key: 'rosa', name: 'Rosa', base: '#f6186a', dark: '#d10f57', light: '#ff5a98', fg: WHITE },
  { key: 'azul', name: 'Azul', base: '#2f6bed', dark: '#1d54cf', light: '#6f9bff', fg: WHITE },
  { key: 'violeta', name: 'Violeta', base: '#7c3aed', dark: '#6425cf', light: '#a882f7', fg: WHITE },
  { key: 'esmeralda', name: 'Esmeralda', base: '#0d9f6e', dark: '#0a7d55', light: '#34c48c', fg: WHITE },
  { key: 'naranja', name: 'Naranja', base: '#ef6c1a', dark: '#cf5600', light: '#ff9550', fg: WHITE },
  { key: 'cian', name: 'Cian', base: '#0891b2', dark: '#067291', light: '#22b8d8', fg: WHITE },
  { key: 'neutro', name: 'Neutro', base: FG, dark: FG, light: FG, fg: BG },
]

const STORAGE_KEY = 'ls.accent' // "base|dark|light|fg"
const KEY_NAME = 'ls.accent.key' // clave del preset (para marcar el seleccionado)

// Por defecto: acento Neutro (monocromático adaptativo), estilo shadcn.
export const DEFAULT_ACCENT = ACCENTS.find((a) => a.key === 'neutro') ?? ACCENTS[0]

export function applyAccent(a: Accent): void {
  const s = document.documentElement.style
  s.setProperty('--color-whale', a.base)
  s.setProperty('--color-whale-dark', a.dark)
  s.setProperty('--color-whale-light', a.light)
  s.setProperty('--primary-foreground', a.fg)
}

export function storeAccent(a: Accent): void {
  localStorage.setItem(STORAGE_KEY, `${a.base}|${a.dark}|${a.light}|${a.fg}`)
  localStorage.setItem(KEY_NAME, a.key)
}

/** Resuelve un preset por su clave; cae al acento por defecto si no existe. */
export function accentByKey(key: string | null | undefined): Accent {
  return ACCENTS.find((a) => a.key === key) ?? DEFAULT_ACCENT
}

/**
 * Aplica y cachea (localStorage) el acento a partir de su clave. Se usa al
 * iniciar/restaurar sesión, tomando la preferencia guardada en la cuenta como
 * fuente de verdad, y dejando la caché lista para el pintado previo de próximas
 * cargas (script inline de index.html).
 */
export function applyAccentKey(key: string | null | undefined): void {
  const a = accentByKey(key)
  applyAccent(a)
  storeAccent(a)
}

export function currentAccentKey(): string {
  return localStorage.getItem(KEY_NAME) ?? DEFAULT_ACCENT.key
}

/** Hook para la pantalla de Configuración. */
export function useAccent() {
  const [key, setKey] = useState(currentAccentKey)

  const setAccent = useCallback((a: Accent) => {
    applyAccent(a)
    storeAccent(a)
    setKey(a.key)
  }, [])

  return { key, setAccent }
}
