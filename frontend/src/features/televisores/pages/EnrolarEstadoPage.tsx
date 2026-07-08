import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { televisoresApi } from '@/features/televisores/api/televisores.api'
import type {
  BulkSyncStatus,
  EnrolarEstadoResult,
} from '@/features/televisores/types'

export function EnrolarEstadoPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<number | null>(null)

  const [resumen, setResumen] = useState<EnrolarEstadoResult | null>(null)
  const [bulk, setBulk] = useState<BulkSyncStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [descargando, setDescargando] = useState(false)

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [])

  function pollBulk(jobId: number) {
    if (pollRef.current) window.clearInterval(pollRef.current)
    pollRef.current = window.setInterval(async () => {
      try {
        const s = await televisoresApi.bulkStatus(jobId)
        setBulk(s)
        if (s.finalizado && pollRef.current) {
          window.clearInterval(pollRef.current)
        }
      } catch {
        // transitorio: seguimos intentando
      }
    }, 1000)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const file = inputRef.current?.files?.[0]
    if (!file) {
      setError('Selecciona un archivo.')
      return
    }
    setError(null)
    setResumen(null)
    setBulk(null)
    setSubiendo(true)
    try {
      const r = await televisoresApi.enrolarEstado(file)
      setResumen(r)
      if (r.job) pollBulk(r.job)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubiendo(false)
    }
  }

  async function descargarPlantilla() {
    setError(null)
    setDescargando(true)
    try {
      await televisoresApi.plantillaEstados()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setDescargando(false)
    }
  }

  const enProgreso = bulk !== null && !bulk.finalizado

  return (
    <>
      {/* Resumen de importación */}
      {resumen && (
        <div className="card mb-5 max-w-2xl">
          <h2 className="mb-3 text-lg font-bold text-gray-800">
            Resultado de la importación
          </h2>
          <div className="flex flex-wrap gap-3">
            <span className="rounded-lg bg-green-100 px-3 py-2 font-bold text-green-700">
              Creados: {resumen.creados}
            </span>
            <span className="rounded-lg bg-sky-100 px-3 py-2 font-bold text-sky-700">
              Actualizados: {resumen.actualizados}
            </span>
            <span className="rounded-lg bg-violet-100 px-3 py-2 font-bold text-violet-700">
              Con cambio de estado: {resumen.cambios}
            </span>
            {resumen.errores.length > 0 && (
              <span className="rounded-lg bg-red-100 px-3 py-2 font-bold text-red-700">
                Con error: {resumen.errores.length}
              </span>
            )}
          </div>
          {resumen.errores.length > 0 && (
            <div className="mt-3 max-h-40 divide-y divide-red-100 overflow-auto text-sm text-red-700">
              {resumen.errores.map((e, i) => (
                <div key={i} className="py-1">
                  {e}
                </div>
              ))}
            </div>
          )}
          {resumen.job === null && (
            <p className="mt-3 text-sm text-gray-500">
              No hubo cambios de estado que sincronizar con el portal.
            </p>
          )}
        </div>
      )}

      {/* Progreso de la sincronización masiva */}
      {bulk && (
        <div className="card mb-5 max-w-2xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-gray-800">
              {enProgreso
                ? 'Sincronizando con el portal…'
                : bulk.estado === 'terminado'
                  ? '✓ Sincronización completada'
                  : 'Sincronización con errores'}
            </h3>
            <span className="text-sm text-gray-500">
              {bulk.procesados}/{bulk.total}
            </span>
          </div>

          <div className="mb-1 text-4xl font-extrabold tabular-nums text-whale">
            {bulk.porcentaje}%
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-whale to-whale-dark transition-all duration-300"
              style={{ width: `${bulk.porcentaje}%` }}
            />
          </div>

          {bulk.finalizado && (
            <div className="mt-3 flex gap-3 text-sm">
              <span className="pill pill-ok">OK: {bulk.ok_count}</span>
              {bulk.error_count > 0 && (
                <span className="pill pill-lock">Error: {bulk.error_count}</span>
              )}
            </div>
          )}

          {bulk.items.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-xl ring-1 ring-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="th">MAC</th>
                    <th className="th">Objetivo</th>
                    <th className="th">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {bulk.items.map((it) => (
                    <tr key={it.id}>
                      <td className="td font-medium">{it.mac_address}</td>
                      <td className="td">
                        {it.inhabilitar ? 'Inhabilitar' : 'Habilitar'}
                      </td>
                      <td className="td">
                        {it.estado === 'ok' ? (
                          <span className="pill pill-ok">{it.mensaje || 'OK'}</span>
                        ) : it.estado === 'error' ? (
                          <span className="pill pill-lock">{it.mensaje || 'Error'}</span>
                        ) : (
                          <span className="pill pill-due">En proceso…</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Formulario de carga */}
      <div className="card max-w-2xl">
        <h2 className="mb-2 text-xl font-bold text-gray-800">Enrolar Estado</h2>
        <p className="mb-4 text-sm text-gray-600">
          Sube un <b>Excel (.xlsx)</b> o <b>CSV</b> con el estado de cada
          televisor. Se fija el estado y, para los que cambian, se{' '}
          <b>sincroniza el portal WhaleTV</b> automáticamente.
        </p>

        <div className="mb-4 overflow-x-auto">
          <table className="w-full border border-gray-200 text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-2 text-left">Columna</th>
                <th className="border border-gray-200 px-3 py-2 text-left">Ejemplo</th>
                <th className="border border-gray-200 px-3 py-2 text-left">Obligatoria</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-200 px-3 py-2">mac_address</td>
                <td className="border border-gray-200 px-3 py-2">B4:04:29:7E:3A:AA</td>
                <td className="border border-gray-200 px-3 py-2">Sí</td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2">estado</td>
                <td className="border border-gray-200 px-3 py-2">habilitado / inhabilitado</td>
                <td className="border border-gray-200 px-3 py-2">Sí</td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2">serial_number</td>
                <td className="border border-gray-200 px-3 py-2">B4:04:29:7E:3A:AA</td>
                <td className="border border-gray-200 px-3 py-2">No</td>
              </tr>
            </tbody>
          </table>
        </div>

        {error && <div className="msg msg-error">{error}</div>}

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            required
            className="block text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={subiendo || enProgreso}
            >
              {subiendo
                ? 'Importando…'
                : enProgreso
                  ? 'Sincronizando…'
                  : 'Importar y sincronizar'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={descargarPlantilla}
              disabled={descargando}
            >
              {descargando ? 'Descargando…' : 'Descargar plantilla Excel'}
            </button>
            <Link to="/televisores" className="btn btn-ghost">
              Volver
            </Link>
          </div>
        </form>
      </div>
    </>
  )
}
