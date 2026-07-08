// Cliente HTTP central: adjunta el Bearer token, maneja errores de forma
// estructurada (ApiError) y renueva el access token automáticamente ante un 401.

import { config } from '@/lib/config'
import { ApiError } from '@/lib/http/errors'
import { tokenStore } from '@/lib/http/tokens'

interface RequestOptions extends RequestInit {
  /** Adjuntar el header Authorization. Por defecto true. */
  auth?: boolean
  /** Uso interno: permite un único reintento tras refrescar el token. */
  _retry?: boolean
}

// Promesa de refresh compartida: si llegan varias peticiones con el token
// vencido a la vez, todas esperan el MISMO refresh en lugar de disparar varios.
let refreshInFlight: Promise<boolean> | null = null

async function performRefresh(): Promise<boolean> {
  const refresh = tokenStore.getRefresh()
  if (!refresh) return false

  try {
    const res = await fetch(`${config.apiBaseUrl}${config.endpoints.refresh}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })

    if (!res.ok) {
      tokenStore.clear()
      return false
    }

    const data = (await res.json()) as { access: string; refresh?: string }
    tokenStore.setAccess(data.access)
    // El backend rota el refresh (ROTATE_REFRESH_TOKENS=True): guardamos el nuevo.
    if (data.refresh) tokenStore.setRefresh(data.refresh)
    return true
  } catch {
    tokenStore.clear()
    return false
  }
}

/** Ejecuta un refresh, deduplicando llamadas concurrentes. */
export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { auth = true, _retry = false, headers, ...rest } = options

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  }

  // Para subir archivos (FormData) dejamos que el navegador ponga el
  // Content-Type con su boundary.
  if (rest.body instanceof FormData) delete finalHeaders['Content-Type']

  const access = tokenStore.getAccess()
  if (auth && access) finalHeaders.Authorization = `Bearer ${access}`

  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    ...rest,
    headers: finalHeaders,
  })

  // Access vencido: intentamos refrescar UNA vez y reintentamos la petición.
  if (res.status === 401 && auth && !_retry) {
    const ok = await refreshSession()
    if (ok) return apiFetch<T>(path, { ...options, _retry: true })
  }

  if (!res.ok) {
    let data: unknown
    let message = res.statusText
    try {
      data = await res.json()
      const detail = (data as { detail?: unknown }).detail
      if (typeof detail === 'string') message = detail
    } catch {
      // respuesta sin cuerpo JSON
    }
    throw new ApiError(res.status, message, data)
  }

  // 204 No Content (p. ej. tras un DELETE) no trae cuerpo.
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/**
 * Descarga un archivo protegido (adjunta el Bearer token y refresca ante 401),
 * y dispara la descarga en el navegador.
 */
export async function apiDownload(path: string, filename: string): Promise<void> {
  async function intento(retry: boolean): Promise<Response> {
    const headers: Record<string, string> = {}
    const access = tokenStore.getAccess()
    if (access) headers.Authorization = `Bearer ${access}`
    const res = await fetch(`${config.apiBaseUrl}${path}`, { headers })
    if (res.status === 401 && !retry) {
      const ok = await refreshSession()
      if (ok) return intento(true)
    }
    return res
  }

  const res = await intento(false)
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') message = body.detail
    } catch {
      // sin cuerpo JSON
    }
    throw new ApiError(res.status, message)
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
