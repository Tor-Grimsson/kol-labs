import { useEffect, useRef, useState } from 'react'
import {
  renderScanlines, FIELD_OPTIONS, GEOMETRY_OPTIONS, MARK_OPTIONS, SOURCE_OPTIONS,
  PALETTES, CHARSET_OPTIONS,
} from './engine.js'
import { presetsFor } from './registry.js'
import { coverDraw, makeLuma, startWebcam, startVideoFile, stopStream } from './camera.js'
import SourcePlaceholder from '../radar/components/SourcePlaceholder.jsx'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../_shared/exportSpecs.js'
import { defaultAutoplay } from '../../lib/appSettings.js'
import { usePublishReset, usePublishRetrigger } from '../../components/framework/pageShortcuts.jsx'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import EditorFooter from '../../components/framework/EditorFooter.jsx'
import Section from '../../components/molecules/Section.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
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

// A filter always has a source — drop 'none' from its source toggle.
const FILTER_SOURCE_OPTIONS = SOURCE_OPTIONS.filter((o) => o.value !== 'none')

// One editor for both Scanline modes:
//   mode="generator" — source off; procedural field drives density (Field section).
//   mode="filter"    — source on; image/video/webcam luma drives density (Source
//                      section + empty-state drop-frame, Field hidden).
// Geometry + Mark are controls; the Preset dropdown applies a curated combo
// in-place. Mounted with key={mode} so switching modes re-seeds cleanly.
export default function ScanlineEditor({ mode = 'generator' }) {
  const isFilter = mode === 'filter'
  const PRESETS = presetsFor(mode)
  const D = { ...FALLBACK, ...PRESETS[0].defaults }

  const canvasRef = useRef(null)
  const timeRef = useRef(0)
  const videoRef = useRef(null)
  const sampleCanvasRef = useRef(null)
  const lumaRef = useRef(null)
  const streamRef = useRef(null)
  const mediaUrlRef = useRef(null)
  const imgInputRef = useRef(null)
  const vidInputRef = useRef(null)

  const [presetId, setPresetId] = useState(PRESETS[0].id)
  const [geometry, setGeometry] = useState(D.geometry)
  const [mark, setMark] = useState(D.mark)
  const [field, setField] = useState(D.field)
  const [source, setSource] = useState(isFilter ? (D.source ?? 'image') : 'none')
  const [mediaReady, setMediaReady] = useState(false)
  const [dragging, setDragging] = useState(false)
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

  // Apply a preset's curated defaults in-place (look params only — source stays
  // as the user set it, so picking a preset never triggers a webcam prompt).
  const applyPreset = (id) => {
    const preset = PRESETS.find((p) => p.id === id) || PRESETS[0]
    const d = { ...FALLBACK, ...preset.defaults }
    setPresetId(id)
    setGeometry(d.geometry); setMark(d.mark); setField(d.field)
    setRows(d.rows); setRayCount(d.rayCount); setRingCount(d.ringCount); setTurns(d.turns); setArms(d.arms)
    setMinGap(d.minGap); setMaxGap(d.maxGap); setFreq(d.freq); setContrast(d.contrast)
    setDisplace(d.displace); setSwirl(d.swirl); setLens(d.lens); setWeave(d.weave)
    setMarkSize(d.markSize); setDashLen(d.dashLen); setCharset(d.charset); setFontScale(d.fontScale)
    setPalette(d.palette); setInvert(d.invert); setSeed(0); timeRef.current = 0
  }
  usePublishReset(() => applyPreset(presetId))
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
      catch { setSource('image') }
    }
  }
  const loadImageFile = (file) => {
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
      setSource('image')
      setMediaReady(true)
      URL.revokeObjectURL(url)
    }
    img.src = url
  }
  const loadVideoFile = async (file) => {
    if (!file) return
    if (mediaUrlRef.current) URL.revokeObjectURL(mediaUrlRef.current)
    const url = URL.createObjectURL(file)
    mediaUrlRef.current = url
    try { await startVideoFile(videoRef.current, url); setSource('video'); setMediaReady(true) }
    catch { teardownMedia() }
  }
  const onUploadImage = (e) => { const f = e.target.files?.[0]; e.target.value = ''; loadImageFile(f) }
  const onUploadVideo = (e) => { const f = e.target.files?.[0]; e.target.value = ''; loadVideoFile(f) }

  // Load a CDN-library pick (image OR video) into the luma sampler. Route the
  // kol-media host through the same-origin /media proxy so the canvas stays
  // untainted (getImageData on a CORS-tainted frame throws); crossOrigin too.
  const loadFromUrl = (url, contentType) => {
    if (!url) return
    const u = url.replace(/^https:\/\/media\.kolkrabbi\.io\//, '/media/')
    const isVid = contentType ? contentType.startsWith('video/') : /\.(mp4|webm|mov|m4v)$/i.test(u)
    if (isVid) {
      teardownMedia()
      const v = videoRef.current
      if (v) v.crossOrigin = 'anonymous'
      startVideoFile(v, u).then(() => { setSource('video'); setMediaReady(true) }).catch(() => teardownMedia())
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const r = ratioFor(aspect) || 1
      const sw = 240, sh = Math.max(1, Math.round(240 / r))
      const sc = document.createElement('canvas'); sc.width = sw; sc.height = sh
      coverDraw(sc.getContext('2d'), img, sw, sh, false)
      lumaRef.current = makeLuma(sc.getContext('2d').getImageData(0, 0, sw, sh))
      sampleCanvasRef.current = sc
      setSource('image'); setMediaReady(true)
    }
    img.src = u
  }

  // ── drag-and-drop (filter only) ───────────────────────────────────────────
  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = (e) => { e.preventDefault(); setDragging(false) }
  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    if (file.type.startsWith('video/')) loadVideoFile(file); else loadImageFile(file)
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

    // Animate only when something actually moves: the generator's field flows
    // with time, but a filter changes only with a LIVE source — a still image is
    // static, so don't burn frames re-rendering it (full-res path rebuild + field
    // sample every tick is the resource hog). Paused = frozen either way; Space
    // toggles `playing` via the footer transport.
    const animate = playing && (!isFilter || camLive)
    if (!animate) { pull(); renderScanlines(cv, params, timeRef.current); return }
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

  // The footer transport drives a loaded source video/webcam too (pause = freeze).
  useEffect(() => {
    const v = videoRef.current
    if (!v || !camLive) return
    if (playing) { const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}) } else v.pause()
  }, [playing, camLive])

  const exportPng = () => {
    const dd = dimsFor(aspect, Number(scale)) || { w: canvasRef.current.width, h: canvasRef.current.height }
    const out = document.createElement('canvas')
    out.width = dd.w; out.height = dd.h
    renderScanlines(out, params, timeRef.current)
    out.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `kol-scanlines-${mode}-${Date.now()}.png`; a.click()
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
  const r = ratioFor(aspect) || 4 / 5

  // Source lives in the footer's File tab (Transport · Output · File) — never a
  // rail-body section. Filter only; the generator's File tab falls back to
  // settings Save/Load.
  const filePanel = isFilter ? (
    <div className="flex flex-col gap-2">
      <SegmentedToggle options={FILTER_SOURCE_OPTIONS} value={source} onChange={switchSource} className="w-full" />
      {source === 'image' && (
        <>
          <Button variant="primary" size="sm" className="w-full" iconLeft="upload" onClick={() => imgInputRef.current?.click()}>{mediaReady ? 'Replace image' : 'Upload image'}</Button>
          {mediaReady && <Button variant="secondary" size="sm" className="w-full" onClick={teardownMedia}>Clear</Button>}
        </>
      )}
      {source === 'video' && (
        <>
          <Button variant="primary" size="sm" className="w-full" iconLeft="upload" onClick={() => vidInputRef.current?.click()}>{mediaReady ? 'Replace video' : 'Upload video'}</Button>
          {mediaReady && <Button variant="secondary" size="sm" className="w-full" onClick={teardownMedia}>Clear</Button>}
        </>
      )}
      {source === 'webcam' && (
        mediaReady
          ? <Button variant="secondary" size="sm" className="w-full" onClick={() => switchSource('image')}>Stop camera</Button>
          : <Button variant="primary" size="sm" className="w-full" iconLeft="camera" onClick={() => switchSource('webcam')}>Start camera</Button>
      )}
    </div>
  ) : undefined

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div
        className="flex-1 flex items-center justify-center p-4 overflow-hidden"
        onDragOver={isFilter ? handleDragOver : undefined}
        onDragLeave={isFilter ? handleDragLeave : undefined}
        onDrop={isFilter ? handleDrop : undefined}
      >
        {isFilter && !mediaReady ? (
          <div
            className="flex border border-dashed overflow-hidden"
            style={{
              aspectRatio: r,
              width: `min(100%, calc(85vh * ${r}))`,
              borderRadius: 'var(--kol-radius-sm)',
              borderColor: dragging ? 'var(--kol-accent-primary)' : 'var(--kol-border-default)',
              backgroundColor: dragging ? 'color-mix(in srgb, var(--kol-accent-primary) 8%, var(--kol-fg-04))' : 'var(--kol-fg-04)',
              transition: 'border-color 0.2s, background-color 0.2s',
            }}
          >
            <SourcePlaceholder onUpload={() => imgInputRef.current?.click()} onPick={loadFromUrl} />
          </div>
        ) : (
          <canvas data-vcap="stage" ref={canvasRef} className="max-w-full max-h-[90vh] object-contain rounded" />
        )}
        <video ref={videoRef} className="hidden" playsInline muted />
      </div>

      <EditorRail
        footerBare
        header={<RailHeader>Scanline</RailHeader>}
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
              tempoMax: 300,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
            settingsPage={`scanlines-${mode}`}
            getSettings={getSettings}
            applySettings={applySettings}
            file={filePanel}
          />
        }
      >
        <Section label="Preset">
          <Dropdown size="sm" options={PRESETS.map((p) => ({ value: p.id, label: p.label }))} value={presetId} onChange={applyPreset} variant="subtle" className="w-full" />
        </Section>

        <Section label="Geometry">
          <Dropdown size="sm" options={GEOMETRY_OPTIONS} value={geometry} onChange={setGeometry} variant="subtle" className="w-full" />
          {isRows && <Slider labeled label="Lines" min={8} max={260} step={1} value={rows} onChange={setRows} variant="default" noExpr />}
          {geometry === 'radial' && <Slider labeled label="Rays" min={16} max={520} step={1} value={rayCount} onChange={setRayCount} variant="default" noExpr />}
          {geometry === 'rings' && <Slider labeled label="Rings" min={4} max={200} step={1} value={ringCount} onChange={setRingCount} variant="default" noExpr />}
          {geometry === 'spiral' && <Slider labeled label="Turns" min={1} max={30} step={0.5} value={turns} onChange={setTurns} variant="default" />}
          {geometry === 'spiral' && <Slider labeled label="Arms" min={1} max={8} step={1} value={arms} onChange={setArms} variant="default" noExpr />}
          {(geometry === 'radial' || geometry === 'rings' || geometry === 'spiral') && <Slider labeled label="Swirl" min={-1} max={1} step={0.02} value={swirl} onChange={setSwirl} variant="default" />}
          {isRows && <ToggleSwitch labeled variant="plain" label="Weave" checked={weave} onChange={setWeave} />}
        </Section>

        <Section label="Spacing">
          <Slider labeled label="Min Gap" min={1} max={24} step={0.5} value={minGap} onChange={setMinGap} variant="default" />
          <Slider labeled label="Max Gap" min={4} max={64} step={0.5} value={maxGap} onChange={setMaxGap} variant="default" />
          <Slider labeled label="Contrast" min={0.3} max={4} step={0.05} value={contrast} onChange={setContrast} variant="default" />
          <Slider labeled label="Displace" min={0} max={1} step={0.02} value={displace} onChange={setDisplace} variant="default" />
          <ToggleSwitch labeled variant="plain" label="Invert" checked={invert} onChange={setInvert} />
        </Section>

        {!isFilter && (
          <Section label="Field">
            <SegmentedToggle options={FIELD_OPTIONS} value={field} onChange={setField} className="w-full" />
            {field !== 'radial' && <Slider labeled label="Field Scale" min={0.2} max={4} step={0.05} value={freq} onChange={setFreq} variant="default" />}
            {field === 'radial' && <Slider labeled label="Lens" min={0.3} max={4} step={0.05} value={lens} onChange={setLens} variant="default" />}
          </Section>
        )}

        <Section label="Mark">
          <Dropdown size="sm" options={MARK_OPTIONS} value={mark} onChange={setMark} variant="subtle" className="w-full" />
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
          <Dropdown size="sm" options={PALETTES.map((p) => ({ value: p.value, label: p.label }))} value={palette} onChange={setPalette} variant="subtle" className="w-full" />
        </Section>
      </EditorRail>

      {/* Hidden source inputs — kept mounted (the empty-state placeholder + the
          File-tab buttons both trigger them) regardless of the active footer tab. */}
      <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={onUploadImage} />
      <input ref={vidInputRef} type="file" accept="video/*" className="hidden" onChange={onUploadVideo} />
    </div>
  )
}
