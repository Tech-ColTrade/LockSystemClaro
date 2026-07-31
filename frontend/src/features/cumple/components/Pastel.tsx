// Pastel en SVG con velas apagables al tocarlas. Todo es CSS/SVG: no hay
// imágenes ni librerías, así que escala nítido en cualquier densidad de pantalla.
//
// Cada vela es un <button> real para que funcione con teclado y lectores de
// pantalla, aunque el gesto natural en móvil sea el toque.

type Props = {
  /** Estado de cada vela: true = encendida. */
  velas: boolean[]
  onApagar: (indice: number, x: number, y: number) => void
}

const X_VELAS = [58, 88, 118, 148, 178]

export function Pastel({ velas, onApagar }: Props) {
  return (
    <div className="relative mx-auto w-full max-w-[280px] select-none">
      <svg viewBox="0 0 236 200" className="w-full overflow-visible">
        {/* Plato */}
        <ellipse cx="118" cy="188" rx="104" ry="10" fill="#ffffff" opacity=".18" />

        {/* Base del pastel */}
        <rect x="26" y="128" width="184" height="56" rx="16" fill="#f6b8cf" />
        <rect x="26" y="128" width="184" height="18" rx="9" fill="#ffd0e2" />
        {/* Piso intermedio */}
        <rect x="44" y="96" width="148" height="44" rx="14" fill="#ffe2b8" />
        <rect x="44" y="96" width="148" height="16" rx="8" fill="#fff0d6" />
        {/* Glaseado que gotea */}
        <path
          d="M44 108c10 0 10 12 20 12s10-12 20-12 10 14 20 14 10-14 20-14 10 12 20 12 10-12 20-12 10 13 20 13v-18H44Z"
          fill="#ffffff"
          opacity=".85"
        />
        {/* Chispitas */}
        {[
          [70, 158],
          [104, 168],
          [140, 154],
          [172, 166],
          [90, 172],
          [156, 172],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="3" fill="#ff7fae" opacity=".7" />
        ))}

        {/* Velas */}
        {X_VELAS.map((x, i) => {
          const encendida = velas[i]
          return (
            <g key={x}>
              <rect
                x={x - 5}
                y={62}
                width="10"
                height="36"
                rx="5"
                fill={i % 2 ? '#8ecae6' : '#ffffff'}
              />
              <rect x={x - 5} y={70} width="10" height="5" rx="2" fill="#ff9ec7" />
              <rect x={x - 5} y={82} width="10" height="5" rx="2" fill="#ff9ec7" />
              {/* Pabilo */}
              <rect x={x - 1} y={56} width="2" height="8" rx="1" fill="#6b5b5b" />
              {/* Llama */}
              <g
                className={
                  encendida
                    ? 'cumple-flame origin-bottom'
                    : 'opacity-0 transition-opacity duration-500'
                }
                style={{ transformOrigin: `${x}px 56px` }}
              >
                <ellipse cx={x} cy={48} rx="7" ry="12" fill="#ffb703" opacity=".55" />
                <ellipse cx={x} cy={50} rx="4" ry="8" fill="#ffe27a" />
              </g>
              {/* Humito al apagarse */}
              {!encendida && (
                <path
                  className="cumple-smoke"
                  d={`M${x} 54c6-6-6-10 0-16`}
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                  opacity=".35"
                />
              )}
            </g>
          )
        })}
      </svg>

      {/* Zonas táctiles generosas sobre cada vela (44px, guía de iOS) */}
      <div className="absolute inset-0">
        {X_VELAS.map((x, i) => (
          <button
            key={x}
            type="button"
            aria-label={`Apagar vela ${i + 1}`}
            aria-pressed={!velas[i]}
            disabled={!velas[i]}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              onApagar(i, r.left + r.width / 2, r.top + r.height / 2)
            }}
            className="absolute -translate-x-1/2 rounded-full transition active:scale-90 disabled:pointer-events-none"
            style={{
              left: `${(x / 236) * 100}%`,
              top: '14%',
              width: '19%',
              height: '30%',
            }}
          />
        ))}
      </div>
    </div>
  )
}
