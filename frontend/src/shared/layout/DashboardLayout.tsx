// Chrome de la aplicación autenticada: sidebar shadcn (SidebarProvider) + área de
// contenido (SidebarInset) con barra superior de trigger + breadcrumb.

import { Outlet, useMatches } from 'react-router-dom'
import { AppSidebar } from '@/shared/layout/Sidebar'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
          <span className="text-sm font-medium text-whale">{breadcrumb}</span>
        </header>
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
