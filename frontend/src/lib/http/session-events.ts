// Aviso de "esta sesión dejó de valer", del cliente HTTP a la capa de React.
//
// El problema que resuelve: cuando el servidor invalida una sesión (un admin la
// cerró, se revocaron los tokens, caducó), el cliente HTTP se entera al recibir
// un 401 — pero es un módulo suelto, sin acceso al estado de React. Sin este
// canal, la aplicación se quedaba con la interfaz puesta y el usuario solo lo
// notaba al pulsar algo y ver un error.
//
// Es un emisor mínimo a propósito: un solo evento, sin dependencias. No merece
// una librería ni meterlo en el contexto de React, que es justo lo que el
// cliente HTTP no puede alcanzar.

/** Por qué se terminó la sesión. Decide el mensaje que verá el usuario. */
export type MotivoFinSesion =
  /** El servidor la invalidó: cierre forzado, revocación o caducidad. */
  | 'servidor'
  /** El temporizador local llegó al límite de inactividad. */
  | 'inactividad'

export interface FinSesion {
  motivo: MotivoFinSesion
  /**
   * Explicación del backend (campo `detail` del 401). Solo para diagnóstico:
   * **no se muestra al usuario**, porque SimpleJWT devuelve sus propios textos
   * en inglés ("Token is expired") y mezclarlos con los nuestros daría una
   * interfaz a medio traducir. El texto visible lo redacta quien escucha.
   */
  detalle?: string
}

type Escucha = (evento: FinSesion) => void

const escuchas = new Set<Escucha>()

// Evita una cascada de avisos: si vencen tres peticiones a la vez, el usuario
// debe ser expulsado una sola vez. Se rearma al iniciar sesión de nuevo.
let yaAvisado = false

/** Suscribe un oyente. Devuelve la función para darse de baja. */
export function alTerminarSesion(escucha: Escucha): () => void {
  escuchas.add(escucha)
  return () => escuchas.delete(escucha)
}

/** Avisa de que la sesión dejó de ser válida. Solo surte efecto la primera vez. */
export function notificarFinSesion(evento: FinSesion): void {
  if (yaAvisado) return
  yaAvisado = true
  for (const escucha of escuchas) escucha(evento)
}

/** Rearma el aviso. Se llama al abrir una sesión nueva. */
export function rearmarAvisoSesion(): void {
  yaAvisado = false
}
