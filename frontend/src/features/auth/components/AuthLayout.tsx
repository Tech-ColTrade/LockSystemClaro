// Marco visual compartido por las pantallas públicas de autenticación
// (login, recuperar contraseña, restablecer contraseña): panel de marca a la
// izquierda y tarjeta de formulario a la derecha.
//
// Vive aparte para que las tres pantallas se vean como una sola: antes esto
// estaba dentro de LoginPage y duplicarlo habría hecho que se desincronizaran
// al primer retoque de diseño.

import { CheckCircle2, Lock, ShieldCheck } from 'lucide-react'

// Tema FIJO para las pantallas de autenticación: redefinimos localmente las
// variables que el sistema de acento (y el modo oscuro) sobrescriben en <html>,
// para que se vean siempre igual — monocromáticas blanco/negro — sin importar
// la configuración del usuario. Al vivir en el contenedor, estas variables
// ganan sobre las de <html> para todo su subárbol.
const STATIC_THEME: React.CSSProperties = {
  colorScheme: 'light',
  '--background': 'oklch(1 0 0)',
  '--foreground': 'oklch(0.145 0 0)',
  '--card': 'oklch(1 0 0)',
  '--card-foreground': 'oklch(0.145 0 0)',
  '--secondary': 'oklch(0.97 0 0)',
  '--secondary-foreground': 'oklch(0.205 0 0)',
  '--muted': 'oklch(0.97 0 0)',
  '--muted-foreground': 'oklch(0.556 0 0)',
  '--destructive': 'oklch(0.577 0.245 27.325)',
  '--border': 'oklch(0.922 0 0)',
  '--input': 'oklch(0.922 0 0)',
  // Acento monocromático: negro tinta, texto blanco.
  '--primary': 'oklch(0.145 0 0)',
  '--primary-foreground': 'oklch(1 0 0)',
  '--ring': 'oklch(0.145 0 0)',
} as React.CSSProperties

// Patrón de rejilla sutil para el panel negro (líneas blancas muy tenues),
// difuminado hacia los bordes con una máscara radial.
const GRID_PATTERN: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)',
  backgroundSize: '46px 46px',
  maskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, #000 40%, transparent 100%)',
  WebkitMaskImage:
    'radial-gradient(ellipse 80% 70% at 50% 40%, #000 40%, transparent 100%)',
}

export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 7a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4c2.5.4 4 2.3 4 5 0 3-2.2 5-6 5-1.6 0-2.9-.4-3.9-1.2-.7.8-1.8 1.2-3.1 1.2H7a4 4 0 0 1-4-4V7Zm5 3a1.2 1.2 0 1 0 0 2.4A1.2 1.2 0 0 0 8 10Z" />
    </svg>
  )
}

const FEATURES = [
  'Inhabilitación remota de televisores',
  'Reportes y auditoría en tiempo real',
  'Control de pines y sincronizaciones',
]

interface AuthLayoutProps {
  /** Titular del panel de marca. Admite saltos de línea con <br />. */
  titulo: React.ReactNode
  /** Bajada bajo el titular. */
  descripcion: string
  children: React.ReactNode
}

export function AuthLayout({ titulo, descripcion, children }: AuthLayoutProps) {
  return (
    <div style={STATIC_THEME} className="flex min-h-screen bg-background text-foreground">
      {/* Panel izquierdo (marca) — negro, oculto en móvil */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[#0a0a0a] p-14 text-white lg:flex">
        {/* Rejilla sutil */}
        <div className="pointer-events-none absolute inset-0" style={GRID_PATTERN} />
        {/* Halos difusos en blanco/gris para dar profundidad */}
        <div className="pointer-events-none absolute -top-32 -right-24 size-[26rem] rounded-full bg-white/[0.07] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 size-[26rem] rounded-full bg-white/[0.04] blur-3xl" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
            <BrandLogo className="size-6" />
          </div>
          <span className="text-xl font-extrabold tracking-tight">Locking System</span>
        </div>

        {/* Titular + features */}
        <div className="relative">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/70 backdrop-blur">
            <ShieldCheck className="size-3.5" />
            Plataforma de control
          </div>

          <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight">{titulo}</h1>
          <p className="mt-5 max-w-sm text-lg text-white/60">{descripcion}</p>

          <ul className="mt-9 flex flex-col gap-3.5">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-white/80">
                <CheckCircle2 className="size-5 shrink-0 text-white" />
                <span className="text-sm">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/40">
          © {new Date().getFullYear()} Locking System · Colombian Trade Company
        </p>
      </div>

      {/* Panel derecho (formulario) */}
      <div className="flex w-full items-center justify-center bg-muted/40 px-6 py-10 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Marca compacta para móvil (el panel negro está oculto) */}
          <div className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#0a0a0a] text-white shadow-sm">
              <BrandLogo className="size-5" />
            </div>
            <span className="text-lg font-extrabold tracking-tight text-foreground">
              Locking System
            </span>
          </div>

          {children}

          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <Lock className="size-3" />
            Conexión segura · Acceso restringido
          </p>
        </div>
      </div>
    </div>
  )
}
