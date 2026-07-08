// Punto único donde se componen los proveedores globales de la app.
// Al añadir más (tema, i18n, etc.) se anidan aquí sin tocar el resto.

import { AuthProvider } from '@/features/auth/context/auth-provider'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
