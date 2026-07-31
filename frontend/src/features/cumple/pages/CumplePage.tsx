// Página de felicitación de cumpleaños. Vive fuera del área autenticada:
// la URL es larga y aleatoria (ULID) y ese es todo su "control de acceso".
//
// No consume API ni estado global: es 100% frontend y se pinta sobre un
// contenedor fijo propio para ignorar el chrome/tema de la aplicación.
// El diseño es mobile-first estilo app nativa (iOS/Android): safe areas,
// objetivos táctiles de 44px, gestos con háptica y animaciones cortas.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Cake, Gift, Heart, Music, Sparkles, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Confetti, type ConfettiHandle } from '../components/Confetti'
import { Pastel } from '../components/Pastel'
import foto from '@/assets/cumple.png'

// Personalizable: pon aquí el nombre y se usará en el saludo.
const NOMBRE = ''

const CARTAS = [
  {
    icono: Sparkles,
    titulo: 'Hoy es tu día',
    texto:
      'Que se llene de las cosas pequeñas que te hacen sonreír sin darte cuenta.',
  },
  {
    icono: Heart,
    titulo: 'Gracias por existir',
    texto:
      'El mundo se siente más liviano contigo cerca. Ojalá lo sepas todos los días, no solo hoy.',
  },
  {
    icono: Star,
    titulo: 'Un deseo para ti',
    texto:
      'Que este año te traiga calma, planes que sí se cumplan y momentos que valga la pena recordar.',
  },
  {
    icono: Cake,
    titulo: 'Y lo mejor…',
    texto: 'Que celebremos muchos más. Feliz cumpleaños. 🤍',
  },
]

type Corazon = { id: number; x: number; y: number; emoji: string }

const EMOJIS = ['💗', '💖', '✨', '🤍', '💕', '🌸']

export function CumplePage() {
  const [abierto, setAbierto] = useState(false)
  const [velas, setVelas] = useState([true, true, true, true, true])
  const [deseo, setDeseo] = useState('')
  const [deseoEnviado, setDeseoEnviado] = useState(false)
  const [carta, setCarta] = useState(0)
  const [corazones, setCorazones] = useState<Corazon[]>([])

  const confetti = useRef<ConfettiHandle>(null)
  const idCorazon = useRef(0)
  const apagadas = velas.filter((v) => !v).length
  const todasApagadas = apagadas === velas.length

  // Vibración corta: en Android da tacto real; en iOS se ignora sin romper nada.
  const vibrar = useCallback((ms: number | number[] = 12) => {
    navigator.vibrate?.(ms)
  }, [])

  const soltarCorazon = useCallback((x: number, y: number) => {
    const id = idCorazon.current++
    setCorazones((prev) => [
      ...prev.slice(-14),
      { id, x, y, emoji: EMOJIS[id % EMOJIS.length] },
    ])
    window.setTimeout(
      () => setCorazones((prev) => prev.filter((c) => c.id !== id)),
      1600,
    )
  }, [])

  const abrir = (x: number, y: number) => {
    setAbierto(true)
    vibrar([15, 40, 25])
    confetti.current?.burst(x, y, 120)
    window.setTimeout(() => confetti.current?.burst(x * 0.4, y * 0.8, 60), 260)
  }

  const apagarVela = (i: number, x: number, y: number) => {
    setVelas((prev) => {
      const next = [...prev]
      next[i] = false
      if (next.every((v) => !v)) {
        window.setTimeout(() => {
          confetti.current?.burst(window.innerWidth / 2, window.innerHeight / 3, 140)
          vibrar([20, 50, 20, 50, 40])
        }, 180)
      }
      return next
    })
    soltarCorazon(x, y)
    vibrar(10)
  }

  const enviarDeseo = () => {
    if (!deseo.trim()) return
    setDeseoEnviado(true)
    vibrar([15, 30, 15])
    confetti.current?.burst(window.innerWidth / 2, window.innerHeight * 0.55, 90)
  }

  // Bloquea el scroll del documento mientras la página esté montada: el
  // contenedor propio maneja su propio desplazamiento (sensación de app).
  useEffect(() => {
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.title = NOMBRE ? `Feliz cumpleaños, ${NOMBRE}` : 'Feliz cumpleaños 🎂'
    return () => {
      document.body.style.overflow = previo
    }
  }, [])

  const CartaIcono = CARTAS[carta].icono

  return (
    <div
      className="fixed inset-0 z-40 overflow-y-auto overscroll-none bg-[#1b1030] text-white [-webkit-tap-highlight-color:transparent]"
      onPointerDown={(e) => {
        if (abierto) soltarCorazon(e.clientX, e.clientY)
      }}
    >
      <style>{ESTILOS}</style>

      {/* Fondo: degradado animado + luces suaves */}
      <div aria-hidden className="pointer-events-none fixed inset-0 cumple-fondo" />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-60 [background:radial-gradient(60%_45%_at_20%_10%,rgba(255,110,169,.45),transparent_60%),radial-gradient(55%_40%_at_85%_20%,rgba(140,180,255,.35),transparent_60%),radial-gradient(70%_50%_at_50%_100%,rgba(255,209,102,.25),transparent_60%)]"
      />

      {/* Globos flotando */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        {[
          { l: '8%', d: '0s', s: 1, c: '#ff6ea9' },
          { l: '26%', d: '2.4s', s: 0.75, c: '#ffd166' },
          { l: '48%', d: '4.8s', s: 1.1, c: '#8ecae6' },
          { l: '70%', d: '1.6s', s: 0.85, c: '#c8b6ff' },
          { l: '88%', d: '3.6s', s: 1, c: '#ff9ec7' },
        ].map((g) => (
          <span
            key={g.l}
            className="cumple-globo absolute bottom-[-140px]"
            style={{ left: g.l, animationDelay: g.d, scale: g.s }}
          >
            <svg width="46" height="70" viewBox="0 0 46 70">
              <ellipse cx="23" cy="24" rx="17" ry="22" fill={g.c} opacity=".75" />
              <ellipse cx="17" cy="16" rx="5" ry="7" fill="#fff" opacity=".35" />
              <path d="M23 46v20" stroke={g.c} strokeWidth="1.5" opacity=".5" />
            </svg>
          </span>
        ))}
      </div>

      <Confetti ref={confetti} />

      {/* Corazones que brotan al tocar la pantalla */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-50">
        {corazones.map((c) => (
          <span
            key={c.id}
            className="cumple-corazon absolute text-2xl"
            style={{ left: c.x, top: c.y }}
          >
            {c.emoji}
          </span>
        ))}
      </div>

      {/* ---------------- Portada: el regalo cerrado ---------------- */}
      {!abierto ? (
        <div className="relative flex min-h-dvh flex-col items-center justify-center gap-8 px-6 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+2rem)] text-center">
          <div className="cumple-entrada flex flex-col items-center gap-3">
            <Badge className="cumple-vidrio gap-1.5 border-white/25 bg-white/10 px-3 py-1 text-white backdrop-blur-xl">
              <Gift className="size-3.5" /> Tienes un regalo
            </Badge>
            <p className="max-w-[19rem] text-balance text-sm text-white/70">
              Alguien preparó algo para ti. Toca para abrirlo.
            </p>
          </div>

          <button
            type="button"
            aria-label="Abrir el regalo"
            onClick={(e) => abrir(e.clientX || window.innerWidth / 2, e.clientY || 240)}
            className="cumple-latido group relative size-56 rounded-full outline-none transition active:scale-95 sm:size-64"
          >
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-[#ff6ea9] via-[#ff9ec7] to-[#ffd166] blur-xl opacity-70" />
            <span className="absolute -inset-2 rounded-full border border-white/25" />
            <img
              src={foto}
              alt=""
              className="relative size-full rounded-full object-cover shadow-2xl ring-4 ring-white/40 brightness-110 contrast-105 saturate-105 blur-[3px] transition duration-700 group-active:blur-0"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="cumple-vidrio rounded-full border border-white/30 bg-black/25 px-4 py-2 text-sm font-semibold backdrop-blur-md">
                Tócame ✨
              </span>
            </span>
          </button>

          <div className="flex items-center gap-2 text-xs text-white/50">
            <Music className="size-3.5" /> Sube el volumen de tu corazón
          </div>
        </div>
      ) : (
        /* ---------------- Contenido ---------------- */
        <div className="relative mx-auto flex w-full max-w-md flex-col gap-7 px-5 pt-[calc(env(safe-area-inset-top)+2.5rem)] pb-[calc(env(safe-area-inset-bottom)+3.5rem)]">
          {/* Hero */}
          <header className="cumple-entrada flex flex-col items-center gap-4 text-center">
            <div className="relative">
              <span className="absolute -inset-3 rounded-full bg-gradient-to-br from-[#ff6ea9] to-[#ffd166] opacity-60 blur-xl" />
              <img
                src={foto}
                alt="Foto de la cumpleañera"
                className="relative size-36 rounded-full object-cover shadow-2xl ring-4 ring-white/50 brightness-110 contrast-105"
              />
              <span className="cumple-brillo absolute -right-1 -top-1 text-2xl">✨</span>
            </div>

            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                Feliz cumpleaños
              </p>
              <h1 className="cumple-titulo text-4xl leading-tight font-semibold">
                {NOMBRE || '¡Feliz cumple!'}
              </h1>
              <p className="text-balance pt-1 text-sm text-white/70">
                Hoy el día es tuyo. Deslízate y vívelo. 🎈
              </p>
            </div>
          </header>

          {/* Pastel + velas */}
          <Card className="cumple-vidrio cumple-entrada border-white/15 bg-white/10 text-white backdrop-blur-2xl [animation-delay:.1s]">
            <CardContent className="flex flex-col items-center gap-4 pt-2">
              <div className="flex w-full items-center justify-between">
                <span className="text-sm font-medium">
                  {todasApagadas ? '¡Lo lograste!' : 'Apaga las velitas'}
                </span>
                <Badge className="border-white/20 bg-white/15 text-white">
                  {apagadas}/{velas.length}
                </Badge>
              </div>

              <Pastel velas={velas} onApagar={apagarVela} />

              <Progress
                value={(apagadas / velas.length) * 100}
                className="h-1.5 bg-white/15"
              />

              <p className="text-center text-xs text-white/60">
                {todasApagadas
                  ? 'Todas apagadas — ahora viene lo importante 👇'
                  : 'Toca cada vela con el dedo, una por una.'}
              </p>

              {todasApagadas && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setVelas([true, true, true, true, true])
                    setDeseoEnviado(false)
                    setDeseo('')
                    vibrar(8)
                  }}
                  className="h-11 w-full rounded-xl border border-white/20 text-white hover:bg-white/15 hover:text-white"
                >
                  Encenderlas de nuevo
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Deseo */}
          {todasApagadas && (
            <Card className="cumple-vidrio cumple-entrada border-white/15 bg-white/10 text-white backdrop-blur-2xl">
              <CardContent className="space-y-3 pt-2">
                {deseoEnviado ? (
                  <div className="flex flex-col items-center gap-2 py-2 text-center">
                    <span className="cumple-brillo text-3xl">🌠</span>
                    <p className="text-sm font-medium">Tu deseo ya voló</p>
                    <p className="text-xs text-white/60">
                      No lo cuentes, que se cumple igual.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium">Pide un deseo</p>
                    <Input
                      value={deseo}
                      onChange={(e) => setDeseo(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && enviarDeseo()}
                      placeholder="Escríbelo aquí…"
                      enterKeyHint="send"
                      className="h-12 rounded-xl border-white/20 bg-white/10 text-base text-white placeholder:text-white/40"
                    />
                    <Button
                      onClick={enviarDeseo}
                      disabled={!deseo.trim()}
                      className="h-12 w-full rounded-xl bg-white text-base font-semibold text-[#1b1030] hover:bg-white/90"
                    >
                      Soplar el deseo
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Cartas */}
          <Card className="cumple-vidrio cumple-entrada border-white/15 bg-white/10 text-white backdrop-blur-2xl [animation-delay:.2s]">
            <CardContent className="space-y-4 pt-2">
              <div key={carta} className="cumple-carta space-y-2 text-center">
                <CartaIcono className="mx-auto size-6 text-[#ffd166]" />
                <h2 className="text-lg font-semibold">{CARTAS[carta].titulo}</h2>
                <p className="text-balance text-sm leading-relaxed text-white/75">
                  {CARTAS[carta].texto}
                </p>
              </div>

              <div className="flex items-center justify-center gap-1.5">
                {CARTAS.map((c, i) => (
                  <button
                    key={c.titulo}
                    type="button"
                    aria-label={`Ir a la nota ${i + 1}`}
                    onClick={() => {
                      setCarta(i)
                      vibrar(8)
                    }}
                    className="grid size-8 place-items-center"
                  >
                    <span
                      className={`block h-1.5 rounded-full transition-all ${
                        i === carta ? 'w-5 bg-white' : 'w-1.5 bg-white/35'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <Button
                onClick={() => {
                  setCarta((c) => (c + 1) % CARTAS.length)
                  vibrar(8)
                }}
                className="h-12 w-full rounded-xl bg-gradient-to-b from-[#ff6ea9] to-[#e8497f] text-base font-semibold text-white hover:brightness-105"
              >
                {carta === CARTAS.length - 1 ? 'Leerlas otra vez' : 'Siguiente nota'}
              </Button>
            </CardContent>
          </Card>

          {/* Cierre */}
          <footer className="flex flex-col items-center gap-3 pt-1 text-center">
            <Button
              variant="ghost"
              aria-label="Enviar corazones"
              onClick={() => {
                for (let i = 0; i < 8; i++) {
                  window.setTimeout(
                    () =>
                      soltarCorazon(
                        window.innerWidth * (0.2 + Math.random() * 0.6),
                        window.innerHeight * 0.8,
                      ),
                    i * 90,
                  )
                }
                confetti.current?.burst(
                  window.innerWidth / 2,
                  window.innerHeight * 0.75,
                  70,
                )
                vibrar([12, 30, 12])
              }}
              className="cumple-latido size-16 rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <Heart className="size-7 fill-[#ff6ea9] text-[#ff6ea9]" />
            </Button>
            <p className="text-xs text-white/50">Hecho con cariño, solo para ti.</p>
          </footer>
        </div>
      )}
    </div>
  )
}

// Keyframes propias de esta página (no se usan en el resto de la app, por eso
// viven aquí y no en el CSS global).
const ESTILOS = `
.cumple-fondo{
  background:linear-gradient(160deg,#2a1148,#1b1030 45%,#3a1030);
  background-size:180% 180%;
  animation:cumple-mover 18s ease-in-out infinite;
}
@keyframes cumple-mover{
  0%,100%{background-position:0% 50%}
  50%{background-position:100% 50%}
}
.cumple-vidrio{box-shadow:0 8px 32px rgba(0,0,0,.28)}
.cumple-titulo{
  font-family:"Snell Roundhand","Segoe Script","Brush Script MT",cursive;
  background:linear-gradient(90deg,#fff,#ffd166,#ff9ec7,#fff);
  background-size:220% 100%;
  -webkit-background-clip:text;background-clip:text;color:transparent;
  animation:cumple-brillar 6s linear infinite;
}
@keyframes cumple-brillar{to{background-position:-220% 0}}
.cumple-entrada{animation:cumple-subir .7s cubic-bezier(.22,1,.36,1) both}
@keyframes cumple-subir{from{opacity:0;transform:translateY(22px) scale(.97)}to{opacity:1;transform:none}}
.cumple-carta{animation:cumple-fade .45s ease both}
@keyframes cumple-fade{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}
.cumple-latido{animation:cumple-pulso 2.4s ease-in-out infinite}
@keyframes cumple-pulso{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}
.cumple-brillo{animation:cumple-titilar 2.2s ease-in-out infinite}
@keyframes cumple-titilar{0%,100%{opacity:1;transform:scale(1) rotate(0)}50%{opacity:.55;transform:scale(1.25) rotate(12deg)}}
.cumple-globo{animation:cumple-flotar 14s linear infinite}
@keyframes cumple-flotar{
  0%{transform:translateY(0) rotate(-4deg);opacity:0}
  10%{opacity:.9}
  90%{opacity:.9}
  100%{transform:translateY(-115vh) rotate(4deg);opacity:0}
}
.cumple-corazon{animation:cumple-corazon 1.6s ease-out forwards}
@keyframes cumple-corazon{
  0%{opacity:1;transform:translate(-50%,-50%) scale(.6)}
  100%{opacity:0;transform:translate(-50%,-190px) scale(1.35)}
}
.cumple-flame{animation:cumple-llama .55s ease-in-out infinite alternate;transform-box:fill-box}
@keyframes cumple-llama{from{transform:scaleY(.9) scaleX(1.05)}to{transform:scaleY(1.12) scaleX(.94)}}
.cumple-smoke{animation:cumple-humo 2.6s ease-out forwards}
@keyframes cumple-humo{0%{opacity:.4;transform:translateY(0)}100%{opacity:0;transform:translateY(-26px)}}
@media (prefers-reduced-motion:reduce){
  .cumple-fondo,.cumple-titulo,.cumple-latido,.cumple-brillo,.cumple-globo,.cumple-flame{animation:none}
  .cumple-entrada,.cumple-carta{animation-duration:.01ms}
}
`
