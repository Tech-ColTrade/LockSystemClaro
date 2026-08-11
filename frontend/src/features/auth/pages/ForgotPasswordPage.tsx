// Paso 1 de la recuperación: pedir el enlace por correo.
//
// La pantalla de éxito NO confirma que el correo exista — el backend responde
// igual en ambos casos a propósito, para que este formulario no sirva para
// averiguar qué correos están registrados. El texto está redactado en
// consecuencia ("si el correo corresponde a una cuenta…").

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CircleAlert, Loader2, Mail, MailCheck, Send } from 'lucide-react'
import { authApi } from '@/features/auth/api/auth.api'
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

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [minutos, setMinutos] = useState(10)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await authApi.requestPasswordReset(email)
      setMinutos(res.expira_minutos)
      setEnviado(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError(
          'Demasiados intentos. Espera un momento antes de volver a solicitarlo.',
        )
      } else {
        setError('No fue posible procesar la solicitud. Intenta de nuevo.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      titulo={
        <>
          Recupera el acceso
          <br />
          a tu cuenta
        </>
      }
      descripcion="Te enviamos un enlace seguro para que elijas una contraseña nueva."
    >
      <Card className="border-border/70 shadow-xl shadow-black/5">
        {enviado ? (
          <>
            <CardHeader>
              <div className="mb-1 flex size-11 items-center justify-center rounded-xl bg-secondary">
                <MailCheck className="size-5 text-foreground" />
              </div>
              <CardTitle className="text-xl font-bold">Revisa tu correo</CardTitle>
              <CardDescription>
                Si <span className="font-medium text-foreground">{email}</span>{' '}
                corresponde a una cuenta activa, te enviamos un enlace para
                restablecer tu contraseña.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                El enlace vence en{' '}
                <span className="font-medium text-foreground">{minutos} minutos</span>{' '}
                y solo se puede usar una vez. Si no lo ves, revisa la carpeta de
                spam.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setEnviado(false)
                  setError(null)
                }}
              >
                Usar otro correo
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
        ) : (
          <>
            <CardHeader>
              <CardTitle className="text-xl font-bold">
                ¿Olvidaste tu contraseña?
              </CardTitle>
              <CardDescription>
                Escribe tu correo y te enviamos un enlace para restablecerla.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
                {error && (
                  <Alert variant="destructive">
                    <CircleAlert />
                    <AlertDescription>{error}</AlertDescription>
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

                <Button type="submit" disabled={submitting} className="mt-1 w-full">
                  {submitting ? (
                    <Loader2 className="animate-spin" data-icon="inline-start" />
                  ) : (
                    <Send data-icon="inline-start" />
                  )}
                  {submitting ? 'Enviando…' : 'Enviar enlace'}
                </Button>

                <div className="text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none"
                  >
                    <ArrowLeft className="size-3.5" />
                    Volver al inicio de sesión
                  </Link>
                </div>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </AuthLayout>
  )
}
