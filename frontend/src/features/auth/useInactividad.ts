// Cierre de sesión por inactividad.
//
// Qué cuenta como actividad: que el usuario toque el teclado, el ratón, la
// rueda o la pantalla. Las peticiones de fondo (polling de jobs, refetch de
// TanStack Query) NO cuentan — si contaran, una pantalla abierta y olvidada
// mantendría la sesión viva para siempre, que es justo lo que esto evita.
//
// La marca de tiempo vive en localStorage y no en un estado de React por dos
// razones: sobrevive a la recarga de la página, y se comparte entre pestañas
// (usar la app en una mantiene viva la sesión en todas).
//
// Esto es la mitad de la historia: el corte REAL lo impone el backend, donde el
// refresh token dura exactamente la ventana de inactividad. Este hook existe
// para que el usuario salga en el momento exacto —y con un aviso claro— en vez
// de descubrirlo al pulsar un botón y recibir un error.

import { useEffect, useRef } from 'react'
import { config } from '@/lib/config'
import { refreshSession } from '@/lib/http/client'

/** Eventos que se consideran interacción real del usuario. */
const EVENTOS = [
  'pointerdown',
  'keydown',
  'wheel',
  'touchstart',
  'scroll',
] as const

/** Cada cuánto se comprueba si la sesión venció. */
const INTERVALO_CHEQUEO_MS = 5_000

/**
 * Cada cuánto, como mucho, se escribe la marca de actividad. Sin esto un
 * `scroll` haría cientos de escrituras por segundo en localStorage.
 */
const THROTTLE_ESCRITURA_MS = 5_000

export const actividad = {
  marcar(): void {
    localStorage.setItem(config.storage.lastActivity, String(Date.now()))
  },

  ultima(): number {
    const guardado = Number(localStorage.getItem(config.storage.lastActivity))
    return Number.isFinite(guardado) && guardado > 0 ? guardado : 0
  },

  limpiar(): void {
    localStorage.removeItem(config.storage.lastActivity)
  },
}

/**
 * Aviso de "tu sesión terminó", que ponen los cierres automáticos y consume la
 * pantalla de login para explicar por qué está ahí. En sessionStorage: es un
 * mensaje de un solo uso para esta pestaña, no un dato que deba sobrevivir a
 * cerrarla.
 */
export const avisoExpiracion = {
  /**
   * @param mensaje Texto ya redactado que verá el usuario en el login.
   *
   * No sobrescribe un aviso ya puesto: al expulsar por inactividad, la llamada
   * de cortesía a /logout responde 401 y pondría un segundo aviso, más vago,
   * encima del primero — que es el que sabe la razón real.
   */
  poner(mensaje: string): void {
    if (sessionStorage.getItem(config.storage.sesionExpirada) !== null) return
    sessionStorage.setItem(config.storage.sesionExpirada, mensaje)
  },

  /** Devuelve el mensaje pendiente (y lo borra), o null si no había. */
  consumir(): string | null {
    const guardado = sessionStorage.getItem(config.storage.sesionExpirada)
    sessionStorage.removeItem(config.storage.sesionExpirada)
    return guardado
  },
}

interface Opciones {
  /** Ventana de inactividad en minutos. 0 o menos desactiva el cierre. */
  minutos: number
  /** Si la vigilancia está activa (solo con sesión iniciada). */
  activo: boolean
  /** Se llama una única vez cuando se agota la ventana. */
  onExpirar: () => void
}

export function useInactividad({ minutos, activo, onExpirar }: Opciones): void {
  // En una ref para que cambiar el callback no reinicie los listeners.
  const onExpirarRef = useRef(onExpirar)
  onExpirarRef.current = onExpirar

  useEffect(() => {
    if (!activo || minutos <= 0) return

    const ventanaMs = minutos * 60_000
    // Se renueva el token pasado un tercio de la ventana: dos oportunidades
    // antes del corte, sin renovar en cada clic.
    const intervaloRenovacionMs = ventanaMs / 3

    let expirado = false
    let ultimaEscritura = 0
    let ultimaRenovacion = Date.now()

    // Si no hay marca previa (primer arranque tras iniciar sesión), la ventana
    // empieza a contar ahora y no desde 1970.
    if (actividad.ultima() === 0) actividad.marcar()

    function registrarActividad() {
      if (expirado) return
      const ahora = Date.now()

      // Actividad tras la ventana: la sesión ya estaba vencida aunque el
      // temporizador todavía no lo hubiera detectado (pestaña en segundo
      // plano, equipo suspendido…).
      if (ahora - actividad.ultima() > ventanaMs) {
        expirar()
        return
      }

      if (ahora - ultimaEscritura >= THROTTLE_ESCRITURA_MS) {
        ultimaEscritura = ahora
        actividad.marcar()
      }

      // Usuario activo: renueva el token para que la ventana del servidor
      // acompañe a la del navegador.
      if (ahora - ultimaRenovacion >= intervaloRenovacionMs) {
        ultimaRenovacion = ahora
        void refreshSession()
      }
    }

    function expirar() {
      if (expirado) return
      expirado = true
      actividad.limpiar()
      onExpirarRef.current()
    }

    function comprobar() {
      if (Date.now() - actividad.ultima() > ventanaMs) expirar()
    }

    for (const evento of EVENTOS) {
      // `passive`: son listeners de solo lectura; así no bloquean el scroll.
      window.addEventListener(evento, registrarActividad, { passive: true })
    }
    // Al volver a la pestaña se comprueba de inmediato: los navegadores frenan
    // los temporizadores en segundo plano y el intervalo puede ir atrasado.
    document.addEventListener('visibilitychange', comprobar)

    const id = setInterval(comprobar, INTERVALO_CHEQUEO_MS)

    return () => {
      for (const evento of EVENTOS) {
        window.removeEventListener(evento, registrarActividad)
      }
      document.removeEventListener('visibilitychange', comprobar)
      clearInterval(id)
    }
  }, [activo, minutos])
}
