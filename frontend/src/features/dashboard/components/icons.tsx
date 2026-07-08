// Iconos del dashboard (line-style, heredan currentColor). Un solo lugar para
// mantener el trazo consistente con el resto de la app.

type P = { className?: string }

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
}

export function Dashboard({ className }: P) {
  return (
    <svg className={className} {...base}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  )
}

export function Refresh({ className }: P) {
  return (
    <svg className={className} {...base}>
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  )
}

export function Tv({ className }: P) {
  return (
    <svg className={className} {...base}>
      <rect x="2.5" y="4" width="19" height="12.5" rx="2" />
      <path d="M8 20.5h8M12 16.5v4" />
    </svg>
  )
}

export function Lock({ className }: P) {
  return (
    <svg className={className} {...base}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
      <path d="M12 14.5v2.5" />
    </svg>
  )
}

export function Unlock({ className }: P) {
  return (
    <svg className={className} {...base}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 7.7-1.5" />
      <path d="M12 14.5v2.5" />
    </svg>
  )
}

export function Card({ className }: P) {
  return (
    <svg className={className} {...base}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.5h19M6 15h4" />
    </svg>
  )
}

export function Key({ className }: P) {
  return (
    <svg className={className} {...base}>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="m10.7 12.3 10-10M16 7l3 3M14 9l2 2" />
    </svg>
  )
}

export function PieIcon({ className }: P) {
  return (
    <svg className={className} {...base}>
      <path d="M21 15.5A9 9 0 1 1 8.5 3" />
      <path d="M12 3a9 9 0 0 1 9 9h-9z" />
    </svg>
  )
}

export function Bars({ className }: P) {
  return (
    <svg className={className} {...base}>
      <path d="M3 21h18" />
      <rect x="5" y="11" width="3.5" height="7" rx="1" />
      <rect x="10.5" y="6" width="3.5" height="12" rx="1" />
      <rect x="16" y="13" width="3.5" height="5" rx="1" />
    </svg>
  )
}

export function Target({ className }: P) {
  return (
    <svg className={className} {...base}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.6" />
    </svg>
  )
}

export function Trend({ className }: P) {
  return (
    <svg className={className} {...base}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M21 7v5h-5" />
    </svg>
  )
}

export function Activity({ className }: P) {
  return (
    <svg className={className} {...base}>
      <path d="M3 12h4l2.5 7 5-14L17 12h4" />
    </svg>
  )
}

export function Users({ className }: P) {
  return (
    <svg className={className} {...base}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

export function Excel({ className }: P) {
  return (
    <svg className={className} {...base}>
      <path d="M14 3v5h5" />
      <path d="M6 3h8l5 5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V4.5A1.5 1.5 0 0 1 5.5 3z" />
      <path d="m9.5 12 4 5M13.5 12l-4 5" />
    </svg>
  )
}

export function Search({ className }: P) {
  return (
    <svg className={className} {...base}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

export function Shield({ className }: P) {
  return (
    <svg className={className} {...base}>
      <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function Popup({ className }: P) {
  return (
    <svg className={className} {...base}>
      <path d="M21 12a8 8 0 1 1-3.3-6.5" />
      <path d="M8 11h6M8 14h4" />
    </svg>
  )
}
