import { useEffect, useRef, useState } from 'react'
import { defaultAutoplay } from '../../../lib/appSettings.js'
import { renderHalftone, FIELD_OPTIONS, LAYOUT_OPTIONS, SHAPE_OPTIONS, PALETTES } from './engine.js'
import { resolveDeep, treeReferencesAudio } from '../../../lib/exprParam.js'
import { isAudioEnabled, subscribeAudio } from '../../../lib/audioSource.js'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../../_shared/exportSpecs.js'
import { useImage } from '../../radar/state/ImageContext.jsx'
import MediaPicker from '../../../components/framework/MediaPicker.jsx'
import SourcePlaceholder from '../../radar/components/SourcePlaceholder.jsx'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import RailVariantNav from '../../../components/framework/RailVariantNav.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import Section from '../../../components/molecules/Section.jsx'
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Button from '../../../components/atoms/Button.jsx'
import ColorField from '../../../components/color/ColorField.jsx'
import ReliefOrbit from '../_shared/reliefOrbit.js'
import CameraControls, { RELIEF_DEFAULTS } from '../_shared/CameraControls.jsx'

const BASE = 1200
const LUMA_N = 256

function sampleLuma(img, n) {
  const c = document.createElement('canvas')
  c.width = n; c.height = n
  const ctx = c.getContext('2d')
  ctx.drawImage(img, 0, 0, n, n)
  const d = ctx.getImageData(0, 0, n, n).data
  const out = new Float32Array(n * n)
  for (let i = 0; i < n * n; i++) {
    const j = i << 2
    out[i] = (0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2]) / 255
  }
  return { data: out, w: n, h: n }
}

// Optic · Halftone — gradient-mapped dot/bead field. The board's #1 signature.
// Two faces share this engine (split deliberately into separate pages/groups):
//   mode="filter"    → "Bitmap" (Halftone group, /optic): a photo's luma drives
//                      the field; source-required.
//   mode="generator" → "Halftone" (Pattern group, /optic/halftone): pure
//                      parametric field, no source.
export function HalftoneInner({ mode = 'filter' }) {
  const isFilter = mode === 'filter'
  const { sourceImage, isVideo, loadImageFromFile, loadImageFromUrl, clearImage } = useImage()
  const canvasRef = useRef(null)
  const glRef = useRef(null)
  const reliefRef = useRef(null)
  const timeRef = useRef(0)
  const lumaRef = useRef(null)
  const sourceImageRef = useRef(null)
  const isVideoRef = useRef(false)
  sourceImageRef.current = sourceImage
  isVideoRef.current = isVideo

  const [field, setField] = useState('radial')
  const [layout, setLayout] = useState('hex')
  const [shape, setShape] = useState('dot')
  const [density, setDensity] = useState(34)
  const [dotScale, setDotScale] = useState(1)
  const [fieldScale, setFieldScale] = useState(1)
  const [contrast, setContrast] = useState(1)
  const [rotate, setRotate] = useState(0)
  const [palette, setPalette] = useState('drekker')
  const [invert, setInvert] = useState(false)
  const [bgColor, setBgColor] = useState('#06070b')
  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [footTab, setFootTab] = useState('transport')
  const [audioActive, setAudioActive] = useState(isAudioEnabled())
  const [photoBlend, setPhotoBlend] = useState(100)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [tab, setTab] = useState('effect') // Effect | Motion rail tabs
  const [spin, setSpin] = useState(0) // field rotation rate (deg per motion-clock unit)
  const [dragging, setDragging] = useState(false)
  const [cam, setCam] = useState(RELIEF_DEFAULTS)
  const updateCam = (k, v) => setCam((p) => ({ ...p, [k]: v }))
  const camRef = useRef(cam)
  camRef.current = cam
  const fileRef = useRef(null)
  useEffect(() => subscribeAudio(setAudioActive), [])

  // Source change: sample luma once for images (filter only).
  // For video, luma is resampled per-frame in the rAF loop.
  useEffect(() => {
    if (!isFilter || !sourceImage) { lumaRef.current = null; return }
    if (!isVideo) lumaRef.current = sampleLuma(sourceImage, LUMA_N)
  }, [isFilter, sourceImage, isVideo])

  // The footer transport owns video playback (filter only — the generator has no
  // source): play/pause toggles the clip and tempo latches its playbackRate.
  useEffect(() => {
    if (isFilter && isVideo && sourceImage) {
      sourceImage.playbackRate = tempo / 120
      if (playing) { const pr = sourceImage.play(); if (pr && pr.catch) pr.catch(() => {}) } else sourceImage.pause()
    }
  }, [isFilter, playing, tempo, isVideo, sourceImage])

  const bg = bgColor
  const params = { field, layout, shape, density, dotScale, fieldScale, contrast, rotate, palette, bg, invert, photoBlend: photoBlend / 100 }

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const r = ratioFor(aspect) || 1
    const w = r >= 1 ? BASE : Math.round(BASE * r)
    const h = r >= 1 ? Math.round(BASE / r) : BASE
    cv.width = w
    cv.height = h
    if (reliefRef.current) reliefRef.current.resize(w, h)

    const render = () => {
      if (isFilter && isVideoRef.current && sourceImageRef.current) {
        lumaRef.current = sampleLuma(sourceImageRef.current, LUMA_N)
      }
      const dyn = spin ? { ...params, rotate: rotate + timeRef.current * spin } : params
      renderHalftone(cv, resolveDeep(dyn, timeRef.current), timeRef.current, isFilter ? lumaRef.current : null)
      // 3D relief: the just-rendered 2D canvas is the texture for the orbit layer.
      if (camRef.current.on && reliefRef.current) {
        reliefRef.current.setParams(camRef.current)
        reliefRef.current.setSource(cv)
        reliefRef.current.frame(timeRef.current)
      }
    }

    const audioLive = audioActive && treeReferencesAudio(params)
    const videoActive = isFilter && isVideoRef.current
    if (!playing && !audioLive && !videoActive && !cam.on) { render(); return }
    let alive = true
    let raf
    let last = performance.now()
    const loop = (now) => {
      if (!alive) return
      const dt = (now - last) / 1000
      last = now
      if (playing) timeRef.current += dt * (tempo / 120)
      render()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(raf) }
  }, [field, layout, shape, density, dotScale, fieldScale, contrast, rotate, spin, palette, bg, invert, photoBlend, playing, tempo, aspect, audioActive, isFilter, sourceImage, cam.on]) // eslint-disable-line react-hooks/exhaustive-deps

  // Relief-orbit display layer — mounted only while 3D is on; the page's rAF loop
  // drives it (setSource/frame) so the transport clock pauses/resets the motion.
  useEffect(() => {
    if (!cam.on || !glRef.current || !canvasRef.current) return
    const eng = new ReliefOrbit(glRef.current)
    reliefRef.current = eng
    eng.resize(canvasRef.current.width, canvasRef.current.height)
    eng.setSource(canvasRef.current)
    return () => { eng.dispose(); reliefRef.current = null }
  }, [cam.on, sourceImage]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveBlob = (blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kol-halftone-${Date.now()}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPng = () => {
    // 3D relief on → export the WebGL view as-is (no @Nx retarget, like Scan).
    if (cam.on && reliefRef.current) {
      reliefRef.current.exportBlob().then(saveBlob)
      return
    }
    const dd = dimsFor(aspect, Number(scale)) || { w: canvasRef.current.width, h: canvasRef.current.height }
    const out = document.createElement('canvas')
    out.width = dd.w
    out.height = dd.h
    renderHalftone(out, resolveDeep(params, timeRef.current), timeRef.current, isFilter ? lumaRef.current : null)
    out.toBlob(saveBlob, 'image/png')
  }

  const getSettings = () => ({ field, layout, shape, density, dotScale, fieldScale, contrast, rotate, spin, palette, invert, bgColor, photoBlend, aspect, scale })
  const applySettings = (s) => {
    for (const [k, v] of Object.entries(s)) {
      ({ field: setField, layout: setLayout, shape: setShape, density: setDensity, dotScale: setDotScale, fieldScale: setFieldScale, contrast: setContrast, rotate: setRotate, spin: setSpin, palette: setPalette, invert: setInvert, bgColor: setBgColor, photoBlend: setPhotoBlend, aspect: setAspect, scale: setScale }[k]?.(v))
    }
  }

  // Drag-and-drop a source onto the stage (filter only — same as Dither/ASCII).
  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = (e) => { e.preventDefault(); setDragging(false) }
  const handleDrop = (e) => { e.preventDefault(); setDragging(false); loadImageFromFile(e.dataTransfer.files?.[0]) }

  // Source upload panel — File tab override (filter only). Omitting it lets the
  // generator's File tab fall back to settings Save/Load (settingsPage).
  const filePanel = isFilter ? (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button variant="primary" size="sm" className="flex-1" onClick={() => fileRef.current?.click()}>Upload</Button>
        <Button variant="primary" size="sm" className="flex-1" onClick={() => setPickerOpen(true)}>Library</Button>
      </div>
      {sourceImage && (
        <Button variant="secondary" size="sm" className="w-full" onClick={clearImage}>Clear</Button>
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
        {isFilter && !sourceImage ? (
          <div
            className="flex border border-dashed overflow-hidden"
            style={{
              aspectRatio: ratioFor(aspect) || 4 / 5,
              width: `min(100%, calc(85vh * ${ratioFor(aspect) || 4 / 5}))`,
              borderRadius: 'var(--kol-radius-sm)',
              borderColor: dragging ? 'var(--kol-accent-primary)' : 'var(--kol-border-default)',
              backgroundColor: dragging ? 'color-mix(in srgb, var(--kol-accent-primary) 8%, var(--kol-fg-04))' : 'var(--kol-fg-04)',
              transition: 'border-color 0.2s, background-color 0.2s',
            }}
          >
            <SourcePlaceholder onUpload={() => fileRef.current?.click()} />
          </div>
        ) : (
          <>
            <canvas data-vcap={cam.on ? undefined : 'stage'} ref={canvasRef} className={`max-w-full max-h-[90vh] object-contain${isFilter ? '' : ' rounded'}${cam.on ? ' hidden' : ''}`} />
            {cam.on && <canvas data-vcap="stage" ref={glRef} className={`max-w-full max-h-[90vh] object-contain${isFilter ? '' : ' rounded'}`} />}
          </>
        )}
      </div>

      <EditorRail
        footerBare
        header={
          <>
            <RailHeader>{isFilter ? <RailVariantNav group="halftone" /> : 'Halftone'}</RailHeader>
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
              onStop: () => { setPlaying(false); timeRef.current = 0; if (isFilter && isVideo && sourceImage) sourceImage.currentTime = 0 },
              onRewind: () => { timeRef.current = 0; if (isFilter && isVideo && sourceImage) sourceImage.currentTime = 0 },
              tempo,
              onTempo: setTempo,
              tempoMax: 300,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: VIEW_ASPECTS, scale, onScale: setScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
            settingsPage={isFilter ? 'optic-halftone' : 'optic-halftone-gen'}
            getSettings={getSettings}
            applySettings={applySettings}
            file={filePanel}
          />
        }
      >
        {tab === 'effect' && (<>
        {isFilter && sourceImage && (
          <Section label="Effect">
            <Slider labeled label="Amount" min={0} max={100} step={1} value={photoBlend} onChange={setPhotoBlend} variant="default" noExpr />
          </Section>
        )}

        <Section label="Field">
          <Dropdown size="sm" options={FIELD_OPTIONS} value={field} onChange={setField} variant="subtle" className="w-full" />
          <Slider labeled label="Field Scale" min={0.2} max={4} step={0.05} value={fieldScale} onChange={setFieldScale} variant="default" />
          <Slider labeled label="Contrast" min={0.3} max={4} step={0.05} value={contrast} onChange={setContrast} variant="default" />
          <Slider labeled label="Rotate" min={0} max={360} step={1} value={rotate} onChange={setRotate} variant="default" />
        </Section>

        <Section label="Grid">
          <SegmentedToggle options={LAYOUT_OPTIONS} value={layout} onChange={setLayout} className="w-full" />
          <Slider labeled label="Density" min={4} max={80} step={1} value={density} onChange={setDensity} variant="default" noExpr />
        </Section>

        <Section label="Cell">
          <SegmentedToggle options={SHAPE_OPTIONS} value={shape} onChange={setShape} className="w-full" />
          <Slider labeled label="Dot Scale" min={0.2} max={2} step={0.05} value={dotScale} onChange={setDotScale} variant="default" />
          <ToggleSwitch labeled variant="plain" label="Invert" checked={invert} onChange={setInvert} />
        </Section>

        <Section label="Color">
          <Dropdown size="sm" options={PALETTES.map((p) => ({ value: p.value, label: p.label }))} value={palette} onChange={setPalette} variant="subtle" className="w-full" />
          <ColorField labeled label="Background" value={bgColor} onChange={setBgColor} />
        </Section>
        </>)}

        {tab === 'motion' && (<>
        <Section label="Motion">
          <Slider labeled label="Spin" min={-360} max={360} step={1} value={spin} onChange={setSpin} variant="default" />
        </Section>
        <CameraControls cam={cam} update={updateCam} />
        </>)}
      </EditorRail>

      {isFilter && (
        <>
          <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={(e) => loadImageFromFile(e.target.files?.[0])} />
          <MediaPicker open={pickerOpen} accept="all" onClose={() => setPickerOpen(false)} onPick={(url, o) => { loadImageFromUrl(url, o?.contentType); setPickerOpen(false) }} />
        </>
      )}
    </div>
  )
}

// Bitmap — the source-driven halftone filter (Halftone group, /optic). Source
// provider comes from OpticPage (one provider for the whole /optic tree).
export default function HalftonePage() {
  return <HalftoneInner mode="filter" />
}
