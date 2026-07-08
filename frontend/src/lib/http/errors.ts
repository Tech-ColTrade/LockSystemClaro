// Error estructurado para respuestas HTTP no exitosas.
// Permite distinguir por `status` y acceder al cuerpo (`data`) en la UI.

export class ApiError extends Error {
  readonly status: number
  readonly data: unknown

  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }

  /** True para errores de credenciales/autorización. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403
  }
}
