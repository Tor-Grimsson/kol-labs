import { useEffect, useRef, useState } from 'react'
import { defaultAutoplay } from '../../../lib/appSettings.js'
import Button from '../../../components/atoms/Button.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import Section from '../../../components/molecules/Section.jsx'
import SourcePlaceholder from '../components/SourcePlaceholder.jsx'
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'
import ButtonGroup from '../../../components/molecules/ButtonGroup.jsx'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import { usePublishShortcuts, usePublishReset } from '../../../components/framework/pageShortcuts.jsx'
import { LiveClock } from '../../../lib/liveClock.jsx'
import LibrarySourceButton from '../components/LibrarySourceButton.jsx'
import { useImage } from '../state/ImageContext'
import DistortionEngine from '../effects/distortion/distortionEngine'

const DEFAULTS = { strength: 0.25, radius: 0.18, decay: 0.94, rgbShift: 0.03 }

export default function DistortPage() {
  const { sourceImage, loadImageFromFile } = useImage()
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const fileInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const engineRef = useRef(null)
  // Motion = the recorded cursor track (keyframes), replayable. Distinct from
  // the video export below.
  const motionRef = useRef([])
  const recordStartRef = useRef(0)
  const playRafRef = useRef(null)
  // Video export = render the canvas output to a webm file.
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const [dragging, setDragging] = useState(false)
  const [recording, setRecording] = useState(false)
  const [playing, setPlaying] = useState(false) // motion REPLAY (user-triggered, gated on hasMotion) — not the transport
  const [exporting, setExporting] = useState(false)
  const [hasMotion, setHasMotion] = useState(false)
  const [params, setParams] = useState(DEFAULTS)
  const [paused, setPaused] = useState(() => !defaultAutoplay()) // the live transport — seeds from the global autoplay setting
  const [tempo, setTempo] = useState(120)
  const [footTab, setFootTab] = useState('transport') // Transport | Output | File footer toggle

  usePublishReset(() => setParams(DEFAULTS))
  usePublishShortcuts('Chromatic', [
    ['Move cursor', 'distort the image'],
    ['Record', 'capture the cursor motion as keyframes'],
    ['Play', 'loop the recorded motion hands-free'],
    ['Export Video', 'render the canvas to a webm'],
  ])

  // Engine lifecycle — created once for this page, disposed on unmount.
  useEffect(() => {
    if (!canvasRef.current || !wrapRef.current) return
    const engine = new DistortionEngine(canvasRef.current)
    engineRef.current = engine
    engine.setParams(DEFAULTS)
    engine.resize(wrapRef.current.clientWidth, wrapRef.current.clientHeight)
    engine.start()

    const ro = new ResizeObserver(() => {
      const el = wrapRef.current
      if (el) engine.resize(el.clientWidth, el.clientHeight)
    })
    ro.observe(wrapRef.current)

    return () => {
      ro.disconnect()
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  // Feed the shared image in whenever it changes (or when the engine just mounted).
  useEffect(() => {
    if (sourceImage && engineRef.current) engineRef.current.setImage(sourceImage)
  }, [sourceImage])

  useEffect(() => {
    engineRef.current?.setParams(params)
  }, [params])

  useEffect(() => { engineRef.current?.setPaused(paused) }, [paused])
  useEffect(() => { engineRef.current?.setTimeScale(tempo / 120) }, [tempo])

  const update = (key, value) => setParams((p) => ({ ...p, [key]: value }))

  const handlePointerMove = (e) => {
    if (playing) return // playback owns the pointer while a motion replays
    const el = wrapRef.current
    if (!el || !engineRef.current) return
    const rect = el.getBoundingClientRect()
    const u = (e.clientX - rect.left) / rect.width
    const v = 1 - (e.clientY - rect.top) / rect.height // GL uv origin is bottom-left
    engineRef.current.setPointer(u, v)
    if (recording) {
      motionRef.current.push({ t: performance.now() - recordStartRef.current, u, v })
    }
  }

  const handleFileUpload = (e) => loadImageFromFile(e.target.files[0])
  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = (e) => { e.preventDefault(); setDragging(false) }
  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    loadImageFromFile(e.dataTransfer.files[0])
  }

  const stopPlayback = () => {
    if (playRafRef.current) cancelAnimationFrame(playRafRef.current)
    playRafRef.current = null
    setPlaying(false)
  }

  // Record / stop the cursor MOTION (a timestamped keyframe track), not video.
  const toggleRecord = () => {
    if (recording) {
      setRecording(false)
      setHasMotion(motionRef.current.length > 1)
      return
    }
    stopPlayback()
    motionRef.current = []
    recordStartRef.current = performance.now()
    setHasMotion(false)
    setRecording(true)
  }

  // Replay the recorded motion on a loop, driving the effect hands-free.
  const togglePlay = () => {
    if (playing) { stopPlayback(); return }
    const track = motionRef.current
    if (track.length < 2) return
    const duration = track[track.length - 1].t || 1
    const start = performance.now()
    setPlaying(true)
    const loop = () => {
      playRafRef.current = requestAnimationFrame(loop)
      const elapsed = (performance.now() - start) % duration
      let i = 1
      while (i < track.length && track[i].t < elapsed) i += 1
      const a = track[i - 1]
      const b = track[Math.min(i, track.length - 1)]
      const span = (b.t - a.t) || 1
      const k = Math.min(1, Math.max(0, (elapsed - a.t) / span))
      engineRef.current?.setPointer(a.u + (b.u - a.u) * k, a.v + (b.v - a.v) * k)
    }
    playRafRef.current = requestAnimationFrame(loop)
  }

  // Export VIDEO — render the canvas output to a webm (use while playing a
  // motion to bake it to a file). Separate concept from recording motion.
  const toggleExport = () => {
    if (exporting) { recorderRef.current?.stop(); return }
    const canvas = canvasRef.current
    if (!canvas) return
    const stream = canvas.captureStream(60)
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm'
    const rec = new MediaRecorder(stream, { mimeType: mime })
    chunksRef.current = []
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      const link = document.createElement('a')
      link.download = `kol-radar-distort-${Date.now()}.webm`
      link.href = URL.createObjectURL(blob)
      link.click()
      URL.revokeObjectURL(link.href)
      setExporting(false)
    }
    rec.start()
    recorderRef.current = rec
    setExporting(true)
  }

  // Stop any running playback / export if the page unmounts.
  useEffect(() => () => {
    if (playRafRef.current) cancelAnimationFrame(playRafRef.current)
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }, [])

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      {/* Canvas / drop area */}
      <div
        ref={wrapRef}
        className="flex-1 relative overflow-hidden bg-surface-secondary"
        onPointerMove={handlePointerMove}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <canvas data-vcap="stage" ref={canvasRef} className="block h-full w-full" />
        {!sourceImage && (
          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="flex items-center justify-center border border-dashed rounded pointer-events-auto"
              style={{
                width: '80%',
                height: '60vh',
                borderColor: dragging ? 'var(--kol-accent-primary)' : 'var(--kol-border-default)',
              }}
            >
              <SourcePlaceholder onUpload={() => fileInputRef.current?.click()} />
            </div>
          </div>
        )}
      </div>

      {/* Controls panel */}
      <LiveClock getT={() => engineRef.current?.time}>
      <EditorRail
        footerBare
        header={<RailHeader>Chromatic</RailHeader>}
        footer={
          <EditorFooter
            tab={footTab}
            onTab={setFootTab}
            transport={{
              playing: !paused,
              onPlay: () => setPaused(false),
              onPause: () => setPaused(true),
              onStop: () => { setPaused(true); engineRef.current?.clearTrail() },
              onRewind: () => engineRef.current?.clearTrail(),
              tempo,
              onTempo: setTempo,
              tempoMax: 300,
            }}
            output={sourceImage ? (
              <>
                <div className="flex gap-2">
                  <Button variant={recording ? 'accent' : 'primary'} size="sm" onClick={toggleRecord} iconLeft={recording ? 'control-stop' : 'circle'} className="flex-1">{recording ? 'Stop' : 'Record'}</Button>
                  <Button variant={playing ? 'accent' : 'primary'} size="sm" onClick={togglePlay} iconLeft={playing ? 'control-stop' : 'control-play'} className="flex-1" disabled={!hasMotion}>{playing ? 'Stop' : 'Play'}</Button>
                </div>
                <Button variant={exporting ? 'accent' : 'primary'} size="sm" onClick={toggleExport} iconLeft={exporting ? 'control-stop' : 'video'} className="w-full">{exporting ? 'Stop Export' : 'Export Video'}</Button>
              </>
            ) : (
              <p className="kol-mono-10 text-fg-32">Load a source to record motion and export.</p>
            )}
            file={
              <ButtonGroup orientation="vertical" className="w-full">
                <Button variant="primary" size="sm" onClick={() => fileInputRef.current?.click()} iconLeft="upload" className="w-full">Upload Image</Button>
                <Button variant="primary" size="sm" onClick={() => videoInputRef.current?.click()} iconLeft="video" className="w-full">Upload Video</Button>
                <LibrarySourceButton />
              </ButtonGroup>
            }
          />
        }
      >
        <Section label="Chromatic Aberration">
          <Slider labeled label="Strength" min={0} max={0.6} step={0.005} value={params.strength} onChange={(v) => update('strength', v)} variant="default" />
          <Slider labeled label="Radius" min={0.02} max={0.5} step={0.005} value={params.radius} onChange={(v) => update('radius', v)} variant="default" />
          <Slider labeled label="Trail Decay" min={0.8} max={0.99} step={0.005} value={params.decay} onChange={(v) => update('decay', v)} variant="default" />
          <Slider labeled label="RGB Shift" min={0} max={0.1} step={0.002} value={params.rgbShift} onChange={(v) => update('rgbShift', v)} variant="default" />
        </Section>
      </EditorRail>
      </LiveClock>

      <input ref={fileInputRef} type="file" accept="image/*,.svg" onChange={handleFileUpload} className="hidden" />
      <input ref={videoInputRef} type="file" accept="video/*" onChange={handleFileUpload} className="hidden" />
    </div>
  )
}
