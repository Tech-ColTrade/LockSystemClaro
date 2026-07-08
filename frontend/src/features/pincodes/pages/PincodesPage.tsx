import { registrosApi } from '@/features/televisores/api/registros.api'
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

export function PincodesPage() {
  const { items, count, page, setPage, loading, error } = usePaginatedList(
    registrosApi.pincodes,
  )

  return (
    <>
      <h2 className="mb-1 text-xl font-bold text-gray-800">Pincodes</h2>
      <p className="mb-5 text-sm text-gray-500">
        Códigos Pin/Acceso que se han usado a través de la app.
      </p>

      {error && <div className="msg msg-error">{error}</div>}

      {loading ? (
        <div className="card py-12 text-center text-gray-400">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="card py-12 text-center text-gray-400">
          Aún no se ha usado ningún Código Pin.
        </div>
      ) : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Fecha</th>
                <th className="th">Dirección MAC</th>
                <th className="th">Código de Acceso</th>
                <th className="th">Código Pin</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="td">{fecha(p.creado)}</td>
                  <td className="td font-medium">{p.mac_address}</td>
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
