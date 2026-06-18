import { useState, useRef, useEffect, useCallback } from 'react'
import { renderAscii, ALGORITHM_OPTIONS, CHARSET_OPTIONS, DEFAULT_ASCII_PARAMS } from '../effects/asciiEngine'
import { makeSweep } from '../effects/sweeps'
import { ASPECT_SPECS, SOURCE_DEFAULT as DEFAULT_ASPECT, DEFAULT_SCALE, dimsFor } from '../../_shared/exportSpecs.js'
import ExportPanel from '../../_shared/ExportPanel.jsx'
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'
import ButtonGroup from '../../../components/molecules/ButtonGroup.jsx'
import { fitSourceToFrame } from '../utils/fitFrame'
import Button from '../../../components/atoms/Button.jsx'
import Divider from '../../../components/atoms/Divider.jsx'
import Input from '../../../components/atoms/Input.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import Section from '../../../components/molecules/Section.jsx'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import TransportBar from '../../../components/framework/TransportBar.jsx'
import ColorPicker from '../components/ColorPicker'
import SweepControls from '../components/SweepControls'
import VideoTransport from '../components/VideoTransport'
import { useImage } from '../state/ImageContext'

export default function AsciiPage() {
  const { sourceImage, isVideo, loadImageFromFile } = useImage()
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const [effectApplied, setEffectApplied] = useState(false)
  const [params, setParams] = useState({ ...DEFAULT_ASCII_PARAMS })
  const [dragging, setDragging] = useState(false)
  const [sweeps, setSweeps] = useState([])
  const [animating, setAnimating] = useState(false)
  const [motionSpeed, setMotionSpeed] = useState(1)
  const [playing, setPlaying] = useState(true)
  const timeRef = useRef(0)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const [exporting, setExporting] = useState(false)
  const [exportAspect, setExportAspect] = useState(DEFAULT_ASPECT)
  const [exportScale, setExportScale] = useState(DEFAULT_SCALE)
  const [tab, setTab] = useState('effect') // Effect | Motion | Output rail tabs
  const [exportFit, setExportFit] = useState('cover')

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
    timeRef.current = 0
  }, [sourceImage, isVideo])

  // Render: stills draw once; video (or an Animate'd still with sweeps) runs a
  // per-frame loop at a capped processing width (same pattern as DitherPage).
  const animated = isVideo || (animating && effectApplied)
  useEffect(() => {
    if (!sourceImage || !canvasRef.current) return
    const draw = () => {
      if (!canvasRef.current) return
      if (effectApplied) {
        const p = { ...params, sweeps, time: timeRef.current * motionSpeed, ...(animated ? { maxDisplay: 960 } : {}) }
        renderAscii(canvasRef.current, sourceImage, p)
      } else drawRawImage()
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
  }, [params, sweeps, motionSpeed, animated, effectApplied, sourceImage, isVideo, drawRawImage, playing])

  // Transport play/pause also drives the source video.
  useEffect(() => {
    if (isVideo && sourceImage) {
      if (playing) { const pr = sourceImage.play(); if (pr && pr.catch) pr.catch(() => {}) } else sourceImage.pause()
    }
  }, [playing, isVideo, sourceImage])

  const updateParam = (key, value) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }

  // Sweeps (time-driven motion). Adding the first one auto-enables Animate.
  const addSweep = (preset) => { setSweeps(prev => [...prev, makeSweep(preset?.shape, preset)]); setAnimating(true) }
  const removeSweep = (index) => setSweeps(prev => prev.filter((_, i) => i !== index))
  const updateSweep = (index, key, value) => {
    setSweeps(prev => prev.map((sw, i) => i === index ? { ...sw, [key]: value } : sw))
  }

  const handleApplyEffect = () => {
    if (!sourceImage) return
    setEffectApplied(true)
  }

  const handleRemoveEffect = () => setEffectApplied(false)

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
      link.download = `kol-radar-ascii-${Date.now()}.webm`
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
    // 'source' → native res, source aspect; otherwise crop/fit into the target
    // aspect frame and render the effect across it.
    const dims = dimsFor(exportAspect, Number(exportScale))
    const src = dims ? fitSourceToFrame(sourceImage, dims.w, dims.h, exportFit, params.bgColor) : sourceImage
    const out = document.createElement('canvas')
    if (effectApplied) {
      renderAscii(out, src, { ...params, sweeps, time: timeRef.current * motionSpeed, maxDisplay: dims ? dims.w : Infinity })
    } else if (dims) {
      out.width = dims.w
      out.height = dims.h
      out.getContext('2d').drawImage(src, 0, 0)
    } else {
      out.width = sourceImage.width
      out.height = sourceImage.height
      out.getContext('2d').drawImage(sourceImage, 0, 0)
    }
    const link = document.createElement('a')
    link.download = `kol-radar-ascii-${Date.now()}.png`
    link.href = out.toDataURL()
    link.click()
  }

  const randomize = () => {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
    setParams(prev => ({
      ...prev,
      algorithm: pick(ALGORITHM_OPTIONS).value,
      charset: pick(CHARSET_OPTIONS).value,
      invert: Math.random() < 0.25,
      glyphScale: Math.round((0.7 + Math.random() * 0.9) * 20) / 20,
      cellSize: 5 + Math.floor(Math.random() * 20),
      contrast: Math.floor(Math.random() * 80) - 20,
    }))
    if (sourceImage) setEffectApplied(true)
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

        {isVideo && sourceImage && <VideoTransport video={sourceImage} />}

        <SegmentedToggle
          value={tab}
          onChange={setTab}
          options={[{ value: 'effect', label: 'Effect' }, { value: 'motion', label: 'Motion' }, { value: 'output', label: 'Output' }]}
        />

        {/* Scrolls: the active tab's controls. Transport (below) stays pinned. */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5">
        {tab === 'effect' && (<>
        <Section label="Algorithm">
          <Dropdown size="sm" options={ALGORITHM_OPTIONS} value={params.algorithm} onChange={(v) => updateParam('algorithm', v)} variant="subtle" className="w-full" />
          {params.algorithm === 'density' && (
            <Dropdown
              size="sm"
              options={CHARSET_OPTIONS.map((c) => ({ value: c.value, label: c.label }))}
              value={params.charset}
              onChange={(v) => updateParam('charset', v)}
              variant="subtle"
              className="w-full"
            />
          )}
          <Button variant="primary" size="sm" iconLeft="cycle" onClick={randomize} className="w-full">Randomize</Button>
        </Section>

        <Section label="Characters">
          {params.algorithm === 'custom' && (
            <Input
              size="sm"
              width="100%"
              value={params.ramp}
              onChange={(e) => updateParam('ramp', e.target.value)}
              placeholder=" .:-=+*#%@"
            />
          )}
          <ToggleSwitch variant="plain" label="Invert" checked={params.invert} onChange={(v) => updateParam('invert', v)} />
          <Slider label="Glyph Scale" min={0.5} max={2} step={0.05} value={params.glyphScale} onChange={(v) => updateParam('glyphScale', v)} variant="default" />
        </Section>

        <Divider />

        <Section label="Cells">
          <Slider label="Cell Size" min={4} max={40} step={1} value={params.cellSize} onChange={(v) => updateParam('cellSize', v)} variant="default" />
          <Slider label="Contrast" min={-100} max={100} step={1} value={params.contrast} onChange={(v) => updateParam('contrast', v)} variant="default" />
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

        {tab === 'output' && (<>
        <ExportPanel
          aspect={exportAspect}
          onAspect={setExportAspect}
          aspects={ASPECT_SPECS}
          scale={exportScale}
          onScale={setExportScale}
          fit={exportFit}
          onFit={setExportFit}
        />

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

        <ButtonGroup orientation="vertical" className="w-full">
          <Button variant="primary" size="sm" onClick={() => fileInputRef.current?.click()} iconLeft="upload" className="w-full">
            Upload Image
          </Button>
          <Button variant="primary" size="sm" onClick={() => videoInputRef.current?.click()} iconLeft="video" className="w-full">
            Upload Video
          </Button>
        </ButtonGroup>

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
        </>)}
        </div>

        {/* Fixed: transport — play/pause the motion + video, Tempo = motion speed. */}
        <div className="border-t border-fg-08 pt-3">
          <TransportBar
            playing={playing}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onStop={() => { setPlaying(false); timeRef.current = 0 }}
            onRewind={() => { timeRef.current = 0 }}
            tempo={Math.round(motionSpeed * 120)}
            onTempo={(v) => setMotionSpeed(v / 120)}
            tempoMax={300}
          />
        </div>
      </EditorRail>

      <input ref={fileInputRef} type="file" accept="image/*,.svg" onChange={handleFileUpload} className="hidden" />
      <input ref={videoInputRef} type="file" accept="video/*" onChange={handleFileUpload} className="hidden" />
    </div>
  )
}
