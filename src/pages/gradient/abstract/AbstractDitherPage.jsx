import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { defaultAutoplay } from '../../../lib/appSettings.js'
import { ImageProvider, useImage } from '../../radar/state/ImageContext.jsx'
import SourcePlaceholder from '../../radar/components/SourcePlaceholder.jsx'
import MediaPicker from '../../../components/framework/MediaPicker.jsx'
import { usePublishReset } from '../../../components/framework/pageShortcuts.jsx'
import RDEngine from './engine/RDEngine.js'
import { DITHER_STYLES, ditherStyleById, buildFK, RD_PALETTES } from './data/models.js'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../../_shared/exportSpecs.js'
import Button from '../../../components/atoms/Button.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../../components/molecules/LabeledControl.jsx'
import Section from '../../../components/molecules/Section.jsx'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import { LiveClock } from '../../../lib/liveClock.jsx'

const N = 180

// Sample an image element to an N×N luma map [0,1] (squished to square — the sim
// grid is toroidal/square), with a contrast remap around mid-grey.
function sampleBrightness(img, contrast) {
  const c = document.createElement('canvas')
  c.width = N
  c.height = N
  const ctx = c.getContext('2d')
  ctx.drawImage(img, 0, 0, N, N)
  const data = ctx.getImageData(0, 0, N, N).data
  const b = new Float32Array(N * N)
  for (let i = 0; i < N * N; i++) {
    const j = i << 2
    let v = (0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]) / 255
    v = (v - 0.5) * contrast + 0.5
    b[i] = v < 0 ? 0 : v > 1 ? 1 : v
  }
  return b
}

// Abstract · Dither (Engine C) — TexTuring: Gray-Scott whose feed/kill is driven
// per-cell by image brightness, so the photo emerges through the reaction texture.
// Reuses the radar ImageProvider source pipeline (upload + CDN/gallery, CORS-safe).
function DitherInner() {
  const { sourceImage, loadImageFromFile, loadImageFromUrl, clearImage } = useImage()

  const [styleId, setStyleId] = useState('coral')
  const [invert, setInvert] = useState(false)
  const [contrast, setContrast] = useState(1.4)
  const [palette, setPalette] = useState('ink')
  const [paused, setPaused] = useState(() => !defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [footTab, setFootTab] = useState('transport')
  const [pickerOpen, setPickerOpen] = useState(false)

  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const fileRef = useRef(null)
  const aspectRef = useRef(aspect)
  aspectRef.current = aspect

  const sizeCanvas = useCallback(() => {
    const el = wrapRef.current
    const cv = canvasRef.current
    if (!el || !cv) return
    const aw = el.clientWidth
    const ah = el.clientHeight
    const r = ratioFor(aspectRef.current) || 1
    let w = aw
    let h = w / r
    if (h > ah) { h = ah; w = h * r }
    w = Math.max(1, Math.floor(w))
    h = Math.max(1, Math.floor(h))
    cv.style.width = `${w}px`
    cv.style.height = `${h}px`
    cv.width = w
    cv.height = h
  }, [])

  useEffect(() => {
    sizeCanvas()
    const engine = new RDEngine(canvasRef.current, N)
    engineRef.current = engine
    engine.setVariation({ model: 'gray-scott', params: { feed: 0.0545, kill: 0.062 }, palette: 'ink', seed: 'scatter' })
    engine.setPaused(true)
    engine.start()
    const ro = new ResizeObserver(() => sizeCanvas())
    ro.observe(wrapRef.current)
    return () => {
      ro.disconnect()
      engine.dispose()
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sample the image → per-cell feed/kill (cheap; ~one canvas read). Style/invert/
  // contrast tweaks just re-map the field and the running sim morphs into it —
  // no reseed, no warmup, so dragging a slider stays smooth.
  const applyFK = useCallback(() => {
    const e = engineRef.current
    if (!e || !sourceImage) return
    const fk = buildFK(sampleBrightness(sourceImage, contrast), ditherStyleById(styleId), invert)
    e.setImageField(fk.feed, fk.kill)
  }, [sourceImage, contrast, styleId, invert])

  // Full re-grow (reseed + warm to a developed still) — image load, reset, rewind.
  const regrow = useCallback(() => {
    const e = engineRef.current
    if (!e) return
    applyFK()
    e.reseed()
    e.warmup(120)
  }, [applyFK])
  usePublishReset(regrow)

  // Image change → grow from scratch; null → back to the placeholder.
  useEffect(() => {
    const e = engineRef.current
    if (!e) return
    if (!sourceImage) { e.clearImageField(); return }
    regrow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceImage])

  // Style/invert/contrast → live re-map (morphs while playing; press play if paused).
  useEffect(() => {
    if (sourceImage) applyFK()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleId, invert, contrast])

  useEffect(() => { engineRef.current?.setPalette(palette) }, [palette])
  useEffect(() => { engineRef.current?.setSpeed(tempo / 120) }, [tempo])
  useEffect(() => { sizeCanvas() }, [aspect, sizeCanvas])

  const play = () => { setPaused(false); engineRef.current?.setPaused(false) }
  const pause = () => { setPaused(true); engineRef.current?.setPaused(true) }

  const exportPng = async () => {
    const e = engineRef.current
    if (!e) return
    const d = dimsFor(aspect, Number(scale))
    const blob = d ? await e.exportBlobAt(d.w, d.h) : await e.exportBlob()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kol-abstract-dither-${styleId}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  const paletteOptions = useMemo(() => RD_PALETTES.map((p) => ({ value: p.value, label: p.label })), [])

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div ref={wrapRef} className="relative min-w-0 flex-1 overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} data-vcap="stage" className="block" style={{ display: sourceImage ? 'block' : 'none' }} />
        {!sourceImage && <SourcePlaceholder onUpload={() => fileRef.current?.click()} />}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => loadImageFromFile(e.target.files?.[0])} />
      </div>

      <LiveClock getT={() => engineRef.current?.time}>
      <EditorRail
        footerBare
        header={<RailHeader>Dither</RailHeader>}
        footer={
          <EditorFooter
            tab={footTab}
            onTab={setFootTab}
            transport={{
              playing: !paused,
              onPlay: play,
              onPause: pause,
              onStop: () => { pause(); regrow() },
              onRewind: regrow,
              tempo,
              onTempo: setTempo,
              tempoMax: 300,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng} disabled={!sourceImage}>Export PNG</Button>}
          />
        }
      >
          <Section label="Source">
            <div className="flex gap-2">
              <Button variant="primary" size="sm" className="flex-1" onClick={() => fileRef.current?.click()}>Upload</Button>
              <Button variant="primary" size="sm" className="flex-1" onClick={() => setPickerOpen(true)}>Library</Button>
            </div>
            {sourceImage && <Button variant="secondary" size="sm" className="w-full" onClick={clearImage}>Clear image</Button>}
          </Section>

          <Section label="Dither">
            <LabeledControl inline label="texture">
              <Dropdown size="sm" variant="subtle" className="w-full" options={DITHER_STYLES} value={styleId} onChange={setStyleId} />
            </LabeledControl>
            <Slider labeled label="Contrast" min={0.4} max={3} step={0.1} value={contrast} onChange={setContrast} className="w-full" />
            <ToggleSwitch variant="plain" label="Invert" checked={invert} onChange={setInvert} />
          </Section>

          <Section label="Palette">
            <Dropdown size="sm" variant="subtle" className="w-full" options={paletteOptions} value={palette} onChange={setPalette} />
          </Section>
      </EditorRail>
      </LiveClock>

      <MediaPicker open={pickerOpen} accept="image" onClose={() => setPickerOpen(false)} onPick={(url, o) => { loadImageFromUrl(url, o?.contentType); setPickerOpen(false) }} />
    </div>
  )
}

export default function AbstractDitherPage() {
  return (
    <ImageProvider>
      <DitherInner />
    </ImageProvider>
  )
}
