import { useEffect, useRef, useState } from 'react'
import {
  renderScanlines, FIELD_OPTIONS, GEOMETRY_OPTIONS, MARK_OPTIONS, SOURCE_OPTIONS,
  PALETTES, CHARSET_OPTIONS,
} from './engine.js'
import { coverDraw, makeLuma, startWebcam, startVideoFile, stopStream } from './camera.js'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../_shared/exportSpecs.js'
import { defaultAutoplay } from '../../lib/appSettings.js'
import { usePublishReset, usePublishRetrigger } from '../../components/framework/pageShortcuts.jsx'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import EditorFooter from '../../components/framework/EditorFooter.jsx'
import Section from '../../components/molecules/Section.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../components/atoms/ToggleSwitch.jsx'
import Button from '../../components/atoms/Button.jsx'

const BASE = 1200
const FALLBACK = {
  geometry: 'rows', mark: 'dots', field: 'noise', source: 'none',
  rows: 90, rayCount: 200, ringCount: 60, turns: 6, arms: 1,
  minGap: 5, maxGap: 24, freq: 1, contrast: 1,
  displace: 0, swirl: 0, lens: 1.6, weave: false,
  markSize: 1, dashLen: 1.2, charset: 'ascii', fontScale: 1,
  palette: 'mono', invert: false,
}

// One editor for every Scanline sub-page — the registry entry just seeds
// defaults; the whole control surface (geometry · mark · field · source ·
// spacing · displace · colour) is exposed everywhere. Mounted with key={page.id}
// so switching sub-pages re-seeds cleanly.
export default function ScanlineEditor({ page }) {
  const D = { ...FALLBACK, ...page.defaults }

  const canvasRef = useRef(null)
  const timeRef = useRef(0)
  const videoRef = useRef(null)
  const sampleCanvasRef = useRef(null)
  const lumaRef = useRef(null)
  const streamRef = useRef(null)
  const mediaUrlRef = useRef(null)
  const imgInputRef = useRef(null)
  const vidInputRef = useRef(null)

  const [geometry, setGeometry] = useState(D.geometry)
  const [mark, setMark] = useState(D.mark)
  const [field, setField] = useState(D.field)
  const [source, setSource] = useState(D.source)
  const [mediaReady, setMediaReady] = useState(false)
  const [rows, setRows] = useState(D.rows)
  const [rayCount, setRayCount] = useState(D.rayCount)
  const [ringCount, setRingCount] = useState(D.ringCount)
  const [turns, setTurns] = useState(D.turns)
  const [arms, setArms] = useState(D.arms)
  const [minGap, setMinGap] = useState(D.minGap)
  const [maxGap, setMaxGap] = useState(D.maxGap)
  const [freq, setFreq] = useState(D.freq)
  const [contrast, setContrast] = useState(D.contrast)
  const [displace, setDisplace] = useState(D.displace)
  const [swirl, setSwirl] = useState(D.swirl)
  const [lens, setLens] = useState(D.lens)
  const [weave, setWeave] = useState(D.weave)
  const [markSize, setMarkSize] = useState(D.markSize)
  const [dashLen, setDashLen] = useState(D.dashLen)
  const [charset, setCharset] = useState(D.charset)
  const [fontScale, setFontScale] = useState(D.fontScale)
  const [palette, setPalette] = useState(D.palette)
  const [invert, setInvert] = useState(D.invert)
  const [seed, setSeed] = useState(0)

  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [footTab, setFootTab] = useState('transport')

  const camOn = source !== 'none' && mediaReady
  const camLive = (source === 'webcam' || source === 'video') && mediaReady
  const lumaSample = (nx, ny) => (lumaRef.current ? lumaRef.current(nx, ny) : 0.5)
  const params = {
    geometry, mark, field, rows, rayCount, ringCount, turns, arms,
    minGap, maxGap, freq, contrast, displace, swirl, lens, weave,
    markSize, dashLen, charset, fontScale, palette, invert, seed,
    sample: camOn ? lumaSample : undefined,
  }

  const reset = () => {
    setGeometry(D.geometry); setMark(D.mark); setField(D.field)
    setRows(D.rows); setRayCount(D.rayCount); setRingCount(D.ringCount); setTurns(D.turns); setArms(D.arms)
    setMinGap(D.minGap); setMaxGap(D.maxGap); setFreq(D.freq); setContrast(D.contrast)
    setDisplace(D.displace); setSwirl(D.swirl); setLens(D.lens); setWeave(D.weave)
    setMarkSize(D.markSize); setDashLen(D.dashLen); setCharset(D.charset); setFontScale(D.fontScale)
    setPalette(D.palette); setInvert(D.invert); setSeed(0); timeRef.current = 0
  }
  usePublishReset(reset)
  usePublishRetrigger(() => setSeed((s) => s + 1))

  // ── media teardown / switch ───────────────────────────────────────────────
  const teardownMedia = () => {
    stopStream(streamRef.current); streamRef.current = null
    if (mediaUrlRef.current) { URL.revokeObjectURL(mediaUrlRef.current); mediaUrlRef.current = null }
    const v = videoRef.current
    if (v) { try { v.pause() } catch { /* */ } v.removeAttribute('src'); v.srcObject = null }
    lumaRef.current = null
    setMediaReady(false)
  }
  const switchSource = async (next) => {
    teardownMedia()
    setSource(next)
    if (next === 'webcam') {
      try { streamRef.current = await startWebcam(videoRef.current); setMediaReady(true) }
      catch { setSource('none') }
    }
  }
  const onUploadImage = (e) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const r = ratioFor(aspect) || 1
      const sw = 240, sh = Math.max(1, Math.round(240 / r))
      const sc = document.createElement('canvas'); sc.width = sw; sc.height = sh
      coverDraw(sc.getContext('2d'), img, sw, sh, false)
      lumaRef.current = makeLuma(sc.getContext('2d').getImageData(0, 0, sw, sh))
      sampleCanvasRef.current = sc
      setMediaReady(true)
      URL.revokeObjectURL(url)
    }
    img.src = url
  }
  const onUploadVideo = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    if (mediaUrlRef.current) URL.revokeObjectURL(mediaUrlRef.current)
    const url = URL.createObjectURL(file)
    mediaUrlRef.current = url
    try { await startVideoFile(videoRef.current, url); setMediaReady(true) }
    catch { teardownMedia() }
  }

  // ── render / animation loop ───────────────────────────────────────────────
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const r = ratioFor(aspect) || 1
    const w = r >= 1 ? BASE : Math.round(BASE * r)
    const h = r >= 1 ? Math.round(BASE / r) : BASE
    cv.width = w
    cv.height = h

    const pull = () => {
      if (!camLive) return
      const v = videoRef.current
      if (!v || v.readyState < 2) return
      let sc = sampleCanvasRef.current
      if (!sc) { sc = document.createElement('canvas'); sampleCanvasRef.current = sc }
      const sw = 220, sh = Math.max(1, Math.round(220 / r))
      if (sc.width !== sw || sc.height !== sh) { sc.width = sw; sc.height = sh }
      const sctx = sc.getContext('2d')
      if (coverDraw(sctx, v, sw, sh, source === 'webcam')) {
        lumaRef.current = makeLuma(sctx.getImageData(0, 0, sw, sh))
      }
    }

    if (!playing && !camLive) { pull(); renderScanlines(cv, params, timeRef.current); return }
    let alive = true
    let raf
    let last = performance.now()
    const loop = (now) => {
      if (!alive) return
      const dt = (now - last) / 1000
      last = now
      timeRef.current += dt * (tempo / 120)
      pull()
      renderScanlines(cv, params, timeRef.current)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(raf) }
  }, [geometry, mark, field, source, rows, rayCount, ringCount, turns, arms, minGap, maxGap, freq, contrast, displace, swirl, lens, weave, markSize, dashLen, charset, fontScale, palette, invert, seed, mediaReady, playing, tempo, aspect]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => teardownMedia(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const exportPng = () => {
    const dd = dimsFor(aspect, Number(scale)) || { w: canvasRef.current.width, h: canvasRef.current.height }
    const out = document.createElement('canvas')
    out.width = dd.w; out.height = dd.h
    renderScanlines(out, params, timeRef.current)
    out.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `kol-scanlines-${page.id}-${Date.now()}.png`; a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  const getSettings = () => ({
    geometry, mark, field, source, rows, rayCount, ringCount, turns, arms, minGap, maxGap,
    freq, contrast, displace, swirl, lens, weave, markSize, dashLen, charset, fontScale,
    palette, invert, aspect, scale,
  })
  const applySettings = (s) => {
    for (const [k, v] of Object.entries(s)) {
      ({
        geometry: setGeometry, mark: setMark, field: setField, source: setSource, rows: setRows,
        rayCount: setRayCount, ringCount: setRingCount, turns: setTurns, arms: setArms,
        minGap: setMinGap, maxGap: setMaxGap, freq: setFreq, contrast: setContrast,
        displace: setDisplace, swirl: setSwirl, lens: setLens, weave: setWeave, markSize: setMarkSize,
        dashLen: setDashLen, charset: setCharset, fontScale: setFontScale, palette: setPalette,
        invert: setInvert, aspect: setAspect, scale: setScale,
      }[k]?.(v))
    }
  }

  const isRows = geometry === 'rows' || geometry === 'columns'

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <canvas ref={canvasRef} className="max-w-full max-h-[90vh] object-contain rounded" />
        <video ref={videoRef} className="hidden" playsInline muted />
      </div>

      <EditorRail
        footerBare
        header={<RailHeader>{page.label}</RailHeader>}
        footer={
          <EditorFooter
            tab={footTab}
            onTab={setFootTab}
            transport={{
              playing,
              onPlay: () => setPlaying(true),
              onPause: () => setPlaying(false),
              onStop: () => { setPlaying(false); timeRef.current = 0 },
              onRewind: () => { timeRef.current = 0 },
              tempo,
              onTempo: setTempo,
              tempoMax: 400,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
            settingsPage={`scanlines-${page.id}`}
            getSettings={getSettings}
            applySettings={applySettings}
          />
        }
      >
        <Section label="Source">
          <SegmentedToggle options={SOURCE_OPTIONS} value={source} onChange={switchSource} className="w-full" />
          <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={onUploadImage} />
          <input ref={vidInputRef} type="file" accept="video/*" className="hidden" onChange={onUploadVideo} />
          {source === 'image' && (
            <div className="flex flex-col gap-2">
              <Button variant="primary" size="sm" className="w-full" iconLeft="upload" onClick={() => imgInputRef.current?.click()}>{mediaReady ? 'Replace image' : 'Upload image'}</Button>
              {mediaReady && <Button variant="secondary" size="sm" className="w-full" onClick={teardownMedia}>Clear</Button>}
            </div>
          )}
          {source === 'video' && (
            <div className="flex flex-col gap-2">
              <Button variant="primary" size="sm" className="w-full" iconLeft="upload" onClick={() => vidInputRef.current?.click()}>{mediaReady ? 'Replace video' : 'Upload video'}</Button>
              {mediaReady && <Button variant="secondary" size="sm" className="w-full" onClick={teardownMedia}>Clear</Button>}
            </div>
          )}
          {source === 'webcam' && (
            mediaReady
              ? <Button variant="secondary" size="sm" className="w-full" onClick={() => switchSource('none')}>Stop camera</Button>
              : <Button variant="primary" size="sm" className="w-full" iconLeft="camera" onClick={() => switchSource('webcam')}>Start camera</Button>
          )}
        </Section>

        <Section label="Geometry">
          <SegmentedToggle options={GEOMETRY_OPTIONS} value={geometry} onChange={setGeometry} className="w-full" />
          {isRows && <Slider labeled label="Lines" min={8} max={260} step={1} value={rows} onChange={setRows} variant="default" noExpr />}
          {geometry === 'radial' && <Slider labeled label="Rays" min={16} max={520} step={1} value={rayCount} onChange={setRayCount} variant="default" noExpr />}
          {geometry === 'rings' && <Slider labeled label="Rings" min={4} max={200} step={1} value={ringCount} onChange={setRingCount} variant="default" noExpr />}
          {geometry === 'spiral' && <Slider labeled label="Turns" min={1} max={30} step={0.5} value={turns} onChange={setTurns} variant="default" />}
          {geometry === 'spiral' && <Slider labeled label="Arms" min={1} max={8} step={1} value={arms} onChange={setArms} variant="default" noExpr />}
          {isRows && <ToggleSwitch variant="plain" label="Weave (rows + columns)" checked={weave} onChange={setWeave} />}
        </Section>

        <Section label="Spacing">
          <Slider labeled label="Min Gap" min={1} max={24} step={0.5} value={minGap} onChange={setMinGap} variant="default" />
          <Slider labeled label="Max Gap" min={4} max={64} step={0.5} value={maxGap} onChange={setMaxGap} variant="default" />
          <Slider labeled label="Contrast" min={0.3} max={4} step={0.05} value={contrast} onChange={setContrast} variant="default" />
          <Slider labeled label="Displace" min={0} max={1} step={0.02} value={displace} onChange={setDisplace} variant="default" />
        </Section>

        <Section label="Field">
          {source === 'none' && <SegmentedToggle options={FIELD_OPTIONS} value={field} onChange={setField} className="w-full" />}
          {source === 'none' && field !== 'radial' && <Slider labeled label="Field Scale" min={0.2} max={4} step={0.05} value={freq} onChange={setFreq} variant="default" />}
          {source === 'none' && field === 'radial' && <Slider labeled label="Lens" min={0.3} max={4} step={0.05} value={lens} onChange={setLens} variant="default" />}
          {(geometry === 'radial' || geometry === 'rings' || geometry === 'spiral') && <Slider labeled label="Swirl" min={-1} max={1} step={0.02} value={swirl} onChange={setSwirl} variant="default" />}
          <ToggleSwitch variant="plain" label="Invert" checked={invert} onChange={setInvert} />
        </Section>

        <Section label="Mark">
          <SegmentedToggle options={MARK_OPTIONS} value={mark} onChange={setMark} className="w-full" />
          {mark === 'glyph' ? (
            <>
              <SegmentedToggle options={CHARSET_OPTIONS} value={charset} onChange={setCharset} className="w-full" />
              <Slider labeled label="Font Size" min={0.4} max={2} step={0.05} value={fontScale} onChange={setFontScale} variant="default" />
            </>
          ) : (
            <Slider labeled label={mark === 'lattice' ? 'Line Weight' : 'Mark Size'} min={0.2} max={3} step={0.05} value={markSize} onChange={setMarkSize} variant="default" />
          )}
          {mark === 'dash' && <Slider labeled label="Dash Length" min={0.3} max={3} step={0.05} value={dashLen} onChange={setDashLen} variant="default" />}
        </Section>

        <Section label="Color">
          <SegmentedToggle options={PALETTES.map((p) => ({ value: p.value, label: p.label }))} value={palette} onChange={setPalette} className="w-full" />
        </Section>
      </EditorRail>
    </div>
  )
}
