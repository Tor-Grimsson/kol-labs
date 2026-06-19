import { useEffect, useRef, useState } from 'react'
import { defaultAutoplay } from '../../../lib/appSettings.js'
import Button from '../../../components/atoms/Button.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import { roundIfNum } from '../../../lib/exprParam.js'
import Section from '../../../components/molecules/Section.jsx'
import ButtonGroup from '../../../components/molecules/ButtonGroup.jsx'
import LibrarySourceButton from '../components/LibrarySourceButton.jsx'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import { LiveClock } from '../../../lib/liveClock.jsx'
import { useImage } from '../state/ImageContext'

/**
 * SynthShell — the shared page shell for the Synth WebGL effects (Trails,
 * Slitscan, Scan, Disco). Owns the stage (canvas + drop/upload), the engine
 * lifecycle, export (PNG + webm), and the bottom-pinned transport (play/pause ·
 * editable Tempo where 120 = realtime · stop/rewind), three-zone like the
 * interfaces / math rails. Each effect page supplies its engine class + a
 * controls render-prop:
 *
 *   <SynthShell engineClass={TrailsEngine} title="Trails" name="trails" defaults={…}>
 *     {(params, update) => <Section label="…"><Slider labeled …/></Section>}
 *   </SynthShell>
 */
export default function SynthShell({ engineClass, title, name, defaults, children }) {
  const { sourceImage, loadImageFromFile } = useImage()
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const fileInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const engineRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [recording, setRecording] = useState(false)
  const [clipLen, setClipLen] = useState(6)
  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [params, setParams] = useState(defaults)
  const [footTab, setFootTab] = useState('transport') // Transport · Output · File

  // Engine lifecycle — created once, disposed on unmount.
  useEffect(() => {
    if (!canvasRef.current || !wrapRef.current) return
    const engine = new engineClass(canvasRef.current)
    engineRef.current = engine
    engine.setParams({ ...defaults, speed: tempo / 240 })
    engine.resize(wrapRef.current.clientWidth, wrapRef.current.clientHeight)
    engine.start()
    const ro = new ResizeObserver(() => {
      const el = wrapRef.current
      if (el) engine.resize(el.clientWidth, el.clientHeight)
    })
    ro.observe(wrapRef.current)
    return () => { ro.disconnect(); engine.dispose(); engineRef.current = null }
  }, [engineClass])

  useEffect(() => {
    if (sourceImage && engineRef.current) {
      engineRef.current.setImage(sourceImage)
      engineRef.current.setPaused(!playing) // a freshly-loaded video autoplays — honour transport state
    }
  }, [sourceImage])
  useEffect(() => { engineRef.current?.setParams(params) }, [params])
  useEffect(() => { engineRef.current?.setParams({ speed: tempo / 240 }) }, [tempo])
  useEffect(() => { engineRef.current?.setPaused(!playing) }, [playing])

  const update = (key, value) => setParams((p) => ({ ...p, [key]: value }))

  const handleFileUpload = (e) => loadImageFromFile(e.target.files[0])
  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = (e) => { e.preventDefault(); setDragging(false) }
  const handleDrop = (e) => { e.preventDefault(); setDragging(false); loadImageFromFile(e.dataTransfer.files[0]) }

  const download = (blob, ext) => {
    if (!blob) return
    const link = document.createElement('a')
    link.download = `kol-radar-${name}-${Date.now()}.${ext}`
    link.href = URL.createObjectURL(blob)
    link.click()
    URL.revokeObjectURL(link.href)
  }
  const exportPng = async () => download(await engineRef.current?.exportPNG(), 'png')
  const exportWebm = async () => {
    if (recording) return
    setRecording(true)
    try { download(await engineRef.current?.recordWebm(clipLen, 30), 'webm') } finally { setRecording(false) }
  }

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div
        ref={wrapRef}
        className="flex-1 relative overflow-hidden bg-surface-secondary"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <canvas ref={canvasRef} data-vcap="stage" className="block h-full w-full" />
        {!sourceImage && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div
              className="flex items-center justify-center border-2 border-dashed rounded-lg cursor-pointer"
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
                {dragging ? 'Drop media here' : 'Drag image or video here, or click to upload'}
              </span>
            </div>
          </div>
        )}
      </div>

      <LiveClock getT={() => engineRef.current?.time}>
      <EditorRail
        footerBare
        header={<RailHeader>{title}</RailHeader>}
        footer={
          <EditorFooter
            tab={footTab}
            onTab={setFootTab}
            // transport — play/pause the animation + source video, Tempo = speed
            transport={{
              playing,
              onPlay: () => setPlaying(true),
              onPause: () => setPlaying(false),
              onStop: () => { setPlaying(false); engineRef.current?.reset() },
              onRewind: () => engineRef.current?.reset(),
              tempo,
              onTempo: setTempo,
              tempoMax: 600,
            }}
            // Output — Synth engines export at canvas resolution (no @Nx frame), so
            // a custom Output panel instead of the aspect×scale ExportPanel.
            output={
              <>
                {sourceImage ? (
                  <Section label="Output">
                    <Slider labeled label="Clip length (s)" min={2} max={20} step={1} value={clipLen} onChange={(v) => setClipLen(roundIfNum(v))} variant="default" />
                    <Button variant="primary" size="sm" onClick={exportPng} iconLeft="download" className="w-full">Export PNG</Button>
                    <Button variant={recording ? 'accent' : 'primary'} size="sm" onClick={exportWebm} iconLeft="video" className="w-full" disabled={recording}>
                      {recording ? 'Recording…' : 'Export webm'}
                    </Button>
                  </Section>
                ) : (
                  <p className="kol-mono-10 text-fg-32">Load an image or video first.</p>
                )}
                <p className="kol-mono-10 text-fg-32">Works on image or video. Export PNG captures the current frame; Export webm records the live canvas for the clip length.</p>
              </>
            }
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
        {children(params, update)}
      </EditorRail>
      </LiveClock>

      <input ref={fileInputRef} type="file" accept="image/*,.svg" onChange={handleFileUpload} className="hidden" />
      <input ref={videoInputRef} type="file" accept="video/*" onChange={handleFileUpload} className="hidden" />
    </div>
  )
}
