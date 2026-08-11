// Paso 2 de la recuperación: elegir la contraseña nueva desde el enlace.
//
// El token viaja en la query string (?token=…). Se valida ANTES de pintar el
// formulario para no hacer que el usuario escriba una contraseña y recién
// entonces enterarse de que el enlace venció.
//
// La cuenta atrás no es decorativa: el enlace muere a los 10 minutos, así que
// mostrar cuánto queda evita que alguien lo descubra al pulsar "Guardar".

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldX,
} from 'lucide-react'
import { authApi, type ResetTokenInfo } from '@/features/auth/api/auth.api'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
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
import { Label } from '@/components/ui/label'

type Estado =
  | { fase: 'validando' }
  | { fase: 'valido'; info: ResetTokenInfo }
  | { fase: 'invalido'; motivo: string }
  | { fase: 'listo' }

/** Mensaje para cada razón por la que un enlace deja de servir. */
const MOTIVOS: Record<string, string> = {
  vencido:
    'Este enlace venció. Los enlaces de recuperación duran 10 minutos por seguridad.',
  usado:
    'Este enlace ya se usó para cambiar la contraseña. Cada enlace sirve una sola vez.',
  invalido:
    'Este enlace no es válido. Puede estar incompleto o haber sido reemplazado por uno más reciente.',
}

/** Estado de la cuenta atrás del enlace. */
type CuentaAtras =
  /** Todavía no hay fecha (el token se está validando). */
  | { fase: 'sin-datos' }
  | { fase: 'corriendo'; texto: string }
  | { fase: 'agotada' }

/**
 * Cuenta atrás a partir de los SEGUNDOS que informa el servidor, no de una
 * fecha absoluta: así el reloj del equipo del usuario —que puede estar
 * desfasado— no decide si el enlace sigue vivo.
 *
 * Distinguir 'sin-datos' de 'agotada' es lo que impide el fallo que tenía esta
 * pantalla: mientras el token se validaba no había cuenta atrás, ese hueco se
 * leía como "ya venció" y el enlace se invalidaba solo nada más abrirlo.
 */
function usarCuentaAtras(segundosIniciales: number | undefined): CuentaAtras {
  // Momento en que empezó a contar; en una ref para no reiniciar el conteo en
  // cada render.
  const inicio = useRef<number>(0)
  const [transcurridos, setTranscurridos] = useState(0)

  useEffect(() => {
    if (segundosIniciales === undefined) return
    inicio.current = Date.now()
    setTranscurridos(0)
    const id = setInterval(() => {
      setTranscurridos(Math.floor((Date.now() - inicio.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [segundosIniciales])

  if (segundosIniciales === undefined) return { fase: 'sin-datos' }

  const restante = segundosIniciales - transcurridos
  if (restante <= 0) return { fase: 'agotada' }
  return {
    fase: 'corriendo',
    texto: `${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, '0')}`,
  }
}

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''

  const [estado, setEstado] = useState<Estado>({ fase: 'validando' })
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const validar = useCallback(async () => {
    if (!token) {
      setEstado({ fase: 'invalido', motivo: MOTIVOS.invalido })
      return
    }
    try {
      const info = await authApi.validateResetToken(token)
      setEstado({ fase: 'valido', info })
    } catch (err) {
      const motivo =
        err instanceof ApiError &&
        err.data &&
        typeof err.data === 'object' &&
        typeof (err.data as { motivo?: unknown }).motivo === 'string'
          ? (err.data as { motivo: string }).motivo
          : 'invalido'
      setEstado({ fase: 'invalido', motivo: MOTIVOS[motivo] ?? MOTIVOS.invalido })
    }
  }, [token])

  useEffect(() => {
    void validar()
  }, [validar])

  const cuenta = usarCuentaAtras(
    estado.fase === 'valido' ? estado.info.segundos_restantes : undefined,
  )

  // El enlace venció mientras la pestaña estaba abierta: no dejamos enviar un
  // formulario que el servidor va a rechazar. Solo cuenta 'agotada': el estado
  // 'sin-datos' significa "aún no lo sé", no "se acabó".
  useEffect(() => {
    if (estado.fase === 'valido' && cuenta.fase === 'agotada') {
      setEstado({ fase: 'invalido', motivo: MOTIVOS.vencido })
    }
  }, [estado.fase, cuenta.fase])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setSubmitting(true)
    try {
      await authApi.confirmPasswordReset(token, password)
      setEstado({ fase: 'listo' })
      // Lleva al login solo, para que no tenga que buscar el botón.
      setTimeout(() => navigate('/login', { replace: true }), 3000)
    } catch (err) {
      if (err instanceof ApiError && err.data && typeof err.data === 'object') {
        const data = err.data as Record<string, unknown>
        const primero = data.token ?? data.new_password ?? data.detail
        const mensaje = Array.isArray(primero) ? String(primero[0]) : String(primero ?? '')
        // Si lo que falló es el token, el formulario ya no sirve de nada.
        if (data.token) {
          setEstado({ fase: 'invalido', motivo: mensaje || MOTIVOS.invalido })
          return
        }
        setError(mensaje || 'No fue posible cambiar la contraseña.')
      } else {
        setError('No fue posible cambiar la contraseña. Intenta de nuevo.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      titulo={
        <>
          Elige una
          <br />
          contraseña nueva
        </>
      }
      descripcion="Al guardarla se cerrarán las sesiones abiertas en otros dispositivos."
    >
      <Card className="border-border/70 shadow-xl shadow-black/5">
        {estado.fase === 'validando' && (
          <CardContent className="flex flex-col items-center gap-3 py-14">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Verificando el enlace…</p>
          </CardContent>
        )}

        {estado.fase === 'invalido' && (
          <>
            <CardHeader>
              <div className="mb-1 flex size-11 items-center justify-center rounded-xl bg-destructive/10">
                <ShieldX className="size-5 text-destructive" />
              </div>
              <CardTitle className="text-xl font-bold">Enlace no válido</CardTitle>
              <CardDescription>{estado.motivo}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button render={<Link to="/recuperar-password" />} className="w-full">
                Solicitar un enlace nuevo
              </Button>
              <Button
                render={<Link to="/login" />}
                variant="ghost"
                className="w-full"
              >
                <ArrowLeft data-icon="inline-start" />
                Volver al inicio de sesión
              </Button>
            </CardContent>
          </>
        )}

        {estado.fase === 'listo' && (
          <>
            <CardHeader>
              <div className="mb-1 flex size-11 items-center justify-center rounded-xl bg-secondary">
                <CheckCircle2 className="size-5 text-foreground" />
              </div>
              <CardTitle className="text-xl font-bold">Contraseña actualizada</CardTitle>
              <CardDescription>
                Ya puedes iniciar sesión con tu nueva contraseña. Te llevamos al
                inicio de sesión…
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button render={<Link to="/login" />} className="w-full">
                Ir al inicio de sesión
              </Button>
            </CardContent>
          </>
        )}

        {estado.fase === 'valido' && (
          <>
            <CardHeader>
              <CardTitle className="text-xl font-bold">Nueva contraseña</CardTitle>
              <CardDescription>
                Para la cuenta{' '}
                <span className="font-medium text-foreground">{estado.info.email}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
                {cuenta.fase === 'corriendo' && (
                  <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">
                    <Clock className="size-4 shrink-0" />
                    <span>
                      El enlace vence en{' '}
                      <span className="font-medium tabular-nums text-foreground">
                        {cuenta.texto}
                      </span>
                    </span>
                  </div>
                )}

                {error && (
                  <Alert variant="destructive">
                    <CircleAlert />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="password">Nueva contraseña</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="pr-10 pl-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      aria-pressed={showPassword}
                      className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md bg-transparent text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mínimo 10 caracteres. Evita datos personales y contraseñas
                    comunes.
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="confirmacion">Confirmar contraseña</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirmacion"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmacion}
                      onChange={(e) => setConfirmacion(e.target.value)}
                      required
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="pl-9"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={submitting} className="mt-1 w-full">
                  {submitting && <Loader2 className="animate-spin" data-icon="inline-start" />}
                  {submitting ? 'Guardando…' : 'Guardar contraseña'}
                </Button>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </AuthLayout>
  )
}
