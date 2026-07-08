import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { televisoresApi } from '@/features/televisores/api/televisores.api'
import type { ImportResult } from '@/features/televisores/types'

export function TelevisorImportPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [resultado, setResultado] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [descargando, setDescargando] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const file = inputRef.current?.files?.[0]
    if (!file) {
      setError('Selecciona un archivo.')
      return
    }
    setError(null)
    setResultado(null)
    setSubiendo(true)
    try {
      setResultado(await televisoresApi.import(file))
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
      await televisoresApi.plantillaTelevisores()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setDescargando(false)
    }
  }

  return (
    <>
      {resultado && (
        <div className="card mb-5 max-w-2xl">
          <h2 className="mb-3 text-lg font-bold text-gray-800">
            Resultado de la importación
          </h2>
          <div className="mb-3 flex flex-wrap gap-3">
            <span className="rounded-lg bg-green-100 px-3 py-2 font-bold text-green-700">
              Creados: {resultado.creados}
            </span>
            <span className="rounded-lg bg-sky-100 px-3 py-2 font-bold text-sky-700">
              Actualizados: {resultado.actualizados}
            </span>
            {resultado.errores.length > 0 && (
              <span className="rounded-lg bg-red-100 px-3 py-2 font-bold text-red-700">
                Con error: {resultado.errores.length}
              </span>
            )}
          </div>
          {resultado.errores.length > 0 && (
            <div className="max-h-56 divide-y divide-red-100 overflow-auto text-sm text-red-700">
              {resultado.errores.map((e, i) => (
                <div key={i} className="py-1">
                  {e}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card max-w-2xl">
        <h2 className="mb-2 text-xl font-bold text-gray-800">
          Enrolar Televisores
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          Sube un archivo <b>Excel (.xlsx)</b> o <b>CSV</b>. Si el televisor ya
          existe (misma <b>MAC</b>) se <b>actualiza</b>; si no, se <b>crea</b>.
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
                <td className="border border-gray-200 px-3 py-2">serial_number</td>
                <td className="border border-gray-200 px-3 py-2">B4:04:29:7E:3A:AA</td>
                <td className="border border-gray-200 px-3 py-2">No</td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2">numero_credito</td>
                <td className="border border-gray-200 px-3 py-2">1234567890</td>
                <td className="border border-gray-200 px-3 py-2">No (solo dígitos)</td>
              </tr>
            </tbody>
          </table>
        </div>

        {error && <div className="msg msg-error">{error}</div>}

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            name="archivo"
            accept=".csv,.xlsx,.xls"
            required
            className="block text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary" disabled={subiendo}>
              {subiendo ? 'Importando…' : 'Importar'}
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
