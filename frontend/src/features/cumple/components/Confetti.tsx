// Confeti en canvas, sin dependencias. Se monta una sola vez en la página de
// cumpleaños y expone `burst()` mediante ref para dispararlo desde los gestos
// del usuario (abrir el regalo, apagar las velas, pedir el deseo).
//
// Pensado para móvil: usa devicePixelRatio, se detiene solo cuando no quedan
// partículas (no deja un rAF vivo gastando batería) y respeta
// `prefers-reduced-motion`.

import { useEffect, useImperativeHandle, useRef, type RefObject } from 'react'

export type ConfettiHandle = {
  /** Lanza `count` partículas desde (x, y) en píxeles CSS. */
  burst: (x: number, y: number, count?: number) => void
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rot: number
  vr: number
  color: string
  life: number
  shape: 0 | 1 // 0 = cinta, 1 = círculo
}

const COLORS = [
  '#ff6ea9',
  '#ff9ec7',
  '#ffd166',
  '#8ecae6',
  '#c8b6ff',
  '#ffffff',
  '#ff477e',
]

export function Confetti({ ref }: { ref: RefObject<ConfettiHandle | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particles = useRef<Particle[]>([])
  const raf = useRef<number | null>(null)

  useImperativeHandle(ref, () => ({
    burst(x, y, count = 70) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const n = reduce ? Math.round(count / 3) : count
      for (let i = 0; i < n; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 3 + Math.random() * 8
        particles.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 4,
          size: 5 + Math.random() * 7,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          life: 1,
          shape: Math.random() > 0.45 ? 0 : 1,
        })
      }
      start()
    },
  }))

  function start() {
    if (raf.current !== null) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const tick = () => {
      const w = canvas.width / (window.devicePixelRatio || 1)
      const h = canvas.height / (window.devicePixelRatio || 1)
      ctx.clearRect(0, 0, w, h)

      particles.current = particles.current.filter((p) => {
        p.vy += 0.22 // gravedad
        p.vx *= 0.99
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        p.life -= 0.008
        if (p.life <= 0 || p.y > h + 40) return false

        ctx.save()
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life))
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        if (p.shape === 0) {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        } else {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2.4, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
        return true
      })

      if (particles.current.length === 0) {
        raf.current = null
        return
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }

  // Ajusta el tamaño real del canvas al viewport (y a rotaciones del móvil).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      if (raf.current !== null) cancelAnimationFrame(raf.current)
      raf.current = null
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50"
    />
  )
}
