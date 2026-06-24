import { useEffect, useRef, useState } from 'react'
import { defaultAutoplay } from '../../lib/appSettings.js'
import { ASPECT_SPECS, defaultAspectFor, DEFAULT_SCALE, ratioFor, dimsFor } from '../_shared/exportSpecs.js'
import { ImageProvider, useImage } from '../radar/state/ImageContext.jsx'
import { renderGlass, PATTERN_OPTIONS } from './engine/displace.js'
import { FALLBACK, PRESETS, presetById, FRAME_PRESETS, FORM_PRESETS, randomizeGlass } from './registry.js'
import PresetGrid from './PresetGrid.jsx'
import SourcePlaceholder from '../radar/components/SourcePlaceholder.jsx'
import MediaPicker from '../../components/framework/MediaPicker.jsx'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import EditorFooter from '../../components/framework/EditorFooter.jsx'
import Section from '../../components/molecules/Section.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../components/atoms/ToggleSwitch.jsx'
import Button from '../../components/atoms/Button.jsx'

const BASE = 1000
const EDGE_OPTIONS = [
  { value: 'clamp', label: 'Clamp' },
  { value: 'wrap', label: 'Wrap' },
  { value: 'mirror', label: 'Mirror' },
]
const pick = (a) => a[Math.floor(Math.random() * a.length)]

// Glass — displacement-map filter on the generator archetype: a curated preset
// grid (Generate), the full param surface (Style), and Frame/Form motion
// (Animation). Source-driven; the footer owns transport / output / upload.
function GlassInner() {
  const { sourceImage, isVideo, loadImageFromFile, loadImageFromUrl, clearImage } = useImage()
  const canvasRef = useRef(null)
  const timeRef = useRef(0)
  const srcRef = useRef(null); srcRef.current = sourceImage
  const isVideoRef = useRef(false); isVideoRef.current = isVideo

  // Look (Style) — seeded from the fallback (the hero Vertical Panes).
  const [pattern, setPattern] = useState(FALLBACK.pattern)
  const [xShift, setXShift] = useState(FALLBACK.xShift)
  const [yShift, setYShift] = useState(FALLBACK.yShift)
  const [scale, setScale] = useState(FALLBACK.scale)
  const [angle, setAngle] = useState(FALLBACK.angle)
  const [chroma, setChroma] = useState(FALLBACK.chroma)
  const [mix, setMix] = useState(FALLBACK.mix)
  const [edge, setEdge] = useState(FALLBACK.edge)
  const [mirror, setMirror] = useState(FALLBACK.mirror)
  const [preset, setPreset] = useState('panes')

  // Frame (whole sheet moves) + Form (pattern animates in place) — defaults static.
  const [framePreset, setFramePreset] = useState('static')
  const [panSpeedX, setPanSpeedX] = useState(0)
  const [panSpeedY, setPanSpeedY] = useState(0)
  const [spin, setSpin] = useState(0)
  const [formPreset, setFormPreset] = useState('static')
  const [phase, setPhase] = useState(0)
  const [pulse, setPulse] = useState(0)

  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120)
  const [aspect, setAspect] = useState(() => defaultAspectFor('source'))
  const [expScale, setExpScale] = useState(DEFAULT_SCALE)
  const [footTab, setFootTab] = useState('transport')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [tab, setTab] = useState('generate')
  const [animTab, setAnimTab] = useState('frame')
  const fileRef = useRef(null)

  // The footer transport owns video playback; tempo latches playbackRate.
  useEffect(() => {
    if (isVideo && sourceImage) {
      sourceImage.playbackRate = tempo / 120
      if (playing) { const pr = sourceImage.play(); if (pr && pr.catch) pr.catch(() => {}) } else sourceImage.pause()
    }
  }, [playing, tempo, isVideo, sourceImage])

  const look = { pattern, xShift, yShift, scale, angle, chroma, mix, edge, mirror }
  const srcRatio = sourceImage ? (sourceImage.width / sourceImage.height) : 4 / 5

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv || !sourceImage) return
    const r = ratioFor(aspect) ?? srcRatio
    cv.width = r >= 1 ? BASE : Math.round(BASE * r)
    cv.height = r >= 1 ? Math.round(BASE / r) : BASE

    // Resolve motion against the clock: Frame pans/spins the sheet, Form drives
    // the internal phase + an amplitude pulse. All zero ⇒ render-identical.
    const render = (ss) => {
      const t = timeRef.current
      const amp = 1 + pulse * 0.4 * Math.sin(t * 3)
      renderGlass(cv, srcRef.current, {
        ...look,
        angle: angle + spin * t,
        panX: panSpeedX * t,
        panY: panSpeedY * t,
        xShift: xShift * amp,
        yShift: yShift * amp,
        time: t * phase,
        ss,
      })
    }

    const hasMotion = spin !== 0 || panSpeedX !== 0 || panSpeedY !== 0 || phase !== 0 || pulse !== 0
    const live = isVideoRef.current ? playing : (playing && hasMotion)
    if (!live) { render(2); return } // ss=2 anti-aliases the static frame + export
    let alive = true, raf, last = performance.now()
    const loop = (now) => {
      if (!alive) return
      const dt = (now - last) / 1000; last = now
      timeRef.current += dt * (tempo / 120)
      render(1) // ss=1 for frame-rate while animating
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(raf) }
  }, [pattern, xShift, yShift, scale, angle, chroma, mix, edge, mirror, panSpeedX, panSpeedY, spin, phase, pulse, playing, tempo, aspect, sourceImage]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveBlob = (blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `kol-glass-${Date.now()}.png`; a.click()
    URL.revokeObjectURL(url)
  }
  const exportPng = () => {
    const dd = dimsFor(aspect, Number(expScale)) || { w: sourceImage.width, h: sourceImage.height }
    const out = document.createElement('canvas')
    out.width = dd.w; out.height = dd.h
    const t = timeRef.current
    const amp = 1 + pulse * 0.4 * Math.sin(t * 3)
    renderGlass(out, sourceImage, { ...look, angle: angle + spin * t, panX: panSpeedX * t, panY: panSpeedY * t, xShift: xShift * amp, yShift: yShift * amp, time: t * phase, ss: 2 })
    out.toBlob(saveBlob, 'image/png')
  }

  const getSettings = () => ({ pattern, xShift, yShift, scale, angle, chroma, mix, edge, mirror, preset, framePreset, panSpeedX, panSpeedY, spin, formPreset, phase, pulse, aspect, expScale })
  const SETTERS = {
    pattern: setPattern, xShift: setXShift, yShift: setYShift, scale: setScale, angle: setAngle,
    chroma: setChroma, mix: setMix, edge: setEdge, mirror: setMirror, preset: setPreset,
    framePreset: setFramePreset, panSpeedX: setPanSpeedX, panSpeedY: setPanSpeedY, spin: setSpin,
    formPreset: setFormPreset, phase: setPhase, pulse: setPulse, aspect: setAspect, expScale: setExpScale,
  }
  const applyPatch = (patch) => { for (const [k, v] of Object.entries(patch)) SETTERS[k]?.(v) }
  const applySettings = applyPatch

  // Preset select applies the full look; editing any Style control flips → Custom.
  const applyPreset = (id) => { if (id === 'custom') return; setPreset(id); const p = presetById(id); if (p) applyPatch(p.params) }
  const onLook = (setter) => (v) => { setter(v); setPreset('custom') }
  // Generate — look-only randomize (motion untouched), preset → Custom, tempo→120.
  const randomize = (section) => { applyPatch(randomizeGlass(section)); setPreset('custom'); setTempo(120) }

  // Frame/Form preset dropdowns: apply only that axis; editing a slider → Custom.
  const applyFramePreset = (id) => { setFramePreset(id); const p = FRAME_PRESETS.find((x) => x.id === id); if (p?.params) applyPatch(p.params) }
  const applyFormPreset = (id) => { setFormPreset(id); const p = FORM_PRESETS.find((x) => x.id === id); if (p?.params) applyPatch(p.params) }
  const onFrame = (setter) => (v) => { setter(v); setFramePreset('custom') }
  const onForm = (setter) => (v) => { setter(v); setFormPreset('custom') }
  const rerollMotion = () => { applyFramePreset(pick(FRAME_PRESETS.slice(1)).id); applyFormPreset(pick(FORM_PRESETS.slice(1)).id) }
  // 'Custom' shows in a list only while active, so it never reads as a second 'off'.
  const opts = (presets, val) => {
    const o = presets.map((p) => ({ value: p.id, label: p.label }))
    return (val == null || val === 'custom') ? [{ value: 'custom', label: 'Custom' }, ...o] : o
  }

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = (e) => { e.preventDefault(); setDragging(false) }
  const handleDrop = (e) => { e.preventDefault(); setDragging(false); loadImageFromFile(e.dataTransfer.files?.[0]) }

  return (
    <div className="min-h-dvh bg-surface-secondary flex">
      <div
        className="flex-1 flex items-center justify-center p-4 overflow-hidden"
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
      >
        {!sourceImage ? (
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
          <canvas data-vcap="stage" ref={canvasRef} className="max-w-full max-h-[90vh] object-contain" />
        )}
      </div>

      <EditorRail
        footerBare
        header={
          <>
            <RailHeader>Glass</RailHeader>
            <SegmentedToggle
              value={tab}
              onChange={setTab}
              options={[{ value: 'generate', label: 'Generate' }, { value: 'style', label: 'Style' }, { value: 'animation', label: 'Animation' }]}
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
              onStop: () => { setPlaying(false); timeRef.current = 0; if (isVideo && sourceImage) sourceImage.currentTime = 0 },
              onRewind: () => { timeRef.current = 0; if (isVideo && sourceImage) sourceImage.currentTime = 0 },
              tempo, onTempo: setTempo, tempoMax: 300,
            }}
            exportProps={{ aspect, onAspect: setAspect, aspects: ASPECT_SPECS, scale: expScale, onScale: setExpScale }}
            exportActions={<Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>}
            settingsPage="glass"
            getSettings={getSettings}
            applySettings={applySettings}
            file={
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" className="flex-1" onClick={() => fileRef.current?.click()}>Upload</Button>
                  <Button variant="primary" size="sm" className="flex-1" onClick={() => setPickerOpen(true)}>Library</Button>
                </div>
                {sourceImage && <Button variant="primary" size="sm" className="w-full" onClick={clearImage}>Clear</Button>}
              </div>
            }
          />
        }
      >
        {/* Preset — always visible above the tabs (quick switch from any tab). */}
        <Section label="Preset">
          <Dropdown size="sm" variant="subtle" className="w-full" options={opts(PRESETS, preset)} value={preset} onChange={applyPreset} />
        </Section>

        {tab === 'generate' && (<>
          <Section label="Looks">
            <PresetGrid source={sourceImage} value={preset} onChange={applyPreset} />
            <div className="kol-helper-10 opacity-60">{presetById(preset)?.label || 'Custom'}</div>
          </Section>
          <Section label="Generate">
            <Button variant="primary" size="sm" className="w-full" iconLeft="cycle" onClick={() => randomize('all')}>Randomize all</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" size="sm" onClick={() => randomize('pattern')}>Pattern</Button>
              <Button variant="primary" size="sm" onClick={() => randomize('displace')}>Displace</Button>
              <Button variant="primary" size="sm" onClick={() => randomize('glass')}>Glass</Button>
              <Button variant="primary" size="sm" onClick={rerollMotion}>Motion</Button>
            </div>
          </Section>
        </>)}

        {tab === 'style' && (<>
          <Section label="Pattern">
            <Dropdown size="sm" variant="subtle" className="w-full" options={PATTERN_OPTIONS} value={pattern} onChange={onLook(setPattern)} />
          </Section>
          <Section label="Displace">
            <Slider labeled label="X Shift" min={-100} max={100} step={1} value={xShift} onChange={onLook(setXShift)} variant="default" center noExpr />
            <Slider labeled label="Y Shift" min={-100} max={100} step={1} value={yShift} onChange={onLook(setYShift)} variant="default" center noExpr />
            <Slider labeled label="Scale" min={0.2} max={4} step={0.05} value={scale} onChange={onLook(setScale)} variant="default" noExpr />
            <Slider labeled label="Angle" min={0} max={360} step={1} value={angle} onChange={onLook(setAngle)} variant="default" noExpr />
            <Slider labeled label="Mix" min={0} max={100} step={1} value={mix} onChange={onLook(setMix)} variant="default" noExpr />
          </Section>
          <Section label="Glass">
            <Slider labeled label="Chroma" min={0} max={100} step={1} value={chroma} onChange={onLook(setChroma)} variant="default" noExpr />
            <Dropdown size="sm" variant="subtle" className="w-full" options={EDGE_OPTIONS} value={edge} onChange={onLook(setEdge)} />
            <ToggleSwitch labeled variant="plain" label="Mirror" checked={mirror} onChange={onLook(setMirror)} />
          </Section>
        </>)}

        {tab === 'animation' && (<>
          <Section label="Motion">
            <LabeledControl inline label="Frame">
              <Dropdown size="sm" variant="subtle" className="w-full" openUp options={opts(FRAME_PRESETS, framePreset)} value={framePreset} onChange={applyFramePreset} />
            </LabeledControl>
            <LabeledControl inline label="Form">
              <Dropdown size="sm" variant="subtle" className="w-full" openUp options={opts(FORM_PRESETS, formPreset)} value={formPreset} onChange={applyFormPreset} />
            </LabeledControl>
          </Section>
          <SegmentedToggle value={animTab} onChange={setAnimTab} className="w-full" options={[{ value: 'frame', label: 'Frame' }, { value: 'form', label: 'Form' }]} />
          {animTab === 'frame' && (
            <Section label="Frame">
              <Slider labeled label="Pan X" min={-0.4} max={0.4} step={0.01} value={panSpeedX} onChange={onFrame(setPanSpeedX)} variant="default" center noExpr />
              <Slider labeled label="Pan Y" min={-0.4} max={0.4} step={0.01} value={panSpeedY} onChange={onFrame(setPanSpeedY)} variant="default" center noExpr />
              <Slider labeled label="Spin" min={-60} max={60} step={1} value={spin} onChange={onFrame(setSpin)} variant="default" center noExpr />
            </Section>
          )}
          {animTab === 'form' && (
            <Section label="Form">
              <Slider labeled label="Phase" min={0} max={4} step={0.05} value={phase} onChange={onForm(setPhase)} variant="default" noExpr />
              <Slider labeled label="Pulse" min={0} max={1} step={0.05} value={pulse} onChange={onForm(setPulse)} variant="default" noExpr />
            </Section>
          )}
        </>)}
      </EditorRail>

      <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={(e) => loadImageFromFile(e.target.files?.[0])} />
      <MediaPicker open={pickerOpen} accept="all" onClose={() => setPickerOpen(false)} onPick={(url, o) => { loadImageFromUrl(url, o?.contentType); setPickerOpen(false) }} />
    </div>
  )
}

export default function GlassPage() {
  return <ImageProvider><GlassInner /></ImageProvider>
}
