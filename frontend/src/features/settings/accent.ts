// Color de acento de la app. Tailwind v4 emite `var(--color-whale[-dark|-light])`
// en todas las utilidades `*-whale`, así que retematizamos en runtime
// sobrescribiendo esas 3 variables en <html>. Se persiste en localStorage y se
// vuelve a aplicar antes de pintar mediante el script inline de index.html
// (misma clave y formato: "base|dark|light").

import { useCallback, useState } from 'react'

export interface Accent {
  key: string
  name: string
  base: string
  dark: string
  light: string
}

// Tripletas curadas (base + sombra + brillo) para que los degradados de marca
// se vean bien tanto en claro como en oscuro.
export const ACCENTS: Accent[] = [
  { key: 'rosa', name: 'Rosa', base: '#f6186a', dark: '#d10f57', light: '#ff5a98' },
  { key: 'azul', name: 'Azul', base: '#2f6bed', dark: '#1d54cf', light: '#6f9bff' },
  { key: 'violeta', name: 'Violeta', base: '#7c3aed', dark: '#6425cf', light: '#a882f7' },
  { key: 'esmeralda', name: 'Esmeralda', base: '#0d9f6e', dark: '#0a7d55', light: '#34c48c' },
  { key: 'naranja', name: 'Naranja', base: '#ef6c1a', dark: '#cf5600', light: '#ff9550' },
  { key: 'cian', name: 'Cian', base: '#0891b2', dark: '#067291', light: '#22b8d8' },
]

const STORAGE_KEY = 'ls.accent' // "base|dark|light"
const KEY_NAME = 'ls.accent.key' // clave del preset (para marcar el seleccionado)

export const DEFAULT_ACCENT = ACCENTS[0]

export function applyAccent(a: Accent): void {
  const s = document.documentElement.style
  s.setProperty('--color-whale', a.base)
  s.setProperty('--color-whale-dark', a.dark)
  s.setProperty('--color-whale-light', a.light)
}

export function storeAccent(a: Accent): void {
  localStorage.setItem(STORAGE_KEY, `${a.base}|${a.dark}|${a.light}`)
  localStorage.setItem(KEY_NAME, a.key)
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
