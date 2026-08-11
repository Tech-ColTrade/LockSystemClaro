// Vigilancia de la sesión contra el servidor.
//
// Sin esto, que te cierren la sesión desde fuera (un administrador la cierra,
// se revocan los tokens) no te sacaba de la aplicación hasta que hicieras algo
// que llamara a la API. Quien estuviera leyendo una pantalla quieta seguía
// viéndola como si nada.
//
// La comprobación es una llamada normal a /api/me/: si la sesión ya no vale, el
// backend responde 401 y el cliente HTTP dispara el aviso de fin de sesión
// (lib/http/session-events.ts), que el AuthProvider convierte en un logout y
// una redirección al login. Aquí no hace falta mirar el resultado.
//
// Importante: esta llamada NO cuenta como actividad. El latido que mantiene
// viva la sesión frente a la ventana de inactividad es la renovación del token,
// que solo ocurre cuando el usuario interactúa de verdad. Si este sondeo
// contara, una pestaña abierta y olvidada nunca caducaría.

import { useEffect } from 'react'
import { authApi } from '@/features/auth/api/auth.api'

/**
 * Cada cuánto se pregunta al servidor. 30 s es el compromiso: expulsa casi al
 * momento sin convertir cada sesión abierta en un goteo de peticiones.
 */
const INTERVALO_MS = 30_000

export function useVigilanciaSesion(activo: boolean): void {
  useEffect(() => {
    if (!activo) return

    async function comprobar() {
      // En segundo plano no se comprueba: no hay nada que mostrar y los
      // navegadores frenan los temporizadores igualmente. Al volver a la
      // pestaña se comprueba de inmediato (listener de abajo).
      if (document.visibilityState !== 'visible') return
      try {
        await authApi.me()
      } catch {
        // Un 401 ya disparó el aviso dentro del cliente HTTP; cualquier otro
        // fallo (red, 5xx) se ignora a propósito: el servidor caído no es una
        // sesión inválida y no debe echar a nadie.
      }
    }

    const id = setInterval(comprobar, INTERVALO_MS)
    document.addEventListener('visibilitychange', comprobar)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', comprobar)
    }
  }, [activo])
}
