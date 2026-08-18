import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, CircleAlert, Clock, Loader2, Mail } from 'lucide-react'
import { useAuth } from '@/features/auth/context/auth-context'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { avisoExpiracion } from '@/features/auth/useInactividad'
import { ApiError } from '@/lib/http/errors'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'

interface LocationState {
  from?: { pathname: string }
}

export function LoginPage() {
  const { status, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Segunda línea del error, para explicar cómo salir del paso (hoy solo la usa
  // el caso de "ya hay una sesión abierta").
  const [errorAyuda, setErrorAyuda] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Se lee una sola vez al montar (y se borra al leerlo): si no, el aviso
  // reaparecería en cada render y seguiría ahí tras volver a entrar.
  const [expirada, setExpirada] = useState(() => avisoExpiracion.consumir())

  // Si ya hay sesión, no mostramos el login.
  if (status === 'authenticated') return <Navigate to="/" replace />

  const from = (location.state as LocationState | null)?.from?.pathname ?? '/'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setErrorAyuda(null)
    setExpirada(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Sesión única. Dos casos, ambos 409, y el backend los distingue con
        // `code`: la cuenta ya está abierta en otro navegador (`sesion_activa`),
        // o este navegador ya tiene abierta otra cuenta (`navegador_ocupado`).
        const data = (err.data ?? {}) as {
          detail?: string
          code?: string
          expira_por_inactividad_minutos?: number
        }
        const otraCuentaAqui = data.code === 'navegador_ocupado'
        setError(
          data.detail ??
            (otraCuentaAqui
              ? 'Este navegador ya tiene una sesión abierta con otra cuenta.'
              : 'Esta cuenta ya tiene una sesión abierta en otro dispositivo.'),
        )
        const min = data.expira_por_inactividad_minutos
        setErrorAyuda(
          !min
            ? null
            : otraCuentaAqui
              ? `Cierra la sesión de la otra cuenta en este navegador, o entra desde otro navegador. La sesión también se libera sola tras ${min} minutos sin actividad.`
              : `Si cerraste el navegador sin salir, la sesión se libera sola tras ${min} minutos sin actividad. Un administrador también puede cerrarla desde Usuarios.`,
        )
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Credenciales inválidas. Revisa tu correo y contraseña.')
      } else {
        setError('No fue posible iniciar sesión. Intenta de nuevo.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      titulo={
        <>
          Control total de
          <br />
          tus televisores
        </>
      }
      descripcion="Gestiona la inhabilitación de tus televisores Locking System desde un solo lugar."
    >
      <Card className="border-border/70 shadow-xl shadow-black/5">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Iniciar sesión</CardTitle>
          <CardDescription>
            Ingresa con tu correo y contraseña para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
            {expirada && !error && (
              <Alert>
                <Clock />
                <AlertDescription>
                  {expirada} Ingresa de nuevo para continuar.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertDescription>
                  {error}
                  {errorAyuda && (
                    <span className="mt-1.5 block opacity-80">{errorAyuda}</span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-2">
              <Label htmlFor="email">Correo</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="tu@correo.com"
                  autoComplete="email"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <PasswordInput
                id="password"
                conCandado
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" disabled={submitting} className="mt-1 w-full group">
              {submitting && <Loader2 className="animate-spin" data-icon="inline-start" />}
              {submitting ? 'Ingresando…' : 'Iniciar sesión'}
              {!submitting && (
                <ArrowRight
                  className="transition-transform group-hover:translate-x-0.5"
                  data-icon="inline-end"
                />
              )}
            </Button>

            <div className="text-center">
              <Link
                to="/recuperar-password"
                className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
