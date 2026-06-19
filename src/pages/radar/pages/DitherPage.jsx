import { useState, useRef, useEffect, useCallback } from 'react'
import { renderDither, MODE_OPTIONS, SHAPE_OPTIONS, DEFAULT_PARAMS } from '../effects/ditherEngine'
import { makeSweep } from '../effects/sweeps'
import { CANVAS_FX_DEFS, getDefaultCanvasFxParams, applyCanvasFx } from '../hooks/useCanvasFx'
import { ASPECT_SPECS, SOURCE_DEFAULT as DEFAULT_ASPECT, defaultAspectFor, DEFAULT_SCALE, dimsFor, ratioFor } from '../../_shared/exportSpecs.js'
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'
import ButtonGroup from '../../../components/molecules/ButtonGroup.jsx'
import LibrarySourceButton from '../components/LibrarySourceButton.jsx'
import SourcePlaceholder from '../components/SourcePlaceholder.jsx'
import { fitSourceToFrame } from '../utils/fitFrame'
import Button from '../../../components/atoms/Button.jsx'
import Divider from '../../../components/atoms/Divider.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import Section from '../../../components/molecules/Section.jsx'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import ColorPicker from '../components/ColorPicker'
import SweepControls from '../components/SweepControls'
import FxParamControl from '../components/FxParamControl.jsx'
import VideoTransport from '../components/VideoTransport'
import { useImage } from '../state/ImageContext'
import { resolveParams, hasExpr } from '../../../lib/exprParam.js'
import { LiveClock } from '../../../lib/liveClock.jsx'
import { uploadToLibrary, saveToGallery } from '../../../lib/mediaLibrary.js'

export default function DitherPage() {
  const { sourceImage, isVideo, loadImageFromFile, clearImage } = useImage()
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const [amount, setAmount] = useState(0) // 0 = raw, 100 = full effect — dial it in
  const [params, setParams] = useState({ ...DEFAULT_PARAMS })
  const [dragging, setDragging] = useState(false)
  const [fxChain, setFxChain] = useState([])
  const [sweeps, setSweeps] = useState([])
  const [animating, setAnimating] = useState(false)
  const [motionSpeed, setMotionSpeed] = useState(0.5)
  const [playing, setPlaying] = useState(true)
  const timeRef = useRef(0)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const [exporting, setExporting] = useState(false)
  const [exportAspect, setExportAspect] = useState(() => defaultAspectFor('source'))
  const [exportScale, setExportScale] = useState(DEFAULT_SCALE)
  const [tab, setTab] = useState('effect') // Effect | Motion rail tabs
  const [footTab, setFootTab] = useState('transport') // Transport | Output footer toggle
  const [exportFit, setExportFit] = useState('cover')
  const [saving, setSaving] = useState(null) // 'library' | 'gallery' | null

  // Draw a source (image / framed canvas) to the visible canvas, longest side capped.
  const drawSource = useCallback((src) => {
    const cv = canvasRef.current
    if (!cv || !src) return
    let dw = src.width || src.videoWidth || 1
    let dh = src.height || src.videoHeight || 1
    const cap = 1600
    if (dw > cap) { dh = Math.round(cap * dh / dw); dw = cap }
    cv.width = dw
    cv.height = dh
    cv.getContext('2d').drawImage(src, 0, 0, dw, dh)
  }, [])

  // When a source loads, reset the motion clock (amount/effect persists).
  useEffect(() => {
    timeRef.current = 0
  }, [sourceImage, isVideo])

  // Render: stills draw once per state change; video (or an Animate'd still
  // with sweeps) runs a per-frame loop — requestVideoFrameCallback paces video,
  // rAF drives still-animation. Animated frames process at a capped width
  // (per-frame getImageData at full res is the cliff); the snapshot stays full.
  // Animate when it's video, an Animate'd still with sweeps, OR any param is a
  // time-expression (sin(t) etc.) — the latter needs a running clock to move.
  const animated = isVideo || (amount > 0 && (animating || hasExpr(params)))
  useEffect(() => {
    if (!sourceImage || !canvasRef.current) return
    const draw = () => {
      const cv = canvasRef.current
      if (!cv) return
      const a = amount / 100 // 0 = raw, 1 = full effect; in between crossfades
      // Frame the source into the chosen export aspect (cover/fit); 'source' = native.
      const r = ratioFor(exportAspect)
      let src = sourceImage
      if (r) {
        const base = animated ? 960 : 1400
        const fw = r >= 1 ? base : Math.round(base * r)
        const fh = r >= 1 ? Math.round(base / r) : base
        src = fitSourceToFrame(sourceImage, fw, fh, exportFit, params.bgColor)
      }
      if (a <= 0) { drawSource(src); return }
      const t = timeRef.current * motionSpeed
      const p = { ...resolveParams(params, t), sweeps, time: t, ...(animated ? { maxDisplay: 960 } : {}) }
      renderDither(cv, src, p)
      if (fxChain.length > 0) applyCanvasFx(cv, fxChain)
      if (a < 1) { // dial: paint the framed source back over the effect at (1 - amount)
        const ctx = cv.getContext('2d')
        ctx.save(); ctx.globalAlpha = 1 - a
        ctx.drawImage(src, 0, 0, cv.width, cv.height)
        ctx.restore()
      }
    }
    if (!animated) { draw(); return }
    let alive = true
    let handle
    let last = performance.now()
    const loop = (now) => {
      if (!alive) return
      const ts = now ?? performance.now()
      const d = (ts - last) / 1000
      last = ts
      if (playing) timeRef.current += d // transport pause freezes the motion clock
      draw()
      handle = (isVideo && sourceImage.requestVideoFrameCallback)
        ? sourceImage.requestVideoFrameCallback(loop)
        : requestAnimationFrame(loop)
    }
    loop(performance.now())
    return () => {
      alive = false
      if (handle == null) return
      if (isVideo && sourceImage.cancelVideoFrameCallback) sourceImage.cancelVideoFrameCallback(handle)
      else cancelAnimationFrame(handle)
    }
  }, [params, sweeps, motionSpeed, animated, fxChain, amount, sourceImage, isVideo, drawSource, exportAspect, exportFit, playing])

  // Transport play/pause also drives the source video.
  useEffect(() => {
    if (isVideo && sourceImage) {
      if (playing) { const pr = sourceImage.play(); if (pr && pr.catch) pr.catch(() => {}) } else sourceImage.pause()
    }
  }, [playing, isVideo, sourceImage])

  const updateParam = (key, value) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }

  // Export the processed canvas to webm while the video plays (same
  // MediaRecorder pattern as the distort page).
  const toggleExport = () => {
    if (exporting) { recorderRef.current?.stop(); return }
    const canvas = canvasRef.current
    if (!canvas) return
    const stream = canvas.captureStream(30)
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
    const rec = new MediaRecorder(stream, { mimeType: mime })
    chunksRef.current = []
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      const link = document.createElement('a')
      link.download = `kol-radar-${Date.now()}.webm`
      link.href = URL.createObjectURL(blob)
      link.click()
      URL.revokeObjectURL(link.href)
      setExporting(false)
    }
    rec.start()
    recorderRef.current = rec
    setExporting(true)
  }

  // Stop a running export if the page unmounts.
  useEffect(() => () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
  }, [])

  const handleFileUpload = (e) => loadImageFromFile(e.target.files[0])

  // Drag and drop
  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = (e) => { e.preventDefault(); setDragging(false) }
  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    loadImageFromFile(e.dataTransfer.files[0])
  }

  // Render the export at the chosen output standard (crisp at any size) — the
  // dialed amount + FX baked in. Shared by Download + Save to library/gallery.
  // 'source' → native res/aspect; otherwise crop/fit into the target frame.
  const buildExportCanvas = () => {
    const dims = dimsFor(exportAspect, Number(exportScale))
    const src = dims ? fitSourceToFrame(sourceImage, dims.w, dims.h, exportFit, params.bgColor) : sourceImage
    const out = document.createElement('canvas')
    const a = amount / 100
    if (a > 0) {
      const t = timeRef.current * motionSpeed
      renderDither(out, src, { ...resolveParams(params, t), sweeps, time: t, maxDisplay: dims ? dims.w : Infinity })
      if (fxChain.length > 0) applyCanvasFx(out, fxChain)
      if (a < 1) {
        const ctx = out.getContext('2d')
        ctx.save(); ctx.globalAlpha = 1 - a
        ctx.drawImage(src, 0, 0, out.width, out.height)
        ctx.restore()
      }
    } else if (dims) {
      out.width = dims.w
      out.height = dims.h
      out.getContext('2d').drawImage(src, 0, 0)
    } else {
      out.width = sourceImage.width
      out.height = sourceImage.height
      out.getContext('2d').drawImage(sourceImage, 0, 0)
    }
    return out
  }

  const handleDownload = () => {
    if (!sourceImage) return
    const link = document.createElement('a')
    link.download = `kol-radar-${Date.now()}.png`
    link.href = buildExportCanvas().toDataURL()
    link.click()
  }

  // Save the PNG export straight to the CDN library (any env) or the local
  // gallery (dev only) — no file download.
  const saveExport = (dest) => {
    if (!sourceImage || saving) return
    setSaving(dest)
    const name = `dither-${Date.now()}.png`
    buildExportCanvas().toBlob(async (blob) => {
      try {
        if (dest === 'library') await uploadToLibrary(blob, `radar/${name}`)
        else await saveToGallery(blob, 'radar', name)
      } catch (e) {
        console.error('save failed', e) // eslint-disable-line no-console
      } finally {
        setSaving(null)
      }
    }, 'image/png')
  }

  const randomize = () => {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
    setParams(prev => ({
      ...prev,
      mode: pick(MODE_OPTIONS).value,
      shape: pick(SHAPE_OPTIONS).value,
      cellSize: 5 + Math.floor(Math.random() * 24),
      baseScale: Math.round((0.4 + Math.random() * 1.2) * 40) / 40,
      gap: Math.floor(Math.random() * 5),
      contrast: Math.floor(Math.random() * 80) - 20,
      intensity: Math.round((0.5 + Math.random() * 1.5) * 20) / 20,
    }))
    setAmount((a) => (a > 0 ? a : 100)) // dial the effect in so the reroll is visible
  }

  // FX chain
  const addFx = (fxId) => {
    if (!fxId) return
    setFxChain(prev => [...prev, { type: fxId, enabled: true, params: getDefaultCanvasFxParams(fxId) }])
  }

  const removeFx = (index) => setFxChain(prev => prev.filter((_, i) => i !== index))

  const toggleFx = (index) => {
    setFxChain(prev => prev.map((fx, i) => i === index ? { ...fx, enabled: !fx.enabled } : fx))
  }

  const updateFxParam = (index, key, value) => {
    setFxChain(prev => prev.map((fx, i) =>
      i === index ? { ...fx, params: { ...fx.params, [key]: value } } : fx
    ))
  }

  // Sweeps (time-driven motion). Adding the first one auto-enables Animate.
  const addSweep = (preset) => { setSweeps(prev => [...prev, makeSweep(preset?.shape, preset)]); setAnimating(true) }
  const removeSweep = (index) => setSweeps(prev => prev.filter((_, i) => i !== index))
  const updateSweep = (index, key, value) => {
    setSweeps(prev => prev.map((sw, i) => i === index ? { ...sw, [key]: value } : sw))
  }

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      {/* Canvas / drop area */}
      <div
        className="flex-1 flex items-center justify-center p-4 overflow-hidden"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {!sourceImage ? (
          <div
            className="flex border border-dashed overflow-hidden"
            style={{
              aspectRatio: ratioFor(exportAspect) || 4 / 5,
              width: `min(100%, calc(85vh * ${ratioFor(exportAspect) || 4 / 5}))`,
              borderRadius: 'var(--kol-radius-sm)',
              borderColor: dragging ? 'var(--kol-accent-primary)' : 'var(--kol-border-default)',
              backgroundColor: dragging ? 'color-mix(in srgb, var(--kol-accent-primary) 8%, var(--kol-fg-04))' : 'var(--kol-fg-04)',
              transition: 'border-color 0.2s, background-color 0.2s',
            }}
          >
            <SourcePlaceholder onUpload={() => fileInputRef.current?.click()} />
          </div>
        ) : (
          <canvas ref={canvasRef} className="max-w-full max-h-[90vh] object-contain" />
        )}
      </div>

      {/* Controls panel */}
      <LiveClock getT={() => timeRef.current * motionSpeed}>
      <EditorRail
        footerBare
        header={
          <>
            <RailHeader>Radar</RailHeader>
            {isVideo && sourceImage && <VideoTransport video={sourceImage} />}
            <SegmentedToggle
              value={tab}
              onChange={setTab}
              options={[{ value: 'effect', label: 'Effect' }, { value: 'motion', label: 'Motion' }]}
            />
          </>
        }
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
              tempo: Math.round(motionSpeed * 240),
              onTempo: (v) => setMotionSpeed(v / 240),
              tempoMax: 600,
            }}
            exportProps={{
              aspect: exportAspect,
              onAspect: setExportAspect,
              aspects: ASPECT_SPECS,
              scale: exportScale,
              onScale: setExportScale,
              fit: exportFit,
              onFit: setExportFit,
            }}
            exportActions={<>
              {sourceImage && (
                <Button variant="primary" size="sm" onClick={handleDownload} iconLeft="download" className="w-full">Download</Button>
              )}
              {sourceImage && (
                <Button variant="primary" size="sm" onClick={() => saveExport('library')} iconLeft="upload" className="w-full" disabled={!!saving}>
                  {saving === 'library' ? 'Saving…' : 'Save to library'}
                </Button>
              )}
              {sourceImage && import.meta.env.DEV && (
                <Button variant="primary" size="sm" onClick={() => saveExport('gallery')} iconLeft="image" className="w-full" disabled={!!saving}>
                  {saving === 'gallery' ? 'Saving…' : 'Save to gallery'}
                </Button>
              )}
              {sourceImage && (isVideo || (animating && amount > 0)) && (
                <Button variant={exporting ? 'accent' : 'primary'} size="sm" onClick={toggleExport} iconLeft={exporting ? 'control-stop' : 'video'} className="w-full">
                  {exporting ? 'Stop Export' : 'Export Video'}
                </Button>
              )}
            </>}
            file={
              <div className="flex flex-col gap-2">
                <ButtonGroup orientation="vertical" className="w-full">
                  <Button variant="primary" size="sm" onClick={() => fileInputRef.current?.click()} iconLeft="upload" className="w-full">Upload Image</Button>
                  <Button variant="primary" size="sm" onClick={() => videoInputRef.current?.click()} iconLeft="video" className="w-full">Upload Video</Button>
                  <LibrarySourceButton />
                </ButtonGroup>
                {sourceImage && (
                  <Button variant="secondary" size="sm" onClick={clearImage} iconLeft="cross" className="w-full">Clear image</Button>
                )}
              </div>
            }
          />
        }
      >
        {tab === 'effect' && (<>
        <Section label="Effect">
          <Slider labeled label="Amount" min={0} max={100} step={1} value={amount} onChange={setAmount} variant="default" />
        </Section>

        <Divider />

        <Section label="Mode">
          <Dropdown size="sm" options={MODE_OPTIONS} value={params.mode} onChange={(v) => updateParam('mode', v)} variant="subtle" className="w-full" />
        </Section>

        <Section label="Shape">
          <Dropdown size="sm" options={SHAPE_OPTIONS} value={params.shape} onChange={(v) => updateParam('shape', v)} variant="subtle" className="w-full" />
          <Button variant="primary" size="sm" iconLeft="cycle" onClick={randomize} className="w-full">Randomize</Button>
        </Section>

        <Divider />

        <Section label="Dither">
          <Slider labeled label="Cell Size" min={4} max={40} step={1} value={params.cellSize} onChange={(v) => updateParam('cellSize', v)} variant="default" />
          <Slider labeled label="Scale" min={0.1} max={3} step={0.025} value={params.baseScale} onChange={(v) => updateParam('baseScale', v)} variant="default" />
          <Slider labeled label="Gap" min={0} max={20} step={0.25} value={params.gap} onChange={(v) => updateParam('gap', v)} variant="default" />
          <Slider labeled label="Contrast" min={-100} max={100} step={1} value={params.contrast} onChange={(v) => updateParam('contrast', v)} variant="default" />
          <Slider labeled label="Intensity" min={0} max={5} step={0.05} value={params.intensity} onChange={(v) => updateParam('intensity', v)} variant="default" />
        </Section>

        <Divider />

        <Section label="Color">
          <ToggleSwitch labeled variant="plain" label="Original Color" checked={params.useColor} onChange={(v) => updateParam('useColor', v)} />

          {!params.useColor && (
            <div className="flex items-center justify-between">
              <span className="kol-helper-10 uppercase tracking-widest text-meta">Foreground</span>
              <ColorPicker color={params.monoColor} onChange={(v) => updateParam('monoColor', v)} />
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="kol-helper-10 uppercase tracking-widest text-meta">Background</span>
            <ColorPicker color={params.bgColor} onChange={(v) => updateParam('bgColor', v)} />
          </div>
        </Section>

        <Divider />

        <Section label="Post-Processing">
        {fxChain.map((fx, i) => {
          const def = CANVAS_FX_DEFS.find(d => d.id === fx.type)
          if (!def) return null
          return (
            <div key={i} className="flex flex-col gap-2 p-2 rounded bg-fg-04">
              <div className="flex items-center gap-2">
                <ToggleSwitch labeled variant="plain" label={def.label} checked={fx.enabled} onChange={() => toggleFx(i)} />
                <Button variant="ghost" size="sm" quiet iconOnly="cross" iconSize={12} className="ml-auto" aria-label="Remove effect" onClick={() => removeFx(i)} />
              </div>
              {fx.enabled && Object.entries(def.params).map(([key, spec]) => (
                <FxParamControl key={key} name={key} spec={spec} value={fx.params[key]} onChange={(v) => updateFxParam(i, key, v)} />
              ))}
            </div>
          )
        })}

        <Dropdown
          size="sm"
          options={[{ value: '', label: 'Add FX...' }, ...CANVAS_FX_DEFS.map(d => ({ value: d.id, label: d.label }))]}
          value=""
          onChange={(v) => addFx(v)}
          variant="subtle"
          className="w-full"
        />
        </Section>
        </>)}

        {tab === 'motion' && (
        <SweepControls
          isVideo={isVideo}
          animating={animating}
          onAnimate={setAnimating}
          speed={motionSpeed}
          onSpeed={setMotionSpeed}
          sweeps={sweeps}
          onAdd={addSweep}
          onRemove={removeSweep}
          onUpdate={updateSweep}
        />
        )}

      </EditorRail>
      </LiveClock>

      <input ref={fileInputRef} type="file" accept="image/*,.svg" onChange={handleFileUpload} className="hidden" />
      <input ref={videoInputRef} type="file" accept="video/*" onChange={handleFileUpload} className="hidden" />
    </div>
  )
}
