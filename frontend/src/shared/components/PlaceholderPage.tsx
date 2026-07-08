// Página placeholder reutilizable para secciones aún sin implementar.

export function PlaceholderPage({
  title,
  description = 'Sección en construcción.',
}: {
  title: string
  description?: string
}) {
  return (
    <div className="card max-w-2xl">
      <h2 className="mb-1 text-2xl font-bold text-gray-800">{title}</h2>
      <p className="text-gray-600">{description}</p>
      <span className="pill pill-due mt-3">En construcción</span>
    </div>
  )
}
