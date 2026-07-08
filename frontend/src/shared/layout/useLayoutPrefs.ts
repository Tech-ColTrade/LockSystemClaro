// Estado de las preferencias de chrome (tema claro/oscuro y sidebar colapsado).
// Se sincroniza con la clase en <html> y con localStorage. El estado inicial se
// lee de las clases que el script inline de index.html ya aplicó (sin parpadeo).

import { useCallback, useState } from 'react'

export function useLayoutPrefs() {
  const [dark, setDark] = useState(
    () => document.documentElement.classList.contains('dark'),
  )
  const [collapsed, setCollapsed] = useState(
    () => document.documentElement.classList.contains('side-collapsed'),
  )

  const setTheme = useCallback((value: boolean) => {
    document.documentElement.classList.toggle('dark', value)
    localStorage.theme = value ? 'dark' : 'light'
    setDark(value)
  }, [])

  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      document.documentElement.classList.toggle('side-collapsed', next)
      localStorage.sidebar = next ? 'collapsed' : 'expanded'
      return next
    })
  }, [])

  return { dark, collapsed, setTheme, toggleSidebar }
}
