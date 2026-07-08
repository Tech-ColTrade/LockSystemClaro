import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/context/auth-context'
import { ApiError } from '@/lib/http/errors'

interface LocationState {
  from?: { pathname: string }
}

export function LoginPage() {
  const { status, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Si ya hay sesión, no mostramos el login.
  if (status === 'authenticated') return <Navigate to="/" replace />

  const from = (location.state as LocationState | null)?.from?.pathname ?? '/'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Credenciales inválidas. Revisa tu correo y contraseña.')
      } else {
        setError('No fue posible iniciar sesión. Intenta de nuevo.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Panel izquierdo (oculto en móvil) */}
      <div className="hidden w-1/2 flex-col justify-center bg-gradient-to-br from-[#2b1020] via-[#7a0f43] to-whale px-14 text-white md:flex">
        <div className="mb-8 text-3xl font-extrabold tracking-tight">
          <span className="text-white">Locking</span>{' '}
          <span className="text-white/80">System</span>
        </div>
        <h1 className="text-5xl font-extrabold leading-tight">
          Bienvenido a
          <br />
          Locking System
        </h1>
        <p className="mt-6 max-w-sm text-white/70">
          Gestiona la inhabilitación de tus televisores Locking System.
        </p>
      </div>

      {/* Panel derecho: formulario de login */}
      <div className="flex w-full items-center justify-center bg-gray-50 px-6 md:w-1/2">
        <div className="w-full max-w-sm">
          <h2 className="mb-1 text-2xl font-bold text-gray-800">
            Iniciar sesión
          </h2>
          <p className="mb-6 text-sm text-gray-500">
            Inicia sesión con tu correo y contraseña
          </p>

          {error && (
            <div
              className="mb-4 rounded-lg bg-red-100 px-4 py-2.5 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-semibold text-gray-600"
              >
                Correo
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="tu@correo.com"
                autoComplete="email"
                className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-whale focus:ring-2 focus:ring-whale/20 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-semibold text-gray-600"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pr-11 pl-3.5 text-sm text-gray-900 focus:border-whale focus:ring-2 focus:ring-whale/20 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                  }
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex items-center rounded-none border-0 bg-transparent px-3 text-gray-400 transition-colors hover:text-whale focus:text-whale focus:outline-none"
                >
                  {showPassword ? (
                    // Ojo tachado (ocultar)
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" x2="22" y1="2" y2="22" />
                    </svg>
                  ) : (
                    // Ojo (mostrar)
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-whale py-2.5 font-semibold text-white transition hover:bg-whale-dark disabled:opacity-60"
            >
              {submitting ? 'Ingresando…' : 'Iniciar sesión'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
