import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { televisoresApi } from '@/features/televisores/api/televisores.api'
import { Paginacion } from '@/shared/components/Paginacion'
import { usePaginatedList } from '@/shared/hooks/usePaginatedList'

function fecha(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
}

export function TelevisorSincronizacionesPage() {
  const { id } = useParams()
  const fetcher = useCallback(
    (page: number) => televisoresApi.sincronizacionesDeTV(id!, page),
    [id],
  )
  const { items, count, page, setPage, loading, error } = usePaginatedList(fetcher)

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-800">
          Sincronizaciones{' '}
          <span className="text-base font-normal text-gray-400">({count})</span>
        </h2>
        <Link to={`/televisores/${id}`} className="btn btn-ghost">
          ← Volver al detalle
        </Link>
      </div>

      {error && <div className="msg msg-error">{error}</div>}

      {loading ? (
        <div className="card py-12 text-center text-gray-400">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="card py-12 text-center text-gray-400">
          Este televisor aún no tiene sincronizaciones.
        </div>
      ) : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Fecha</th>
                <th className="th">Acción</th>
                <th className="th">Resultado</th>
                <th className="th">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="td">{fecha(s.fecha)}</td>
                  <td className="td">{s.accion}</td>
                  <td className="td">
                    {s.resultado === 'Aplicado' ? (
                      <span className="pill pill-ok">{s.resultado}</span>
                    ) : s.resultado === 'Error' ? (
                      <span className="pill pill-lock">{s.resultado}</span>
                    ) : (
                      <span className="pill pill-due">{s.resultado}</span>
                    )}
                  </td>
                  <td className="td">{s.tipo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Paginacion page={page} count={count} onPage={setPage} />
    </>
  )
}
