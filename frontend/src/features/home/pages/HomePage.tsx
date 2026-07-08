import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/context/auth-context'

export function HomePage() {
  const { user } = useAuth()
  const nombre = user?.full_name || user?.first_name || user?.email || ''

  return (
    <div className="card max-w-2xl">
      <h2 className="mb-1 text-2xl font-bold text-gray-800">
        ¡Hola, {nombre}! 👋
      </h2>
      <p className="text-gray-600">Has iniciado sesión correctamente.</p>
      <span className="pill pill-ok mt-3">{user?.email}</span>
      <div className="mt-6">
        <Link to="/televisores" className="btn btn-primary">
          Gestionar televisores →
        </Link>
      </div>
    </div>
  )
}
