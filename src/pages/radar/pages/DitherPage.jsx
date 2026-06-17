import { useState, useRef, useEffect, useCallback } from 'react'
import { renderDither, MODE_OPTIONS, SHAPE_OPTIONS, DEFAULT_PARAMS } from '../effects/ditherEngine'
import { makeSweep } from '../effects/sweeps'
import { CANVAS_FX_DEFS, getDefaultCanvasFxParams, applyCanvasFx } from '../hooks/useCanvasFx'
import { EXPORT_SPECS, DEFAULT_EXPORT_SPEC, maxWidthFor } from '../data/exportSpecs'
import Button from '../../../components/atoms/Button.jsx'
import Divider from '../../../components/atoms/Divider.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import Section from '../../../components/molecules/Section.jsx'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import ColorPicker from '../components/ColorPicker'
import SweepControls from '../components/SweepControls'
import { useImage } from '../state/ImageContext'

export default function DitherPage() {
  const { sourceImage, isVideo, loadImageFromFile } = useImage()
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const [effectApplied, setEffectApplied] = useState(false)
  const [params, setParams] = useState({ ...DEFAULT_PARAMS })
  const [dragging, setDragging] = useState(false)
  const [fxChain, setFxChain] = useState([])
  const [sweeps, setSweeps] = useState([])
  const [animating, setAnimating] = useState(false)
  const [motionSpeed, setMotionSpeed] = useState(1)
  const timeRef = useRef(0)
  const [videoPlaying, setVideoPlaying] = useState(true)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const [exporting, setExporting] = useState(false)
  const [exportSpec, setExportSpec] = useState(DEFAULT_EXPORT_SPEC)

  // Draw raw image to canvas
  const drawRawImage = useCallback(() => {
    if (!canvasRef.current || !sourceImage) return
    const ctx = canvasRef.current.getContext('2d')
    const maxDisplay = 1600
    const aspect = sourceImage.width / sourceImage.height
    let dw = sourceImage.width
    let dh = sourceImage.height
    if (dw > maxDisplay) { dw = maxDisplay; dh = dw / aspect }
    canvasRef.current.width = dw
    canvasRef.current.height = dh
    ctx.drawImage(sourceImage, 0, 0, dw, dh)
  }, [sourceImage])

  // When a source loads, drop back to the raw view
  useEffect(() => {
    setEffectApplied(false)
    setVideoPlaying(isVideo)
    timeRef.current = 0
  }, [sourceImage, isVideo])

  // Render: stills draw once per state change; video (or an Animate'd still
  // with sweeps) runs a per-frame loop — requestVideoFrameCallback paces video,
  // rAF drives still-animation. Animated frames process at a capped width
  // (per-frame getImageData at full res is the cliff); the snapshot stays full.
  const animated = isVideo || (animating && effectApplied)
  useEffect(() => {
    if (!sourceImage || !canvasRef.current) return
    const draw = () => {
      if (!canvasRef.current) return
      if (effectApplied) {
        const p = { ...params, sweeps, time: timeRef.current * motionSpeed, ...(animated ? { maxDisplay: 960 } : {}) }
        renderDither(canvasRef.current, sourceImage, p)
        if (fxChain.length > 0) applyCanvasFx(canvasRef.current, fxChain)
      } else {
        drawRawImage()
      }
    }
    if (!animated) { draw(); return }
    let alive = true
    let handle
    let last = performance.now()
    const loop = (now) => {
      if (!alive) return
      const ts = now ?? performance.now()
      timeRef.current += (ts - last) / 1000
      last = ts
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
  }, [params, sweeps, motionSpeed, animated, fxChain, effectApplied, sourceImage, isVideo, drawRawImage])

  const updateParam = (key, value) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }

  // The render effect above reacts to effectApplied — these are pure state flips.
  const handleApplyEffect = () => {
    if (!sourceImage) return
    setEffectApplied(true)
  }

  const handleRemoveEffect = () => setEffectApplied(false)

  const toggleVideo = () => {
    if (!isVideo || !sourceImage) return
    if (sourceImage.paused) { void sourceImage.play(); setVideoPlaying(true) }
    else { sourceImage.pause(); setVideoPlaying(false) }
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

  // Re-render to an offscreen canvas at the chosen output standard (crisp at
  // any size) rather than scaling the display canvas.
  const handleDownload = () => {
    if (!sourceImage) return
    const maxWidth = maxWidthFor(exportSpec)
    const out = document.createElement('canvas')
    if (effectApplied) {
      renderDither(out, sourceImage, { ...params, sweeps, time: timeRef.current * motionSpeed, maxDisplay: maxWidth })
      if (fxChain.length > 0) applyCanvasFx(out, fxChain)
    } else {
      const aspect = sourceImage.width / sourceImage.height
      let dw = sourceImage.width
      let dh = sourceImage.height
      if (dw > maxWidth) { dw = maxWidth; dh = Math.round(dw / aspect) }
      out.width = dw
      out.height = dh
      out.getContext('2d').drawImage(sourceImage, 0, 0, dw, dh)
    }
    const link = document.createElement('a')
    link.download = `kol-radar-${Date.now()}.png`
    link.href = out.toDataURL()
    link.click()
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
    if (sourceImage) setEffectApplied(true)
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
  const addSweep = () => { setSweeps(prev => [...prev, makeSweep()]); setAnimating(true) }
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
            className="flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-lg cursor-pointer"
            style={{
              width: '80%',
              height: '60vh',
              borderColor: dragging ? 'var(--kol-accent-primary)' : 'var(--kol-border-default)',
              backgroundColor: dragging ? 'color-mix(in srgb, var(--kol-accent-primary) 5%, transparent)' : 'transparent',
              transition: 'border-color 0.2s, background-color 0.2s',
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="kol-mono-12 text-fg-32 uppercase">
              {dragging ? 'Drop image here' : 'Drag image here or click to upload'}
            </span>
          </div>
        ) : (
          <canvas ref={canvasRef} className="max-w-full max-h-[90vh] object-contain" />
        )}
      </div>

      {/* Controls panel */}
      <EditorRail>
        <RailHeader>kol-radar</RailHeader>

        <Section label="Mode">
          <Dropdown size="sm" options={MODE_OPTIONS} value={params.mode} onChange={(v) => updateParam('mode', v)} variant="subtle" className="w-full" />
        </Section>

        <Section label="Shape">
          <Dropdown size="sm" options={SHAPE_OPTIONS} value={params.shape} onChange={(v) => updateParam('shape', v)} variant="subtle" className="w-full" />
          <Button variant="primary" size="sm" iconLeft="cycle" onClick={randomize} className="w-full">Randomize</Button>
        </Section>

        <Divider />

        <Section label="Dither">
          <Slider label="Cell Size" min={4} max={40} step={1} value={params.cellSize} onChange={(v) => updateParam('cellSize', v)} variant="default" />
          <Slider label="Scale" min={0.1} max={3} step={0.025} value={params.baseScale} onChange={(v) => updateParam('baseScale', v)} variant="default" />
          <Slider label="Gap" min={0} max={20} step={0.25} value={params.gap} onChange={(v) => updateParam('gap', v)} variant="default" />
          <Slider label="Contrast" min={-100} max={100} step={1} value={params.contrast} onChange={(v) => updateParam('contrast', v)} variant="default" />
          <Slider label="Intensity" min={0} max={5} step={0.05} value={params.intensity} onChange={(v) => updateParam('intensity', v)} variant="default" />
        </Section>

        <Divider />

        <Section label="Color">
          <ToggleSwitch variant="plain" label="Original Color" checked={params.useColor} onChange={(v) => updateParam('useColor', v)} />

          {!params.useColor && (
            <div className="flex items-center justify-between">
              <span className="kol-helper-10 uppercase text-fg-32">Foreground</span>
              <ColorPicker color={params.monoColor} onChange={(v) => updateParam('monoColor', v)} />
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="kol-helper-10 uppercase text-fg-32">Background</span>
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
                <ToggleSwitch label={def.label} checked={fx.enabled} onChange={() => toggleFx(i)} />
                <Button variant="ghost" size="sm" quiet iconOnly="cross" iconSize={12} className="ml-auto" aria-label="Remove effect" onClick={() => removeFx(i)} />
              </div>
              {fx.enabled && Object.entries(def.params).map(([key, spec]) => (
                <Slider
                  key={key}
                  label={key}
                  min={spec.min}
                  max={spec.max}
                  step={spec.step}
                  value={fx.params[key]}
                  onChange={(v) => updateFxParam(i, key, v)}
                  variant="default"
                />
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

        <Divider />

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

        <Divider />

        <Section label="Output">
          <Dropdown size="sm" options={EXPORT_SPECS} value={exportSpec} onChange={setExportSpec} variant="subtle" className="w-full" />
        </Section>

        <Divider />

        {/* Actions */}
        {sourceImage && !effectApplied && (
          <Button variant="accent" size="sm" onClick={handleApplyEffect} className="w-full">
            Apply Effect
          </Button>
        )}

        {sourceImage && effectApplied && (
          <Button variant="primary" size="sm" onClick={handleRemoveEffect} className="w-full">
            Remove Effect
          </Button>
        )}

        <Button variant="primary" size="sm" onClick={() => fileInputRef.current?.click()} iconLeft="upload" className="w-full">
          Upload Image
        </Button>

        <Button variant="primary" size="sm" onClick={() => videoInputRef.current?.click()} iconLeft="video" className="w-full">
          Upload Video
        </Button>

        {isVideo && sourceImage && (
          <Button variant="primary" size="sm" onClick={toggleVideo} iconLeft={videoPlaying ? 'pause' : 'play'} className="w-full">
            {videoPlaying ? 'Pause Video' : 'Play Video'}
          </Button>
        )}

        {sourceImage && (
          <Button variant="primary" size="sm" onClick={handleDownload} iconLeft="download" className="w-full">
            Download
          </Button>
        )}

        {sourceImage && (isVideo || (animating && effectApplied)) && (
          <Button variant={exporting ? 'accent' : 'primary'} size="sm" onClick={toggleExport} iconLeft={exporting ? 'control-stop' : 'video'} className="w-full">
            {exporting ? 'Stop Export' : 'Export Video'}
          </Button>
        )}
      </EditorRail>

      <input ref={fileInputRef} type="file" accept="image/*,.svg" onChange={handleFileUpload} className="hidden" />
      <input ref={videoInputRef} type="file" accept="video/*" onChange={handleFileUpload} className="hidden" />
    </div>
  )
}
