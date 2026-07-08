import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { televisoresApi } from '@/features/televisores/api/televisores.api'
import { usePermissions } from '@/features/auth/usePermissions'
import { ApiError } from '@/lib/http/errors'
import type {
  PinCodeGroup,
  RegistrosResumen,
  Televisor,
  ValidarResult,
} from '@/features/televisores/types'

function formatearFecha(iso: string): string {
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

export function TelevisorDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { canOperate } = usePermissions()
  const [tv, setTv] = useState<Televisor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Validación
  const [validando, setValidando] = useState(false)
  const [validacion, setValidacion] = useState<ValidarResult | null>(null)

  // Registros (contadores)
  const [registros, setRegistros] = useState<RegistrosResumen | null>(null)

  // Código Pin
  const [grupos, setGrupos] = useState<PinCodeGroup[] | null>(null)
  const [cargandoCodigos, setCargandoCodigos] = useState(false)
  const [codigosError, setCodigosError] = useState<string | null>(null)
  const [passInput, setPassInput] = useState('')
  const [pinResult, setPinResult] = useState<PinCodeGroup | null>(null)
  const [obteniendo, setObteniendo] = useState(false)
  const [noEncontrado, setNoEncontrado] = useState(false)
  const [verTodos, setVerTodos] = useState(false)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    let active = true
    televisoresApi
      .get(id!)
      .then((data) => active && setTv(data))
      .catch((e) => active && setError((e as Error).message))
      .finally(() => active && setLoading(false))
    televisoresApi
      .registros(id!)
      .then((r) => active && setRegistros(r))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [id])

  async function asegurarCodigos(): Promise<PinCodeGroup[] | null> {
    if (grupos) return grupos
    setCargandoCodigos(true)
    setCodigosError(null)
    try {
      const r = await televisoresApi.pincodes(id!)
      setGrupos(r.grupos)
      return r.grupos
    } catch (e) {
      setCodigosError((e as Error).message)
      return null
    } finally {
      setCargandoCodigos(false)
    }
  }

  async function obtenerPin(e: React.FormEvent) {
    e.preventDefault()
    setPinResult(null)
    setNoEncontrado(false)
    setCodigosError(null)
    setObteniendo(true)
    try {
      const r = await televisoresApi.usarPincode(id!, passInput.trim())
      setPinResult({ codeId: '', passCode: r.passcode, pinCode: r.pin_code })
      setGrupos(null) // el código quedó usado: invalida el "ver todos" en caché
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNoEncontrado(true)
      else setCodigosError((err as Error).message)
    } finally {
      setObteniendo(false)
    }
  }

  async function toggleTodos() {
    if (!verTodos) await asegurarCodigos()
    setVerTodos((v) => !v)
  }

  function copiar(texto: string) {
    navigator.clipboard?.writeText(texto)
    setCopiado(true)
    window.setTimeout(() => setCopiado(false), 1500)
  }

  async function validar() {
    if (!id) return
    setValidando(true)
    setValidacion(null)
    try {
      setValidacion(await televisoresApi.validar(id))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setValidando(false)
    }
  }

  async function eliminar() {
    if (!tv || !confirm(`¿Eliminar el televisor ${tv.mac_address}?`)) return
    try {
      await televisoresApi.remove(tv.id)
      navigate('/televisores')
    } catch (e) {
      setError((e as Error).message)
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

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold text-gray-800">{tv.mac_address}</h2>
          {tv.inhabilitado ? (
            <span className="pill pill-lock">Inhabilitado</span>
          ) : (
            <span className="pill pill-unlock">Habilitado</span>
          )}
        </div>
        <Link to="/televisores" className="btn btn-ghost">
          ← Volver
        </Link>
      </div>

      <div className="card">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-gray-800">
            Información del dispositivo
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={validar}
              disabled={validando}
              className="btn btn-sm btn-ghost"
            >
              {validando ? 'Validando…' : 'Validar'}
            </button>
            {canOperate && (
              <>
                <Link to={`/televisores/${tv.id}/estado`} className="btn btn-sm btn-val">
                  Estado
                </Link>
                <Link to={`/televisores/${tv.id}/editar`} className="btn btn-sm btn-edit">
                  Editar
                </Link>
                <button type="button" onClick={eliminar} className="btn btn-sm btn-del">
                  Eliminar
                </button>
              </>
            )}
          </div>
        </div>

        {validacion && (
          <div
            className={`msg mb-4 ${validacion.coincide ? 'msg-success' : 'msg-warning'}`}
          >
            {validacion.mensaje}
          </div>
        )}

        <div className="overflow-hidden rounded-xl ring-1 ring-gray-100">
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <th className="th w-1/3">Dirección MAC</th>
                <th className="th w-1/3">Número de serie</th>
                <th className="th w-1/3">N° Crédito</th>
              </tr>
              <tr>
                <td className="td font-medium text-gray-800">{tv.mac_address}</td>
                <td className="td">{tv.serial_number || '—'}</td>
                <td className="td break-all">{tv.numero_credito || '—'}</td>
              </tr>
              <tr>
                <th className="th">Estado</th>
                <th className="th">Registrado</th>
                <th className="th"></th>
              </tr>
              <tr>
                <td className="td">
                  {tv.inhabilitado ? (
                    <span className="pill pill-lock">Inhabilitado</span>
                  ) : (
                    <span className="pill pill-unlock">Habilitado</span>
                  )}
                </td>
                <td className="td">{formatearFecha(tv.created_at)}</td>
                <td className="td"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Registros */}
      <div className="card mt-5">
        <h3 className="mb-4 text-base font-bold text-gray-800">Registros</h3>
        <div className="divide-y divide-gray-100 overflow-hidden rounded-xl ring-1 ring-gray-100">
          <Link
            to={`/televisores/${tv.id}/sincronizaciones`}
            className="flex items-center justify-between px-4 py-3.5 transition hover:bg-gray-50"
          >
            <span className="text-sm font-medium text-gray-700">
              Sincronizaciones
            </span>
            <span className="flex items-center gap-3">
              <span className="pill pill-ok">{registros?.sincronizaciones ?? '…'}</span>
              <span className="text-gray-300">›</span>
            </span>
          </Link>
          <Link
            to={`/televisores/${tv.id}/pincodes`}
            className="flex items-center justify-between px-4 py-3.5 transition hover:bg-gray-50"
          >
            <span className="text-sm font-medium text-gray-700">Códigos Pin</span>
            <span className="flex items-center gap-3">
              <span className="pill pill-ok">{registros?.pincodes ?? '…'}</span>
              <span className="text-gray-300">›</span>
            </span>
          </Link>
        </div>
      </div>

      {/* Código Pin (Habilitación manual) */}
      <div className="card mt-5">
        <h3 className="text-base font-bold text-gray-800">Código Pin</h3>
        <p className="mt-0.5 mb-4 text-sm text-gray-500">
          Ingresa el <b>Código de Acceso</b> que muestra el televisor para obtener
          su <b>Código Pin</b> de desbloqueo.
        </p>

        <form onSubmit={obtenerPin} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="lbl" htmlFor="passcode">
              Código de Acceso (Passcode)
            </label>
            <input
              id="passcode"
              className="inp"
              value={passInput}
              onChange={(e) => setPassInput(e.target.value)}
              placeholder="Ej. 0323"
              inputMode="numeric"
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={obteniendo || !passInput.trim()}
          >
            {obteniendo ? 'Obteniendo…' : 'Obtener Código Pin'}
          </button>
        </form>

        {codigosError && <div className="msg msg-error mt-3">{codigosError}</div>}

        {noEncontrado && (
          <div className="msg msg-warning mt-3">
            No hay un Código Pin disponible para ese Código de Acceso.
          </div>
        )}

        {pinResult && (
          <div className="mt-4 rounded-2xl bg-whale/5 p-5 text-center ring-1 ring-whale/20">
            <p className="text-sm text-gray-500">
              Código Pin para el acceso{' '}
              <b className="text-gray-700">{pinResult.passCode}</b>
            </p>
            <div className="my-2 text-4xl font-extrabold tracking-widest text-whale tabular-nums">
              {pinResult.pinCode}
            </div>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => copiar(pinResult.pinCode)}
            >
              {copiado ? '✓ Copiado' : '📋 Copiar'}
            </button>
          </div>
        )}

        <div className="mt-4">
          <button
            type="button"
            className="text-sm font-medium text-whale hover:underline"
            onClick={toggleTodos}
            disabled={cargandoCodigos}
          >
            {cargandoCodigos
              ? 'Cargando…'
              : verTodos
                ? 'Ocultar todos los códigos'
                : 'Ver todos los códigos disponibles'}
          </button>
        </div>

        {verTodos && grupos && (
          <div className="mt-3 max-h-72 overflow-auto rounded-xl ring-1 ring-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="th">Código de Acceso</th>
                  <th className="th">Código Pin</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => (
                  <tr key={g.codeId} className="hover:bg-gray-50">
                    <td className="td font-medium">{g.passCode}</td>
                    <td className="td tabular-nums">{g.pinCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
