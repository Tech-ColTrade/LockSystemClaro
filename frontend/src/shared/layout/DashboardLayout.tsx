// Chrome de la aplicación autenticada: sidebar fijo + área de contenido con
// barra de breadcrumb. Las páginas se renderizan en el <Outlet />.

import { Outlet, useMatches } from 'react-router-dom'
import { Sidebar } from '@/shared/layout/Sidebar'

interface RouteHandle {
  breadcrumb?: string
}

export function DashboardLayout() {
  const matches = useMatches()
  // Toma el breadcrumb de la ruta más profunda que lo defina.
  const breadcrumb =
    [...matches]
      .reverse()
      .map((m) => (m.handle as RouteHandle | undefined)?.breadcrumb)
      .find(Boolean) ?? 'Inicio'

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 border-b border-gray-100 bg-[#f4f5f7]/80 px-8 py-4 text-sm text-gray-500 backdrop-blur dark:bg-[#131316]/80">
          <span className="font-medium text-whale">{breadcrumb}</span>
        </div>

        <div className="px-8 py-7">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
