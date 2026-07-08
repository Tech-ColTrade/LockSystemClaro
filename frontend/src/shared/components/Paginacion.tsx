const PAGE_SIZE = 10

export function Paginacion({
  page,
  count,
  onPage,
}: {
  page: number
  count: number
  onPage: (page: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  if (totalPages <= 1) return null
  return (
    <div className="mt-4 flex items-center justify-center gap-3 text-sm text-gray-500">
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
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
        onClick={() => onPage(page + 1)}
      >
        Siguiente →
      </button>
    </div>
  )
}
