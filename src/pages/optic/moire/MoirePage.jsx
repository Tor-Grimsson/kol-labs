import { useEffect, useRef, useState } from 'react'
import { defaultAutoplay } from '../../../lib/appSettings.js'
import { renderMoire, GRID_OPTIONS, COMBINE_OPTIONS, MOIRE_PALETTES } from './engine.js'
import { resolveDeep, treeReferencesAudio } from '../../../lib/exprParam.js'
import { isAudioEnabled, subscribeAudio } from '../../../lib/audioSource.js'
import { VIEW_ASPECTS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../../_shared/exportSpecs.js'
import { useImage } from '../../radar/state/ImageContext.jsx'
import MediaPicker from '../../../components/framework/MediaPicker.jsx'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import EditorFooter from '../../../components/framework/EditorFooter.jsx'
import Section from '../../../components/molecules/Section.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../../components/atoms/ToggleSwitch.jsx'
import Button from '../../../components/atoms/Button.jsx'
import ReliefOrbit from '../_shared/reliefOrbit.js'
import CameraControls, { RELIEF_DEFAULTS } from '../_shared/CameraControls.jsx'

const BASE = 820

const DEFAULT_GRIDS = [
  { enabled: true, type: 'lines', freq: 6, angle: 0, speed: 0.05 },
  { enabled: true, type: 'lines', freq: 6, angle: 8, speed: -0.05 },
  { enabled: false, type: 'concentric', freq: 4, angle: 0, speed: 0.03 },
]

function drawCoverFit(ctx, img, w, h) {
  const iw = img.videoWidth || img.naturalWidth || img.width
  const ih = img.videoHeight || img.naturalHeight || img.height
  const s = Math.max(w / iw, h / ih)
  ctx.drawImage(img, (w - iw * s) / 2, (h - ih * s) / 2, iw * s, ih * s)
}

// Optic · Moiré — overlapping grids → interference fringes.
function MoireInner() {
  const { sourceImage, isVideo, loadImageFromFile, loadImageFromUrl, clearImage } = useImage()
  const canvasRef = useRef(null)
  const offRef = useRef(null)
  const glRef = useRef(null)
  const reliefRef = useRef(null)
  const timeRef = useRef(0)
  const sourceImageRef = useRef(null)
  const isVideoRef = useRef(false)
  const amountRef = useRef(80)
  sourceImageRef.current = sourceImage
  isVideoRef.current = isVideo

  const [grids, setGrids] = useState(DEFAULT_GRIDS)
  const [combine, setCombine] = useState('xor')
  const [hardness, setHardness] = useState(0.3)
  const [palette, setPalette] = useState('bw')
  const [invert, setInvert] = useState(false)
  const [amount, setAmount] = useState(80)
  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(() => defaultAspectFor('view'))
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [footTab, setFootTab] = useState('transport')
  const [audioActive, setAudioActive] = useState(isAudioEnabled())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [cam, setCam] = useState(RELIEF_DEFAULTS)
  const updateCam = (k, v) => setCam((p) => ({ ...p, [k]: v }))
  const camRef = useRef(cam)
  camRef.current = cam
  const fileRef = useRef(null)
  useEffect(() => subscribeAudio(setAudioActive), [])
  amountRef.current = amount

  const params = { grids, combine, hardness, palette, invert }
  const updateGrid = (i, key, value) => setGrids((prev) => prev.map((g, idx) => idx === i ? { ...g, [key]: value } : g))

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const r = ratioFor(aspect) || 1
    const w = r >= 1 ? BASE : Math.round(BASE * r)
    const h = r >= 1 ? Math.round(BASE / r) : BASE
    cv.width = w
    cv.height = h
    if (!offRef.current) offRef.current = document.createElement('canvas')
    offRef.current.width = w
    offRef.current.height = h
    if (reliefRef.current) reliefRef.current.resize(w, h)

    const render = () => {
      const src = sourceImageRef.current
      if (src) {
        const ctx = cv.getContext('2d')
        ctx.globalAlpha = 1
        drawCoverFit(ctx, src, cv.width, cv.height)
        renderMoire(offRef.current, resolveDeep(params, timeRef.current), timeRef.current)
        ctx.globalAlpha = amountRef.current / 100
        ctx.drawImage(offRef.current, 0, 0)
        ctx.globalAlpha = 1
      } else {
        renderMoire(cv, resolveDeep(params, timeRef.current), timeRef.current)
      }
      // 3D relief: the just-rendered 2D canvas is the texture for the orbit layer.
      if (camRef.current.on && reliefRef.current) {
        reliefRef.current.setParams(camRef.current)
        reliefRef.current.setSource(cv)
        reliefRef.current.frame(timeRef.current)
      }
    }

    const audioLive = audioActive && treeReferencesAudio(params)
    const videoActive = isVideoRef.current
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
  }, [grids, combine, hardness, palette, invert, playing, tempo, aspect, audioActive, sourceImage, cam.on]) // eslint-disable-line react-hooks/exhaustive-deps

  // Relief-orbit display layer — mounted only while 3D is on; the page's rAF loop
  // drives it (setSource/frame) so the transport clock pauses/resets the motion.
  useEffect(() => {
    if (!cam.on || !glRef.current || !canvasRef.current) return
    const eng = new ReliefOrbit(glRef.current)
    reliefRef.current = eng
    eng.resize(canvasRef.current.width, canvasRef.current.height)
    eng.setSource(canvasRef.current)
    return () => { eng.dispose(); reliefRef.current = null }
  }, [cam.on])

  const saveBlob = (blob, name) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPng = () => {
    // 3D relief on → export the WebGL view as-is (no @Nx retarget, like Scan).
    if (cam.on && reliefRef.current) {
      reliefRef.current.exportBlob().then((blob) => saveBlob(blob, `kol-moire-${Date.now()}.png`))
      return
    }
    const dd = dimsFor(aspect, Number(scale)) || { w: canvasRef.current.width, h: canvasRef.current.height }
    const out = document.createElement('canvas')
    out.width = dd.w
    out.height = dd.h
    const src = sourceImageRef.current
    if (src) {
      const ctx = out.getContext('2d')
      drawCoverFit(ctx, src, dd.w, dd.h)
      const moireOff = document.createElement('canvas')
      moireOff.width = dd.w; moireOff.height = dd.h
      renderMoire(moireOff, resolveDeep(params, timeRef.current), timeRef.current)
      ctx.globalAlpha = amountRef.current / 100
      ctx.drawImage(moireOff, 0, 0)
      ctx.globalAlpha = 1
    } else {
      renderMoire(out, resolveDeep(params, timeRef.current), timeRef.current)
    }
    out.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kol-moire-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  const getSettings = () => ({ grids, combine, hardness, palette, invert, aspect, scale })
  const applySettings = (s) => {
    if (s.grids != null) setGrids(s.grids)
    if (s.combine != null) setCombine(s.combine)
    if (s.hardness != null) setHardness(s.hardness)
    if (s.palette != null) setPalette(s.palette)
    if (s.invert != null) setInvert(s.invert)
    if (s.aspect != null) setAspect(s.aspect)
    if (s.scale != null) setScale(s.scale)
  }

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <canvas data-vcap={cam.on ? undefined : 'stage'} ref={canvasRef} className={`max-w-full max-h-[90vh] object-contain rounded${cam.on ? ' hidden' : ''}`} />
        {cam.on && <canvas data-vcap="stage" ref={glRef} className="max-w-full max-h-[90vh] object-contain rounded" />}
      </div>

      <EditorRail
        footerBare
        header={<RailHeader>Moiré</RailHeader>}
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
            settingsPage="optic-moire"
            getSettings={getSettings}
            applySettings={applySettings}
            file={
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" className="flex-1" onClick={() => fileRef.current?.click()}>Upload</Button>
                  <Button variant="primary" size="sm" className="flex-1" onClick={() => setPickerOpen(true)}>Library</Button>
                </div>
                {sourceImage && (
                  <>
                    <Slider labeled label="Overlay" min={0} max={100} step={1} value={amount} onChange={setAmount} variant="default" noExpr />
                    <Button variant="secondary" size="sm" className="w-full" onClick={clearImage}>Clear</Button>
                  </>
                )}
              </div>
            }
          />
        }
      >
        {grids.map((g, i) => (
          <Section key={i} label={`Grid ${String.fromCharCode(65 + i)}`}>
            <ToggleSwitch variant="plain" label="Enabled" checked={g.enabled} onChange={(v) => updateGrid(i, 'enabled', v)} />
            {g.enabled && (
              <>
                <Dropdown size="sm" options={GRID_OPTIONS} value={g.type} onChange={(v) => updateGrid(i, 'type', v)} variant="subtle" className="w-full" />
                <Slider labeled label="Freq" min={1} max={30} step={0.5} value={g.freq} onChange={(v) => updateGrid(i, 'freq', v)} variant="default" />
                <Slider labeled label="Angle" min={0} max={180} step={1} value={g.angle} onChange={(v) => updateGrid(i, 'angle', v)} variant="default" />
                <Slider labeled label="Drift" min={-0.5} max={0.5} step={0.01} value={g.speed} onChange={(v) => updateGrid(i, 'speed', v)} variant="default" />
              </>
            )}
          </Section>
        ))}

        <Section label="Combine">
          <Dropdown size="sm" options={COMBINE_OPTIONS} value={combine} onChange={setCombine} variant="subtle" className="w-full" />
          <Slider labeled label="Hardness" min={0} max={1} step={0.01} value={hardness} onChange={setHardness} variant="default" />
        </Section>

        <Section label="Color">
          <Dropdown size="sm" options={MOIRE_PALETTES.map((p) => ({ value: p.value, label: p.label }))} value={palette} onChange={setPalette} variant="subtle" className="w-full" />
          <ToggleSwitch variant="plain" label="Invert" checked={invert} onChange={setInvert} />
        </Section>

        <CameraControls cam={cam} update={updateCam} />
      </EditorRail>

      <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={(e) => loadImageFromFile(e.target.files?.[0])} />
      <MediaPicker open={pickerOpen} accept="all" onClose={() => setPickerOpen(false)} onPick={(url, o) => { loadImageFromUrl(url, o?.contentType); setPickerOpen(false) }} />
    </div>
  )
}

export default function MoirePage() {
  return <MoireInner />
}
