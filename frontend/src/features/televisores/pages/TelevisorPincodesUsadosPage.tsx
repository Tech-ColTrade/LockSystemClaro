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

export function TelevisorPincodesUsadosPage() {
  const { id } = useParams()
  const fetcher = useCallback(
    (page: number) => televisoresApi.pincodesUsadosDeTV(id!, page),
    [id],
  )
  const { items, count, page, setPage, loading, error } = usePaginatedList(fetcher)

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-800">
          Códigos Pin usados{' '}
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
          Este televisor aún no tiene códigos pin usados.
        </div>
      ) : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Fecha</th>
                <th className="th">Código de Acceso</th>
                <th className="th">Código Pin</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="td">{fecha(p.creado)}</td>
                  <td className="td">{p.passcode}</td>
                  <td className="td tabular-nums">{p.pin_code}</td>
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
