import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { televisoresApi } from '@/features/televisores/api/televisores.api'
import type {
  SyncJobRecord,
  Televisor,
} from '@/features/televisores/types'

function fecha(iso: string | null): string {
  if (!iso) return '—'
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

type SyncPhase = 'idle' | 'running' | 'ok' | 'error'
interface SyncState {
  phase: SyncPhase
  pct: number
  titulo: string
  texto: string
}
const SYNC_IDLE: SyncState = { phase: 'idle', pct: 0, titulo: '', texto: '' }

export function TelevisorEstadoPage() {
  const { id } = useParams()
  const [tv, setTv] = useState<Televisor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [seleccion, setSeleccion] = useState<'habilitado' | 'inhabilitado'>(
    'habilitado',
  )
  const [historial, setHistorial] = useState<SyncJobRecord[]>([])
  const [sync, setSync] = useState<SyncState>(SYNC_IDLE)
  const pollRef = useRef<number | null>(null)

  const cargarHistorial = useCallback(async () => {
    if (!id) return
    try {
      setHistorial(await televisoresApi.historial(id))
    } catch {
      // el histórico es secundario; si falla, no bloqueamos la página
    }
  }, [id])

  useEffect(() => {
    let active = true
    televisoresApi
      .get(id!)
      .then((data) => {
        if (!active) return
        setTv(data)
        setSeleccion(data.inhabilitado ? 'inhabilitado' : 'habilitado')
      })
      .catch((e) => active && setError((e as Error).message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [id])

  useEffect(() => {
    cargarHistorial()
  }, [cargarHistorial])

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [])

  function pollJob(jobId: number, inhabilitar: boolean) {
    if (pollRef.current) window.clearInterval(pollRef.current)
    pollRef.current = window.setInterval(async () => {
      try {
        const s = await televisoresApi.syncStatus(id!, jobId)
        setSync((prev) =>
          prev.phase === 'running'
            ? { ...prev, pct: Math.max(prev.pct, s.porcentaje) }
            : prev,
        )
        if (s.finalizado) {
          if (pollRef.current) window.clearInterval(pollRef.current)
          cargarHistorial()
          if (s.estado === 'terminado') {
            setSync({
              phase: 'ok',
              pct: 100,
              titulo: '✓ Completado',
              texto: inhabilitar
                ? 'Televisor inhabilitado (bloqueado) en el portal WhaleTV.'
                : 'Televisor habilitado (desbloqueado) en el portal WhaleTV.',
            })
          } else {
            setSync({
              phase: 'error',
              pct: 100,
              titulo: 'No se pudo aplicar',
              texto: s.error || 'Error en la sincronización con el portal.',
            })
          }
        }
      } catch {
        // error transitorio: seguimos intentando
      }
    }, 1000)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    const inhabilitar = seleccion === 'inhabilitado'
    setSync({
      phase: 'running',
      pct: 5,
      titulo: 'Sincronizando con el portal',
      texto: 'Aplicando el cambio en el portal WhaleTV…',
    })
    try {
      const launch = await televisoresApi.setEstado(id, inhabilitar)
      setTv((t) => (t ? { ...t, inhabilitado: launch.inhabilitado } : t))
      pollJob(launch.job, inhabilitar)
    } catch (err) {
      setSync({
        phase: 'error',
        pct: 100,
        titulo: 'No se pudo iniciar',
        texto: (err as Error).message,
      })
    }
  }

  if (loading) {
    return <div className="card py-12 text-center text-gray-400">Cargando…</div>
  }

  if (error || !tv) {
    return (
      <div className="card">
        <div className="msg msg-error">{error ?? 'Televisor no encontrado.'}</div>
        <Link to="/televisores" className="btn btn-ghost">
          ← Volver
        </Link>
      </div>
    )
  }

  const ejecutando = sync.phase === 'running'

  return (
    <>
      {/* Encabezado */}
      <div className="card mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="mb-1 text-xl font-bold text-gray-800">Estado del televisor</h2>
            <div className="text-sm text-gray-500">
              <b className="text-gray-800">{tv.mac_address}</b> · Estado actual:{' '}
              {tv.inhabilitado ? (
                <span className="pill pill-lock">Inhabilitado</span>
              ) : (
                <span className="pill pill-unlock">Habilitado</span>
              )}
            </div>
          </div>
          <Link to={`/televisores/${tv.id}`} className="btn btn-ghost">
            ← Volver al detalle
          </Link>
        </div>
      </div>

      {/* Registrar estado */}
      <div className="card mb-5">
        <h3 className="mb-1 text-base font-bold text-gray-800">Registrar estado</h3>
        <p className="mb-4 text-sm text-gray-500">
          Al guardar se aplica el cambio en el portal WhaleTV.
        </p>
        <form onSubmit={guardar} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="lbl" htmlFor="estado">
              Estado
            </label>
            <select
              id="estado"
              className="inp"
              value={seleccion}
              onChange={(e) =>
                setSeleccion(e.target.value as 'habilitado' | 'inhabilitado')
              }
              disabled={ejecutando}
            >
              <option value="habilitado">Habilitado</option>
              <option value="inhabilitado">Inhabilitado</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={ejecutando}>
            Guardar
          </button>
        </form>
      </div>

      {/* Histórico de cambios */}
      <div className="card overflow-hidden !p-0">
        {historial.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Fecha</th>
                <th className="th">Estado</th>
                <th className="th">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="td">{fecha(h.creado)}</td>
                  <td className="td">
                    {h.inhabilitar ? (
                      <span className="pill pill-lock">Inhabilitado</span>
                    ) : (
                      <span className="pill pill-unlock">Habilitado</span>
                    )}
                  </td>
                  <td className="td">
                    {h.estado === 'terminado' ? (
                      <span className="pill pill-ok">Aplicado</span>
                    ) : h.estado === 'error' ? (
                      <span className="pill pill-lock">Error</span>
                    ) : (
                      <span className="pill pill-due">En proceso</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-10 text-center text-gray-400">
            Aún no hay cambios de estado registrados.
          </div>
        )}
      </div>

      {/* Modal de progreso (polling real) */}
      {sync.phase !== 'idle' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md text-center">
            <h3
              className={`mb-1 text-lg font-bold ${
                sync.phase === 'ok'
                  ? 'text-emerald-600'
                  : sync.phase === 'error'
                    ? 'text-rose-600'
                    : 'text-gray-800'
              }`}
            >
              {sync.titulo}
            </h3>
            <div
              className={`my-4 text-5xl font-extrabold tabular-nums ${
                sync.phase === 'error' ? 'text-rose-600' : 'text-whale'
              }`}
            >
              {Math.round(sync.pct)}%
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  sync.phase === 'error'
                    ? 'bg-rose-500'
                    : 'bg-gradient-to-r from-whale to-whale-dark'
                }`}
                style={{ width: `${sync.pct}%` }}
              />
            </div>
            {sync.phase !== 'running' && (
              <>
                <p className="mt-4 text-sm text-gray-500">{sync.texto}</p>
                <button
                  type="button"
                  className="btn btn-primary mt-4"
                  onClick={() => setSync(SYNC_IDLE)}
                >
                  Cerrar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
