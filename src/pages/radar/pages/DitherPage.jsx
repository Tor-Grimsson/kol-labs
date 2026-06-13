import { useState, useRef, useEffect, useCallback } from 'react'
import { renderDither, MODE_OPTIONS, SHAPE_OPTIONS, DEFAULT_PARAMS } from '../effects/ditherEngine'
import { CANVAS_FX_DEFS, getDefaultCanvasFxParams, applyCanvasFx } from '../hooks/useCanvasFx'
import Button from '../../../components/atoms/Button.jsx'
import Divider from '../../../components/atoms/Divider.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import Section from '../../../components/molecules/Section.jsx'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import ColorPicker from '../components/ColorPicker'
import EffectSwitcher from '../components/EffectSwitcher'
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
  const [videoPlaying, setVideoPlaying] = useState(true)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const [exporting, setExporting] = useState(false)

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
  }, [sourceImage, isVideo])

  // Render: images draw once per state change; video runs a per-frame loop
  // (requestVideoFrameCallback paces to the video, rAF as fallback) at a
  // capped processing width — per-frame getImageData at full res is the cliff.
  useEffect(() => {
    if (!sourceImage || !canvasRef.current) return
    const draw = () => {
      if (!canvasRef.current) return
      if (effectApplied) {
        renderDither(canvasRef.current, sourceImage, isVideo ? { ...params, maxDisplay: 960 } : params)
        if (fxChain.length > 0) applyCanvasFx(canvasRef.current, fxChain)
      } else {
        drawRawImage()
      }
    }
    if (!isVideo) { draw(); return }
    let alive = true
    let handle
    const loop = () => {
      if (!alive) return
      draw()
      handle = sourceImage.requestVideoFrameCallback
        ? sourceImage.requestVideoFrameCallback(loop)
        : requestAnimationFrame(loop)
    }
    loop()
    return () => {
      alive = false
      if (handle == null) return
      if (sourceImage.cancelVideoFrameCallback) sourceImage.cancelVideoFrameCallback(handle)
      else cancelAnimationFrame(handle)
    }
  }, [params, fxChain, effectApplied, sourceImage, isVideo, drawRawImage])

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

  const handleDownload = () => {
    if (!canvasRef.current) return
    const link = document.createElement('a')
    link.download = `kol-radar-${Date.now()}.png`
    link.href = canvasRef.current.toDataURL()
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

  return (
    <div className="min-h-dvh bg-surface-primary flex">
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
            <span className="kol-helper-12 text-fg-32 uppercase">
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
        <EffectSwitcher />

        <Divider />

        <Section label="Mode">
          <Dropdown size="sm" options={MODE_OPTIONS} value={params.mode} onChange={(v) => updateParam('mode', v)} variant="subtle" className="w-full" />
        </Section>

        <Section label="Shape">
          <Dropdown size="sm" options={SHAPE_OPTIONS} value={params.shape} onChange={(v) => updateParam('shape', v)} variant="subtle" className="w-full" />
          <Button variant="ghost" size="sm" onClick={randomize}>Randomize</Button>
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
          <ToggleSwitch label="Original Color" checked={params.useColor} onChange={(v) => updateParam('useColor', v)} />

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
                <button onClick={() => removeFx(i)} className="kol-helper-10 text-fg-32 hover:text-fg-64 ml-auto">x</button>
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

        {/* Actions */}
        {sourceImage && !effectApplied && (
          <Button variant="accent" size="sm" onClick={handleApplyEffect} className="w-full">
            Apply Effect
          </Button>
        )}

        {sourceImage && effectApplied && (
          <Button variant="outline" size="sm" onClick={handleRemoveEffect} className="w-full">
            Remove Effect
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} iconLeft="upload" className="w-full">
          Upload Image
        </Button>

        <Button variant="outline" size="sm" onClick={() => videoInputRef.current?.click()} iconLeft="video" className="w-full">
          Upload Video
        </Button>

        {isVideo && sourceImage && (
          <Button variant="outline" size="sm" onClick={toggleVideo} iconLeft={videoPlaying ? 'pause' : 'play'} className="w-full">
            {videoPlaying ? 'Pause Video' : 'Play Video'}
          </Button>
        )}

        {sourceImage && (
          <Button variant="primary" size="sm" onClick={handleDownload} iconLeft="download" className="w-full">
            Download
          </Button>
        )}

        {isVideo && sourceImage && (
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
