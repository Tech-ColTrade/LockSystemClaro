// Punto único donde se componen los proveedores globales de la app.
// Al añadir más (tema, i18n, etc.) se anidan aquí sin tocar el resto.

import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/features/auth/context/auth-provider'
import { queryClient } from '@/lib/query/queryClient'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
}
