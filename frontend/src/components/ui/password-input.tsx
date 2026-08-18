import * as React from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface PasswordInputProps extends Omit<React.ComponentProps<'input'>, 'type'> {
  /** Candado decorativo a la izquierda (lo usan las pantallas de acceso). */
  conCandado?: boolean
}

/**
 * Campo de contraseña con botón de mostrar/ocultar SIEMPRE visible.
 *
 * Por qué existe: Edge (y Chrome en algunas versiones) pinta su propio ojito
 * dentro de los `input[type=password]`, pero solo mientras el campo tiene el
 * foco. QA lo reportó como un fallo — el botón "desaparecía" al salir del
 * campo — y con razón: un control que va y viene no es un control. Aquí el
 * botón es nuestro, así que se queda puesto, y el nativo se oculta
 * (`::-ms-reveal`) para no mostrar dos ojos a la vez.
 */
function PasswordInput({
  className,
  conCandado = false,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative">
      {conCandado && (
        <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      )}
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn(
          'pr-10 [&::-ms-reveal]:hidden',
          conCandado && 'pl-9',
          className,
        )}
      />
      {/* Ojito SIN fondo (solo cambia el color al pasar el cursor). */}
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        // `tabIndex={-1}`: al tabular desde el campo se debe ir al siguiente
        // campo del formulario, no al ojito. Sigue siendo alcanzable con el
        // ratón y anunciado por el lector de pantalla.
        tabIndex={-1}
        className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md bg-transparent text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

export { PasswordInput }
