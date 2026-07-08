import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { televisoresApi } from '@/features/televisores/api/televisores.api'
import { usePermissions } from '@/features/auth/usePermissions'
import type { BulkSyncStatus, Televisor } from '@/features/televisores/types'

const PAGE_SIZE = 10

export function TelevisoresPage() {
  const { canOperate } = usePermissions()
  const [items, setItems] = useState<Televisor[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exportando, setExportando] = useState<'sync' | 'pin' | null>(null)
  const [valJob, setValJob] = useState<BulkSyncStatus | null>(null)
  const [validando, setValidando] = useState(false)
  const valPollRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (valPollRef.current) window.clearInterval(valPollRef.current)
    }
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    televisoresApi
      .list(search, page)
      .then((data) => {
        if (!active) return
        setItems(data.results)
        setCount(data.count)
      })
      .catch((e) => active && setError((e as Error).message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [search, page])

  function onSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setSearch(query.trim())
  }

  async function exportar(tipo: 'sync' | 'pin') {
    setError(null)
    setExportando(tipo)
    try {
      if (tipo === 'sync') await televisoresApi.exportarSincronizaciones()
      else await televisoresApi.exportarPincodes()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setExportando(null)
    }
  }

  async function validacionMasiva() {
    setError(null)
    setValidando(true)
    setValJob(null)
    try {
      const { job } = await televisoresApi.validarMasivo()
      if (valPollRef.current) window.clearInterval(valPollRef.current)
      valPollRef.current = window.setInterval(async () => {
        try {
          const s = await televisoresApi.validarMasivoStatus(job)
          setValJob(s)
          if (s.finalizado && valPollRef.current) {
            window.clearInterval(valPollRef.current)
            setValidando(false)
          }
        } catch {
          // transitorio
        }
      }, 1000)
    } catch (e) {
      setError((e as Error).message)
      setValidando(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-800">Televisores</h2>
        <div className="flex flex-wrap items-center gap-2">
          {canOperate && (
            <>
              <button
                type="button"
                className="btn btn-val"
                onClick={validacionMasiva}
                disabled={validando}
              >
                {validando ? 'Validando…' : 'Validación masiva'}
              </button>
              <Link to="/televisores/importar" className="btn btn-ghost">
                Enrolar Televisores
              </Link>
              <Link to="/televisores/enrolar-estado" className="btn btn-ghost">
                Enrolar Estado
              </Link>
            </>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => exportar('sync')}
            disabled={exportando !== null}
          >
            {exportando === 'sync' ? 'Exportando…' : '⬇ Exportar sincronizaciones'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => exportar('pin')}
            disabled={exportando !== null}
          >
            {exportando === 'pin' ? 'Exportando…' : '⬇ Exportar Códigos Pin'}
          </button>
          {canOperate && (
            <Link to="/televisores/nuevo" className="btn btn-primary">
              + Nuevo
            </Link>
          )}
        </div>
      </div>

      <form onSubmit={onSearch} className="mb-5 flex max-w-md gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar MAC, serial, crédito..."
          className="inp"
        />
        <button type="submit" className="btn btn-ghost">
          Buscar
        </button>
      </form>

      {error && <div className="msg msg-error">{error}</div>}

      {loading ? (
        <div className="card py-12 text-center text-gray-400">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="card py-12 text-center text-gray-400">
          {search ? (
            <>No se encontraron televisores para “{search}”.</>
          ) : (
            <>
              Aún no hay televisores registrados.{' '}
              <Link to="/televisores/nuevo" className="font-semibold text-whale">
                Crea el primero
              </Link>
              .
            </>
          )}
        </div>
      ) : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th !text-center">Dirección MAC</th>
                <th className="th !text-center">Número de serial</th>
                <th className="th !text-center">N° Crédito</th>
                <th className="th !text-center">Estado</th>
                <th className="th !text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((tv) => (
                <tr key={tv.id} className="hover:bg-gray-50">
                  <td className="td text-center font-medium">
                    <Link
                      to={`/televisores/${tv.id}`}
                      className="text-whale hover:underline"
                    >
                      {tv.mac_address}
                    </Link>
                  </td>
                  <td className="td text-center">{tv.serial_number || '—'}</td>
                  <td className="td text-center break-all">
                    {tv.numero_credito || '—'}
                  </td>
                  <td className="td text-center">
                    {tv.inhabilitado ? (
                      <span className="pill pill-lock">Inhabilitado</span>
                    ) : (
                      <span className="pill pill-unlock">Habilitado</span>
                    )}
                  </td>
                  <td className="td whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      {canOperate ? (
                        <>
                          <Link
                            to={`/televisores/${tv.id}/estado`}
                            className="btn btn-sm btn-val"
                          >
                            Estado
                          </Link>
                          <Link
                            to={`/televisores/${tv.id}/editar`}
                            className="btn btn-sm btn-edit"
                          >
                            Editar
                          </Link>
                        </>
                      ) : (
                        <Link
                          to={`/televisores/${tv.id}`}
                          className="btn btn-sm btn-ghost"
                        >
                          Ver
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm text-gray-500">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Anterior
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Modal de validación masiva */}
      {valJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card flex max-h-[85vh] w-full max-w-2xl flex-col">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-gray-800">
                {valJob.finalizado
                  ? 'Validación completada'
                  : 'Validando con el portal…'}
              </h3>
              <span className="text-sm text-gray-500">
                {valJob.procesados}/{valJob.total}
              </span>
            </div>

            <div className="mb-1 text-4xl font-extrabold tabular-nums text-whale">
              {valJob.porcentaje}%
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-whale to-whale-dark transition-all duration-300"
                style={{ width: `${valJob.porcentaje}%` }}
              />
            </div>

            {valJob.finalizado && (
              <div className="mt-3 flex gap-3 text-sm">
                <span className="pill pill-ok">Coinciden: {valJob.ok_count}</span>
                {valJob.error_count > 0 && (
                  <span className="pill pill-due">
                    A sincronizar: {valJob.error_count}
                  </span>
                )}
              </div>
            )}

            {valJob.items.length > 0 && (
              <div className="mt-4 flex-1 overflow-auto rounded-xl ring-1 ring-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="th">MAC</th>
                      <th className="th">Portal</th>
                      <th className="th">App</th>
                      <th className="th">Coincide</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valJob.items.map((it) => (
                      <tr key={it.id}>
                        <td className="td font-medium">{it.mac_address}</td>
                        <td className="td">
                          {it.remoto_inhabilitado === null
                            ? '—'
                            : it.remoto_inhabilitado
                              ? 'Inhabilitado'
                              : 'Habilitado'}
                        </td>
                        <td className="td">
                          {it.local_inhabilitado === null
                            ? '—'
                            : it.local_inhabilitado
                              ? 'Inhabilitado'
                              : 'Habilitado'}
                        </td>
                        <td className="td">
                          {it.coincide === true ? (
                            <span className="pill pill-ok">Sí</span>
                          ) : it.estado === 'error' && it.coincide === null ? (
                            <span className="pill pill-lock">Error</span>
                          ) : it.coincide === false ? (
                            <span className="pill pill-due">No</span>
                          ) : (
                            <span className="pill pill-ok">…</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {valJob.finalizado && (
              <div className="mt-4 text-right">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setValJob(null)}
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
