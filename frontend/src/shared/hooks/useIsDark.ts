// Detecta el modo oscuro (clase `.dark` en <html>) de forma reactiva: se
// actualiza cuando el usuario cambia el tema desde el sidebar, para que los
// gráficos (que reciben colores como props) se repinten al vuelo.

import { useEffect, useState } from 'react'

export function useIsDark(): boolean {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark'),
  )

  useEffect(() => {
    const el = document.documentElement
    const observer = new MutationObserver(() => {
      setDark(el.classList.contains('dark'))
    })
    observer.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return dark
}
