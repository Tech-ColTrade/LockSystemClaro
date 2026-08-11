import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Plus,
} from 'lucide-react'
import { useAuth } from '@/features/auth/context/auth-context'
import {
  useCerrarSesionUsuario,
  useUsuarios,
} from '@/features/usuarios/api/usuarios.queries'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const PAGE_SIZE = 10

export function UsuariosPage() {
  const { user: yo } = useAuth()
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  // Los inactivos se ocultan por defecto; "Ver inactivos" los trae de vuelta.
  const [verInactivos, setVerInactivos] = useState(false)
  const listQuery = useUsuarios(search, page, !verInactivos)
  const cerrarSesion = useCerrarSesionUsuario()
  // Id de la fila cuya sesión se está cerrando, para el spinner del botón.
  const [cerrandoId, setCerrandoId] = useState<string | null>(null)
  const [avisoCierre, setAvisoCierre] = useState<string | null>(null)
  const items = listQuery.data?.results ?? []
  const count = listQuery.data?.count ?? 0
  const loading = listQuery.isLoading
  const error = listQuery.error ? (listQuery.error as Error).message : null

  async function onCerrarSesion(id: string, email: string) {
    setAvisoCierre(null)
    setCerrandoId(id)
    try {
      const res = await cerrarSesion.mutateAsync(id)
      setAvisoCierre(`${email}: ${res.detail}`)
    } catch {
      setAvisoCierre(`No se pudo cerrar la sesión de ${email}.`)
    } finally {
      setCerrandoId(null)
    }
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setSearch(query.trim())
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Usuarios</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Gestiona las cuentas de la plataforma y sus roles.
          </p>
        </div>
        <Button render={<Link to="/usuarios/nuevo" />}>
          <Plus />
          Nuevo usuario
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form onSubmit={onSearch} className="flex max-w-sm flex-1 gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por correo o nombre…"
          />
          <Button type="submit" variant="outline">
            Buscar
          </Button>
        </form>
        <Button
          type="button"
          variant="outline"
          aria-pressed={verInactivos}
          onClick={() => {
            setVerInactivos((v) => !v)
            setPage(1)
          }}
        >
          {verInactivos ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          {verInactivos ? 'Ocultar inactivos' : 'Ver inactivos'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <CircleAlert />
          <AlertTitle>No se pudo cargar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {avisoCierre && (
        <Alert className="mb-4">
          <LogOut />
          <AlertDescription>{avisoCierre}</AlertDescription>
        </Alert>
      )}

      <Card className="gap-0 overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Correo</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Sesión</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No se encontraron usuarios.
                </TableCell>
              </TableRow>
            ) : (
              items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    <Link to={`/usuarios/${u.id}/editar`} className="hover:underline">
                      {u.email}
                    </Link>
                  </TableCell>
                  <TableCell>{u.full_name || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{u.role_display}</Badge>
                  </TableCell>
                  <TableCell>
                    {u.is_active ? (
                      <Badge variant="secondary">Activo</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Inactivo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.sesion ? (
                      <span
                        className="text-sm text-foreground"
                        title={`Desde ${u.sesion.ip ?? 'IP desconocida'}`}
                      >
                        {u.sesion.dispositivo}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {/* Solo tiene sentido con sesión abierta. Sobre uno mismo
                          no: cerraría la sesión desde la que se está pulsando. */}
                      {u.sesion && u.id !== yo?.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={cerrandoId === u.id}
                          onClick={() => onCerrarSesion(u.id, u.email)}
                          title={`Cerrar la sesión de ${u.email} en ${u.sesion.dispositivo}`}
                        >
                          {cerrandoId === u.id ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <LogOut />
                          )}
                          Cerrar sesión
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        render={<Link to={`/usuarios/${u.id}/editar`} />}
                      >
                        Editar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span>
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Anterior"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Siguiente"
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  )
}
