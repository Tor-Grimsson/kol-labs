import { useEffect, useRef, useState } from 'react'
import { defaultAutoplay } from '../../../lib/appSettings.js'
import { GrayScott, RD_PRESETS, RD_PALETTES, RD_SEEDS, DITHER_STYLES, buildFK } from './engine.js'
import { resolveDeep } from '../../../lib/exprParam.js'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, dimsFor } from '../../_shared/exportSpecs.js'
import { ImageProvider, useImage } from '../../radar/state/ImageContext.jsx'
import MediaPicker from '../../../components/framework/MediaPicker.jsx'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import Section from '../../../components/molecules/Section.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Button from '../../../components/atoms/Button.jsx'

const DISPLAY = 900
const GRID_N = 170

function sampleBrightness(img) {
  const c = document.createElement('canvas')
  c.width = GRID_N; c.height = GRID_N
  const ctx = c.getContext('2d')
  ctx.drawImage(img, 0, 0, GRID_N, GRID_N)
  const d = ctx.getImageData(0, 0, GRID_N, GRID_N).data
  const b = new Float32Array(GRID_N * GRID_N)
  for (let i = 0; i < GRID_N * GRID_N; i++) {
    const j = i << 2
    b[i] = (0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2]) / 255
  }
  return b
}

// Optic · Reaction-diffusion — Gray-Scott growth. Square field, upscaled.
function ReactionInner() {
  const { sourceImage, loadImageFromFile, loadImageFromUrl, clearImage } = useImage()
  const displayRef = useRef(null)
  const simRef = useRef(null)
  const engineRef = useRef(null)
  const fileRef = useRef(null)

  const [preset, setPreset] = useState('mitosis')
  const [feed, setFeed] = useState(0.0367)
  const [kill, setKill] = useState(0.0649)
  const [du, setDu] = useState(0.16)
  const [dv, setDv] = useState(0.08)
  const [seed, setSeed] = useState('scatter')
  const [gain, setGain] = useState(3.2)
  const [iters, setIters] = useState(10)
  const [palette, setPalette] = useState('lava')
  const [ditherStyle, setDitherStyle] = useState('coral')
  const [ditherInvert, setDitherInvert] = useState(false)
  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [footTab, setFootTab] = useState('transport')
  const [pickerOpen, setPickerOpen] = useState(false)

  const timeRef = useRef(0)
  const cfg = useRef({})
  cfg.current = { iters, palette, playing, feed, kill, du, dv, gain }

  useEffect(() => {
    const engine = new GrayScott(GRID_N)
    engineRef.current = engine
    simRef.current = document.createElement('canvas')
    const display = displayRef.current
    const dctx = display.getContext('2d')
    dctx.imageSmoothingEnabled = true
    let alive = true
    let raf
    let last = performance.now()
    const loop = (now) => {
      if (!alive) return
      const c = cfg.current
      const dt = (now - last) / 1000
      last = now
      if (c.playing) timeRef.current += dt
      engine.setParams(resolveDeep({ feed: c.feed, kill: c.kill, du: c.du, dv: c.dv, gain: c.gain }, timeRef.current))
      if (c.playing) engine.step(c.iters)
      engine.render(simRef.current, c.palette)
      dctx.drawImage(simRef.current, 0, 0, DISPLAY, DISPLAY)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(raf); engineRef.current = null }
  }, [])

  useEffect(() => { engineRef.current?.setParams({ seed }); engineRef.current?.reseed() }, [seed])

  // Source change → sample brightness, rebuild FK map, reseed.
  useEffect(() => {
    const e = engineRef.current
    if (!e) return
    if (!sourceImage) { e.clearImageField(); return }
    const brightness = sampleBrightness(sourceImage)
    const style = DITHER_STYLES.find((s) => s.value === ditherStyle) || DITHER_STYLES[0]
    const { feed: f, kill: k } = buildFK(brightness, style, ditherInvert)
    e.setImageField(f, k)
    e.reseed()
  }, [sourceImage]) // eslint-disable-line react-hooks/exhaustive-deps

  // Dither style/invert change → live remap (morphs without reseed).
  useEffect(() => {
    const e = engineRef.current
    if (!e || !sourceImage) return
    const brightness = sampleBrightness(sourceImage)
    const style = DITHER_STYLES.find((s) => s.value === ditherStyle) || DITHER_STYLES[0]
    const { feed: f, kill: k } = buildFK(brightness, style, ditherInvert)
    e.setImageField(f, k)
  }, [ditherStyle, ditherInvert]) // eslint-disable-line react-hooks/exhaustive-deps

  const choosePreset = (id) => {
    setPreset(id)
    const p = RD_PRESETS.find((x) => x.value === id)
    if (p) { setFeed(p.feed); setKill(p.kill) }
  }

  const exportPng = () => {
    const dd = dimsFor(aspect, Number(scale)) || { w: 1080, h: 1080 }
    const out = document.createElement('canvas')
    out.width = dd.w
    out.height = dd.h
    const ctx = out.getContext('2d')
    ctx.imageSmoothingEnabled = true
    const sim = simRef.current
    const s = Math.min(sim.width / dd.w, sim.height / dd.h)
    const sw = dd.w * s, sh = dd.h * s
    ctx.drawImage(sim, (sim.width - sw) / 2, (sim.height - sh) / 2, sw, sh, 0, 0, dd.w, dd.h)
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

  const getSettings = () => ({ preset, feed, kill, du, dv, seed, gain, iters, palette, aspect, scale })
  const applySettings = (s) => {
    if (s.preset != null) setPreset(s.preset)
    if (s.feed != null) setFeed(s.feed)
    if (s.kill != null) setKill(s.kill)
    if (s.du != null) setDu(s.du)
    if (s.dv != null) setDv(s.dv)
    if (s.seed != null) setSeed(s.seed)
    if (s.gain != null) setGain(s.gain)
    if (s.iters != null) setIters(s.iters)
    if (s.palette != null) setPalette(s.palette)
    if (s.aspect != null) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
  }

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <canvas data-vcap="stage" ref={displayRef} width={DISPLAY} height={DISPLAY} className="max-w-full max-h-[90vh] object-contain rounded" />
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
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
            settingsPage="optic-reaction"
            getSettings={getSettings}
            applySettings={applySettings}
            file={
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" className="flex-1" onClick={() => fileRef.current?.click()}>Upload</Button>
                  <Button variant="primary" size="sm" className="flex-1" onClick={() => setPickerOpen(true)}>Library</Button>
                </div>
                {sourceImage && <Button variant="secondary" size="sm" className="w-full" onClick={clearImage}>Clear</Button>}
              </div>
            }
          />
        }
      >
        <Section label="Pattern">
          {!sourceImage && (
            <Dropdown size="sm" options={RD_PRESETS.map((p) => ({ value: p.value, label: p.label }))} value={preset} onChange={choosePreset} variant="subtle" className="w-full" />
          )}
          <Dropdown size="sm" options={RD_SEEDS} value={seed} onChange={setSeed} variant="subtle" className="w-full" />
          <Button variant="primary" size="sm" iconLeft="cycle" onClick={() => engineRef.current?.reseed()} className="w-full">Reseed</Button>
        </Section>

        {sourceImage ? (
          <Section label="Dither">
            <Dropdown size="sm" options={DITHER_STYLES.map((s) => ({ value: s.value, label: s.label }))} value={ditherStyle} onChange={setDitherStyle} variant="subtle" className="w-full" />
            <ToggleSwitch variant="plain" label="Invert" checked={ditherInvert} onChange={setDitherInvert} />
          </Section>
        ) : (
          <Section label="Chemistry">
            <Slider labeled label="Feed" min={0.01} max={0.08} step={0.0005} value={feed} onChange={setFeed} variant="default" />
            <Slider labeled label="Kill" min={0.04} max={0.075} step={0.0005} value={kill} onChange={setKill} variant="default" />
            <Slider labeled label="Diffuse U" min={0.05} max={0.3} step={0.005} value={du} onChange={setDu} variant="default" />
            <Slider labeled label="Diffuse V" min={0.02} max={0.16} step={0.005} value={dv} onChange={setDv} variant="default" />
            <Slider labeled label="Speed" min={1} max={30} step={1} value={iters} onChange={setIters} variant="default" noExpr />
          </Section>
        )}

        <Section label="Color">
          <Dropdown size="sm" options={RD_PALETTES.map((p) => ({ value: p.value, label: p.label }))} value={palette} onChange={setPalette} variant="subtle" className="w-full" />
          <Slider labeled label="Contrast" min={1} max={6} step={0.1} value={gain} onChange={setGain} variant="default" />
        </Section>
      </EditorRail>

      <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={(e) => loadImageFromFile(e.target.files?.[0])} />
      <MediaPicker open={pickerOpen} accept="all" onClose={() => setPickerOpen(false)} onPick={(url, o) => { loadImageFromUrl(url, o?.contentType); setPickerOpen(false) }} />
    </div>
  )
}

export default function ReactionPage() {
  return (
    <ImageProvider>
      <ReactionInner />
    </ImageProvider>
  )
}
