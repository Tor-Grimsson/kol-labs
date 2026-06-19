import { useEffect, useRef, useState } from 'react'
import { GrayScott, RD_PRESETS, RD_PALETTES } from './engine.js'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import Section from '../../../components/molecules/Section.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import Button from '../../../components/atoms/Button.jsx'

const DISPLAY = 900

// Optic · Reaction-diffusion — Gray-Scott growth. Square field, upscaled.
export default function ReactionPage() {
  const displayRef = useRef(null)
  const simRef = useRef(null)
  const engineRef = useRef(null)
  const [preset, setPreset] = useState('mitosis')
  const [feed, setFeed] = useState(0.0367)
  const [kill, setKill] = useState(0.0649)
  const [iters, setIters] = useState(10)
  const [palette, setPalette] = useState('lava')
  const [playing, setPlaying] = useState(true)
  const [footTab, setFootTab] = useState('transport')

  // refs read inside the loop so it needn't restart on every tweak
  const cfg = useRef({ iters, palette, playing })
  cfg.current = { iters, palette, playing }

  useEffect(() => {
    const engine = new GrayScott(170)
    engineRef.current = engine
    simRef.current = document.createElement('canvas')
    const display = displayRef.current
    const dctx = display.getContext('2d')
    dctx.imageSmoothingEnabled = true
    let alive = true
    let raf
    const loop = () => {
      if (!alive) return
      const { iters: it, palette: pal, playing: pl } = cfg.current
      if (pl) engine.step(it)
      engine.render(simRef.current, pal)
      dctx.drawImage(simRef.current, 0, 0, DISPLAY, DISPLAY)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(raf); engineRef.current = null }
  }, [])

  useEffect(() => { engineRef.current?.setParams({ feed, kill }) }, [feed, kill])

  const choosePreset = (id) => {
    setPreset(id)
    const p = RD_PRESETS.find((x) => x.value === id)
    if (p) { setFeed(p.feed); setKill(p.kill) }
  }

  const exportPng = () => {
    const out = document.createElement('canvas')
    out.width = 1080
    out.height = 1080
    const ctx = out.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(simRef.current, 0, 0, 1080, 1080)
    out.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kol-reaction-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  const getSettings = () => ({ preset, feed, kill, iters, palette })
  const applySettings = (s) => {
    if (s.preset != null) setPreset(s.preset)
    if (s.feed != null) setFeed(s.feed)
    if (s.kill != null) setKill(s.kill)
    if (s.iters != null) setIters(s.iters)
    if (s.palette != null) setPalette(s.palette)
  }

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <canvas ref={displayRef} width={DISPLAY} height={DISPLAY} className="max-w-full max-h-[90vh] object-contain rounded" />
      </div>

      <EditorRail
        footerBare
        header={<RailHeader>Reaction</RailHeader>}
        footer={
          <EditorFooter
            tab={footTab}
            onTab={setFootTab}
            transport={{
              playing,
              onPlay: () => setPlaying(true),
              onPause: () => setPlaying(false),
              onStop: () => { setPlaying(false); engineRef.current?.reseed() },
              onRewind: () => engineRef.current?.reseed(),
              tempo: iters,
              onTempo: setIters,
              tempoMax: 30,
            }}
            output={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG (1080²)</Button>}
            settingsPage="optic-reaction"
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        <Section label="Pattern">
          <Dropdown size="sm" options={RD_PRESETS.map((p) => ({ value: p.value, label: p.label }))} value={preset} onChange={choosePreset} variant="subtle" className="w-full" />
          <Button variant="primary" size="sm" iconLeft="cycle" onClick={() => engineRef.current?.reseed()} className="w-full">Reseed</Button>
        </Section>

        <Section label="Chemistry">
          <Slider labeled label="Feed" min={0.01} max={0.08} step={0.0005} value={feed} onChange={setFeed} variant="default" />
          <Slider labeled label="Kill" min={0.04} max={0.075} step={0.0005} value={kill} onChange={setKill} variant="default" />
          <Slider labeled label="Speed" min={1} max={30} step={1} value={iters} onChange={setIters} variant="default" noExpr />
        </Section>

        <Section label="Color">
          <Dropdown size="sm" options={RD_PALETTES.map((p) => ({ value: p.value, label: p.label }))} value={palette} onChange={setPalette} variant="subtle" className="w-full" />
        </Section>

        <div className="kol-helper-10 text-body">Gray-Scott · toroidal · 170² upscaled</div>
      </EditorRail>
    </div>
  )
}
