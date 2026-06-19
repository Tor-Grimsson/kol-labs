import { useEffect, useRef, useState } from 'react'
import { useImage } from '../state/ImageContext'
import SourcePlaceholder from '../components/SourcePlaceholder.jsx'
import LibrarySourceButton from '../components/LibrarySourceButton.jsx'
import { RefractEngine } from './engine.js'
import { DISTORTERS } from './distorters.js'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import Section from '../../../components/molecules/Section.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import ButtonGroup from '../../../components/molecules/ButtonGroup.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import Button from '../../../components/atoms/Button.jsx'

// Radar · Refract — a photo behind a procedural glass/ice/mirror/ripple
// distorter. DEPTH drives how far the surface bends + RGB-splits the image
// (the effect.app / Unicorn parallax feel); the surface flows for the fluid
// look. v1 = DisplacementFilter (scale=depth) + RGBSplit + KawaseBlur on one
// persistent pixi app. Shares Radar's ImageProvider (upload once).
export default function RefractPage() {
  const { sourceImage, loadImageFromFile, clearImage } = useImage()
  const containerRef = useRef(null)
  const engineRef = useRef(null)
  const fileInputRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [footTab, setFootTab] = useState('transport')
  const [playing, setPlaying] = useState(true)
  const [type, setType] = useState('glass')
  const [scale, setScale] = useState(0.4)
  const [depth, setDepth] = useState(30)
  const [chromatic, setChromatic] = useState(6)
  const [frost, setFrost] = useState(0)
  const [sheen, setSheen] = useState(0.5)
  const [flow, setFlow] = useState(1)

  // One engine for the page's life.
  useEffect(() => {
    const engine = new RefractEngine()
    engineRef.current = engine
    let disposed = false
    engine.init(containerRef.current).then(() => { if (!disposed) setReady(true) })
    return () => { disposed = true; engine.destroy(); engineRef.current = null }
  }, [])

  useEffect(() => { if (ready) engineRef.current?.setSource(sourceImage) }, [ready, sourceImage])
  useEffect(() => { engineRef.current?.setParams({ type, scale, depth, chromatic, frost, sheen, flow }) }, [type, scale, depth, chromatic, frost, sheen, flow])
  useEffect(() => { engineRef.current?.setPlaying(playing) }, [playing])

  const handleFileUpload = (e) => loadImageFromFile(e.target.files[0])
  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = (e) => { e.preventDefault(); setDragging(false) }
  const handleDrop = (e) => { e.preventDefault(); setDragging(false); loadImageFromFile(e.dataTransfer.files[0]) }

  const handleDownload = async () => {
    const blob = await engineRef.current?.exportBlob()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kol-refract-${Date.now()}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div
        className="relative flex-1 overflow-hidden"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* pixi canvas mounts here (always present so the engine has a target) */}
        <div ref={containerRef} className="absolute inset-0" />
        {!sourceImage && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div
              className="flex border border-dashed overflow-hidden"
              style={{
                aspectRatio: 4 / 5,
                width: 'min(100%, calc(85vh * 0.8))',
                borderRadius: 'var(--kol-radius-sm)',
                borderColor: dragging ? 'var(--kol-accent-primary)' : 'var(--kol-border-default)',
                backgroundColor: dragging ? 'color-mix(in srgb, var(--kol-accent-primary) 8%, var(--kol-fg-04))' : 'var(--kol-fg-04)',
                transition: 'border-color 0.2s, background-color 0.2s',
              }}
            >
              <SourcePlaceholder onUpload={() => fileInputRef.current?.click()} />
            </div>
          </div>
        )}
      </div>

      <EditorRail
        footerBare
        header={<RailHeader>Refract</RailHeader>}
        footer={
          <EditorFooter
            tab={footTab}
            onTab={setFootTab}
            transport={{
              playing,
              onPlay: () => setPlaying(true),
              onPause: () => setPlaying(false),
              onStop: () => { setPlaying(false); engineRef.current?.resetTime() },
              onRewind: () => engineRef.current?.resetTime(),
              tempo: Math.round(flow * 120),
              onTempo: (v) => setFlow(v / 120),
              tempoMax: 400,
            }}
            output={sourceImage
              ? <Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={handleDownload}>Download</Button>
              : <div className="kol-mono-10 text-fg-32">Load a source to export.</div>}
            file={
              <div className="flex flex-col gap-2">
                <ButtonGroup orientation="vertical" className="w-full">
                  <Button variant="primary" size="sm" onClick={() => fileInputRef.current?.click()} iconLeft="upload" className="w-full">Upload Image</Button>
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
        <Section label="Distorter">
          <Dropdown size="sm" options={DISTORTERS.map((d) => ({ value: d.id, label: d.label }))} value={type} onChange={setType} variant="subtle" className="w-full" />
          <Slider labeled label="Scale" min={0} max={1} step={0.01} value={scale} onChange={setScale} variant="default" />
        </Section>

        <Section label="Refraction">
          <Slider labeled label="Depth" min={0} max={120} step={1} value={depth} onChange={setDepth} variant="default" />
          <Slider labeled label="Chromatic" min={0} max={40} step={1} value={chromatic} onChange={setChromatic} variant="default" />
          <Slider labeled label="Frost" min={0} max={20} step={0.5} value={frost} onChange={setFrost} variant="default" />
          <Slider labeled label="Sheen" min={0} max={1.5} step={0.05} value={sheen} onChange={setSheen} variant="default" />
        </Section>

        <div className="kol-helper-10 text-body">glass refraction · depth = parallax · flowing</div>
      </EditorRail>

      <input ref={fileInputRef} type="file" accept="image/*,.svg" onChange={handleFileUpload} className="hidden" />
    </div>
  )
}
