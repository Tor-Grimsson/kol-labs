import { useEffect, useRef, useState } from 'react'
import { defaultAutoplay } from '../../../lib/appSettings.js'
import { useImage } from '../state/ImageContext'
import SourcePlaceholder from '../components/SourcePlaceholder.jsx'
import LibrarySourceButton from '../components/LibrarySourceButton.jsx'
import { RefractEngine } from './engine.js'
import { SURFACE2D_BY_ID } from './surfaces2d.js'
import { resolveDeep } from '../../../lib/exprParam.js'
import { ASPECT_SPECS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../../_shared/exportSpecs.js'
import ImagePlacement from '../../_shared/ImagePlacement.jsx'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import Section from '../../../components/molecules/Section.jsx'
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'
import ButtonGroup from '../../../components/molecules/ButtonGroup.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import Button from '../../../components/atoms/Button.jsx'
import ColorField from '../../../components/color/ColorField.jsx'

// Optic · Lens (2D) — a flat refraction shader: the photo, plain, with a discrete
// glass OBJECT composited over it (panel/lens). Distance bends + colour-splits the
// photo inside the glass. The 3D Scene category is the depth-true sibling.
export default function Lens2DShell({ surface = 'glass', title = 'Glass' }) {
  const surf = SURFACE2D_BY_ID[surface] || SURFACE2D_BY_ID.glass
  const { sourceImage, loadImageFromFile, clearImage } = useImage()
  const containerRef = useRef(null)
  const engineRef = useRef(null)
  const fileInputRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [footTab, setFootTab] = useState('transport')
  const [playing, setPlaying] = useState(() => defaultAutoplay())

  // the glass OBJECT (layer 2)
  const [shape, setShape] = useState('panel')
  const [size, setSize] = useState(0.34)
  const [radius, setRadius] = useState(0.08)
  const [edge, setEdge] = useState(0.025)
  const [glassX, setGlassX] = useState(0.5)
  const [glassY, setGlassY] = useState(0.5)
  const [magnify, setMagnify] = useState(0.22)
  // surface
  const [detail, setDetail] = useState(0.4)
  const [reflect, setReflect] = useState(surf.reflect)
  // refraction
  const [distance, setDistance] = useState(40)
  const [chromatic, setChromatic] = useState(8)
  const [frost, setFrost] = useState(0)
  // image placement (layer 1)
  const [fit, setFit] = useState('cover')
  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [bg, setBg] = useState('#06070b')
  // finish
  const [sheen, setSheen] = useState(0.5)
  const [lightAngle, setLightAngle] = useState(45)
  const [tint, setTint] = useState('#ffffff')
  const [tintAmt, setTintAmt] = useState(0)
  // transport / export
  const [flow, setFlow] = useState(1)
  const [aspect, setAspect] = useState(() => defaultAspectFor('source'))
  const [expScale, setExpScale] = useState(DEFAULT_SCALE)
  const [imgAspect, setImgAspect] = useState(null)

  const picked = ratioFor(aspect)
  const r = picked ?? imgAspect ?? 4 / 5

  useEffect(() => {
    const engine = new RefractEngine()
    engineRef.current = engine
    let disposed = false
    engine.init(containerRef.current).then(() => { if (!disposed) setReady(true) })
    return () => { disposed = true; engine.destroy(); engineRef.current = null }
  }, [])

  useEffect(() => { setReflect(surf.reflect) }, [surface]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (ready) engineRef.current?.setSource(sourceImage) }, [ready, sourceImage])
  useEffect(() => {
    if (!sourceImage) { setImgAspect(null); return }
    const w = sourceImage.naturalWidth || sourceImage.videoWidth || sourceImage.width || 1
    const h = sourceImage.naturalHeight || sourceImage.videoHeight || sourceImage.height || 1
    setImgAspect(w / h)
  }, [sourceImage])

  // Non-numeric params (enums + colours) → push on change; the numeric ones are
  // resolved each frame below so they can be expression / audio bound.
  useEffect(() => { engineRef.current?.setParams({ type: surface, shape, fit, bg, tint }) }, [surface, shape, fit, bg, tint])
  useEffect(() => { engineRef.current?.setPlaying(playing) }, [playing])

  // Per-frame resolve of the numeric params (all cheap uniform sets in setParams)
  // against the engine clock + live audio, so `dispersion`/`size`/… animate.
  const cfg = useRef({})
  cfg.current = { detail, reflect, distance, chromatic, frost, size, radius, edge, magnify, glassX, glassY, zoom, offsetX, offsetY, sheen, lightAngle, tintAmt, flow }
  useEffect(() => {
    if (!ready) return
    let alive = true
    let raf
    const loop = () => {
      if (!alive) return
      const engine = engineRef.current
      if (engine) {
        const c = cfg.current
        engine.setParams(resolveDeep({
          scale: c.detail, reflect: c.reflect, depth: c.distance, chromatic: c.chromatic, frost: c.frost,
          size: c.size, radius: c.radius, edge: c.edge, magnify: c.magnify, glassX: c.glassX, glassY: c.glassY,
          zoom: c.zoom, offsetX: c.offsetX, offsetY: c.offsetY, sheen: c.sheen, lightAngle: c.lightAngle,
          tintAmt: c.tintAmt, flow: c.flow,
        }, engine.getTime?.() ?? 0))
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(raf) }
  }, [ready])

  const handleFileUpload = (e) => loadImageFromFile(e.target.files[0])
  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = (e) => { e.preventDefault(); setDragging(false) }
  const handleDrop = (e) => { e.preventDefault(); setDragging(false); loadImageFromFile(e.dataTransfer.files[0]) }
  const resetImage = () => { setFit('cover'); setZoom(1); setOffsetX(0); setOffsetY(0) }

  const handleDownload = async () => {
    const dd = picked ? dimsFor(aspect, Number(expScale)) : null
    const blob = await engineRef.current?.exportBlob(dd?.w, dd?.h)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kol-${surface}-${Date.now()}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div
        className="relative flex-1 flex items-center justify-center p-4 overflow-hidden"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          className="relative overflow-hidden rounded"
          style={{ aspectRatio: r, width: `min(100%, calc(90vh * ${r}))`, maxHeight: '90vh' }}
        >
          <div data-vcap="stage" ref={containerRef} className="absolute inset-0" />
          {!sourceImage && (
            <div
              className="absolute inset-0 flex items-center justify-center border border-dashed rounded"
              style={{ borderColor: dragging ? 'var(--kol-accent-primary)' : 'var(--kol-border-default)' }}
            >
              <SourcePlaceholder onUpload={() => fileInputRef.current?.click()} />
            </div>
          )}
        </div>
      </div>

      <EditorRail
        footerBare
        header={<RailHeader>{title}</RailHeader>}
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
            exportProps={{ aspect, onAspect: setAspect, aspects: ASPECT_SPECS, scale: expScale, onScale: setExpScale }}
            exportActions={sourceImage
              ? <Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={handleDownload}>Download</Button>
              : <div className="kol-mono-10 text-fg-32">Load a source to export.</div>}
            file={
              <div className="flex flex-col gap-2">
                <ButtonGroup orientation="vertical" className="w-full">
                  <Button variant="primary" size="sm" onClick={() => fileInputRef.current?.click()} iconLeft="upload" className="w-full">Upload image / video</Button>
                  <LibrarySourceButton />
                </ButtonGroup>
                {sourceImage && (
                  <Button variant="secondary" size="sm" onClick={clearImage} iconLeft="cross" className="w-full">Clear source</Button>
                )}
              </div>
            }
          />
        }
      >
        <ImagePlacement
          fit={fit} onFit={setFit}
          zoom={zoom} onZoom={setZoom}
          offsetX={offsetX} onOffsetX={setOffsetX}
          offsetY={offsetY} onOffsetY={setOffsetY}
          bg={bg} onBg={setBg}
          onReset={resetImage}
        />

        <Section label="Glass">
          <SegmentedToggle
            options={[{ value: 'panel', label: 'Panel' }, { value: 'circle', label: 'Lens' }]}
            value={shape}
            onChange={setShape}
            className="w-full"
          />
          <Slider labeled label="Size" min={0.05} max={0.7} step={0.005} value={size} onChange={setSize} variant="default" />
          {shape === 'panel' && <Slider labeled label="Corner" min={0} max={0.3} step={0.005} value={radius} onChange={setRadius} variant="default" />}
          <Slider labeled label="Edge" min={0} max={0.08} step={0.002} value={edge} onChange={setEdge} variant="default" />
          <Slider labeled label="Position X" min={0} max={1} step={0.005} value={glassX} onChange={setGlassX} variant="default" />
          <Slider labeled label="Position Y" min={0} max={1} step={0.005} value={glassY} onChange={setGlassY} variant="default" />
        </Section>

        <Section label="Distance">
          <Slider labeled label="Distance" min={0} max={120} step={1} value={distance} onChange={setDistance} variant="default" />
          <Slider labeled label="Magnify" min={0} max={1} step={0.01} value={magnify} onChange={setMagnify} variant="default" />
          <Slider labeled label="Chromatic" min={0} max={40} step={1} value={chromatic} onChange={setChromatic} variant="default" />
          <Slider labeled label="Frost" min={0} max={20} step={0.5} value={frost} onChange={setFrost} variant="default" />
        </Section>

        <Section label="Surface">
          <Slider labeled label="Detail" min={0} max={1} step={0.01} value={detail} onChange={setDetail} variant="default" />
          <Slider labeled label="Reflection" min={0} max={1.5} step={0.05} value={reflect} onChange={setReflect} variant="default" />
        </Section>

        <Section label="Finish">
          <Slider labeled label="Sheen" min={0} max={1.5} step={0.05} value={sheen} onChange={setSheen} variant="default" />
          <Slider labeled label="Light angle" min={0} max={360} step={1} value={lightAngle} onChange={setLightAngle} variant="default" />
          <ColorField label="Tint" value={tint} onChange={setTint} />
          <Slider labeled label="Tint amount" min={0} max={1} step={0.01} value={tintAmt} onChange={setTintAmt} variant="default" />
        </Section>

        <div className="kol-helper-10 text-body">flat refraction · glass object over the photo</div>
      </EditorRail>

      <input ref={fileInputRef} type="file" accept="image/*,video/*,.svg" onChange={handleFileUpload} className="hidden" />
    </div>
  )
}
