import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/features/auth/context/auth-context'
import { usePermissions } from '@/features/auth/usePermissions'
import { useLayoutPrefs } from '@/shared/layout/useLayoutPrefs'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  /** Si es true, solo lo ve el Administrador. */
  adminOnly?: boolean
}

// Secciones de la app (equivalen a las páginas de whaletv).
const navItems: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    to: '/televisores',
    label: 'Televisores',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="2.5" y="4" width="19" height="12.5" rx="2" />
        <path d="M8 20.5h8M12 16.5v4" />
      </svg>
    ),
  },
  {
    to: '/sincronizaciones',
    label: 'Sincronizaciones',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M21 2v6h-6" />
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
        <path d="M3 22v-6h6" />
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      </svg>
    ),
  },
  {
    to: '/pincodes',
    label: 'Pincodes',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="7.5" cy="15.5" r="4.5" />
        <path d="m10.7 12.3 10-10M16 7l3 3M14 9l2 2" />
      </svg>
    ),
  },
  {
    to: '/usuarios',
    label: 'Usuarios',
    adminOnly: true,
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: '/configuracion',
    label: 'Configuración',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
]

export function Sidebar() {
  const { user, logout } = useAuth()
  const { isAdmin } = usePermissions()
  const { toggleSidebar } = useLayoutPrefs()

  // Nombre a mostrar: nombre completo si existe, si no el correo (fallback).
  const nombre = user?.full_name?.trim() || user?.first_name || user?.email || ''
  const inicial = (nombre[0] ?? '?').toUpperCase()
  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin)

  return (
    <aside
      id="sidebar"
      className="flex w-64 shrink-0 flex-col bg-gradient-to-b from-[#222228] to-[#141417] text-white"
    >
      {/* Logo */}
      <div className="logo-wrap flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-whale-light to-whale-dark shadow-lg shadow-whale/30">
          <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 7a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4c2.5.4 4 2.3 4 5 0 3-2.2 5-6 5-1.6 0-2.9-.4-3.9-1.2-.7.8-1.8 1.2-3.1 1.2H7a4 4 0 0 1-4-4V7Zm5 3a1.2 1.2 0 1 0 0 2.4A1.2 1.2 0 0 0 8 10Z" />
          </svg>
        </div>
        <div className="side-label text-xl font-extrabold tracking-tight">
          <span className="text-white">Locking</span>{' '}
          <span className="text-whale-light">System</span>
        </div>
      </div>

      {/* Navegación */}
      <div className="nav-section mt-2 mb-1 px-6 text-[0.65rem] font-semibold tracking-widest text-white/30 uppercase transition-opacity">
        Gestión
      </div>
      <nav className="flex-1 min-h-0 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={item.label}
            className={({ isActive }) =>
              isActive ? 'navlink navlink-active' : 'navlink'
            }
          >
            {item.icon}
            <span className="side-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Usuario */}
      <div className="user-wrap px-4 pb-4">
        <div className="user-card flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-whale-light to-whale-dark text-xs font-bold uppercase">
            {inicial}
          </div>
          <div className="side-label flex min-w-0 flex-1 flex-col">
            <span className="truncate text-xs font-semibold text-white">
              {nombre}
            </span>
            {user?.role_display && (
              <span className="truncate text-[0.65rem] font-semibold tracking-wide text-whale-light uppercase">
                {user.role_display}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={logout}
            title="Cerrar sesión"
            className="side-label border-0 bg-transparent p-0 text-white/40 transition hover:text-whale-light"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
            >
              <path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Colapsar */}
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={toggleSidebar}
          title="Ocultar / mostrar menú"
          className="flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 py-2 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <svg
            className="toggle-chevron h-5 w-5 transition-transform duration-200"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      </div>
    </aside>
  )
}
