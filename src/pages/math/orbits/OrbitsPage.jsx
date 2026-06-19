import { useEffect, useRef, useState } from 'react'
import { makeBodies, stepBodies } from './data/sim.js'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor } from '../../_shared/exportSpecs.js'
import { mulberry32, randomSeed } from '../../../lib/rng.js'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import Section from '../../../components/molecules/Section.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Button from '../../../components/atoms/Button.jsx'

const BASE = 1100
const BG = '#06070b'

// Math · Orbits — n-body orbital-trail toy (the polyhop "thread spinner" look):
// bodies orbit a central mass and leave glowing, fading trails via additive
// feedback accumulation. Paused freezes the canvas; play/reset re-seed.
export default function OrbitsPage() {
  const canvasRef = useRef(null)
  const bodiesRef = useRef([])
  const [count, setCount] = useState(140)
  const [gravity, setGravity] = useState(0.9)
  const [mutual, setMutual] = useState(false)
  const [trail, setTrail] = useState(0.86) // 1 = longest trails
  const [glow, setGlow] = useState(10)
  const [mono, setMono] = useState(false)
  const [seed, setSeed] = useState(1)
  const [playing, setPlaying] = useState(true)
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [footTab, setFootTab] = useState('transport')

  // (Re)size the canvas to the aspect, rebuild bodies, clear — on structural change.
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const r = ratioFor(aspect) || 1
    const w = r >= 1 ? BASE : Math.round(BASE * r)
    const h = r >= 1 ? Math.round(BASE / r) : BASE
    cv.width = w
    cv.height = h
    bodiesRef.current = makeBodies(count, mulberry32(seed))
    const ctx = cv.getContext('2d')
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)
  }, [aspect, count, seed])

  // Animation loop — fade, step, draw additively. Only while playing (paused
  // freezes the accumulated frame).
  useEffect(() => {
    if (!playing) return
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    let alive = true
    let raf
    const loop = () => {
      if (!alive) return
      const w = cv.width
      const h = cv.height
      const s = (Math.min(w, h) / 2) * 0.92
      const cx = w / 2
      const cy = h / 2
      const speed = tempo / 120

      // fade the previous frame toward bg → trails
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = (1 - trail) * 0.4 + 0.012
      ctx.fillStyle = BG
      ctx.fillRect(0, 0, w, h)
      ctx.globalAlpha = 1

      // step the sim (2 substeps for stability)
      const dt = 0.016 * speed
      stepBodies(bodiesRef.current, { gravity, mutual, dt: dt * 0.5 })
      stepBodies(bodiesRef.current, { gravity, mutual, dt: dt * 0.5 })

      // draw bodies additively, glowing
      ctx.globalCompositeOperation = 'lighter'
      for (const b of bodiesRef.current) {
        const px = cx + b.x * s
        const py = cy + b.y * s
        const color = mono ? '#cfe8ff' : `hsl(${b.hue}, 90%, 66%)`
        if (glow > 0) { ctx.shadowBlur = glow; ctx.shadowColor = color }
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(px, py, 1.7, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.shadowBlur = 0
      ctx.globalCompositeOperation = 'source-over'

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(raf) }
  }, [playing, gravity, mutual, trail, glow, mono, tempo])

  const reset = () => {
    const cv = canvasRef.current
    if (cv) {
      bodiesRef.current = makeBodies(count, mulberry32(seed))
      const ctx = cv.getContext('2d')
      ctx.fillStyle = BG
      ctx.fillRect(0, 0, cv.width, cv.height)
    }
  }

  const exportPng = () => {
    const cv = canvasRef.current
    if (!cv) return
    cv.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kol-orbits-${seed}.png`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  const getSettings = () => ({ count, gravity, mutual, trail, glow, mono, seed, aspect, scale })
  const applySettings = (s) => {
    if (s.count != null) setCount(s.count)
    if (s.gravity != null) setGravity(s.gravity)
    if (s.mutual != null) setMutual(s.mutual)
    if (s.trail != null) setTrail(s.trail)
    if (s.glow != null) setGlow(s.glow)
    if (s.mono != null) setMono(s.mono)
    if (s.seed != null) setSeed(s.seed)
    if (s.aspect != null) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
  }

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <canvas ref={canvasRef} className="max-w-full max-h-[90vh] object-contain rounded" style={{ background: BG }} />
      </div>

      <EditorRail
        footerBare
        header={<RailHeader>Orbits</RailHeader>}
        footer={
          <EditorFooter
            tab={footTab}
            onTab={setFootTab}
            transport={{
              playing,
              onPlay: () => setPlaying(true),
              onPause: () => setPlaying(false),
              onStop: () => { setPlaying(false); reset() },
              onRewind: reset,
              tempo,
              onTempo: setTempo,
              tempoMax: 400,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
            settingsPage="math-orbits"
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        <Section label="Bodies">
          <Slider labeled label="Count" min={1} max={400} step={1} value={count} onChange={setCount} variant="default" noExpr />
          <ToggleSwitch variant="plain" label="Mutual gravity" checked={mutual} onChange={setMutual} />
          <Button variant="primary" size="sm" iconLeft="cycle" onClick={() => setSeed(randomSeed())} className="w-full">Randomize</Button>
        </Section>

        <Section label="Orbit">
          <Slider labeled label="Gravity" min={0.1} max={3} step={0.05} value={gravity} onChange={setGravity} variant="default" />
        </Section>

        <Section label="Render">
          <Slider labeled label="Trail" min={0} max={1} step={0.01} value={trail} onChange={setTrail} variant="default" />
          <Slider labeled label="Glow" min={0} max={30} step={1} value={glow} onChange={setGlow} variant="default" />
          <ToggleSwitch variant="plain" label="Mono" checked={mono} onChange={setMono} />
        </Section>

        <div className="kol-helper-10 text-body">n-body · central gravity · additive glow trails</div>
      </EditorRail>
    </div>
  )
}
