import { useState, useRef, useEffect } from 'react'
import { useImage } from '../radar/state/ImageContext'
import SourcePlaceholder from '../radar/components/SourcePlaceholder.jsx'
import LibrarySourceButton from '../radar/components/LibrarySourceButton.jsx'
import SweepControls from '../radar/components/SweepControls.jsx'
import VideoTransport from '../radar/components/VideoTransport.jsx'
import FxParamControl from '../radar/components/FxParamControl.jsx'
import { makeSweep } from '../radar/effects/sweeps.js'
import { fitSourceToFrame } from '../radar/utils/fitFrame'
import { ASPECT_SPECS, dimsFor, ratioFor } from '../_shared/exportSpecs.js'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import EditorFooter from '../../components/framework/EditorFooter.jsx'
import Section from '../../components/molecules/Section.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import ButtonGroup from '../../components/molecules/ButtonGroup.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import ToggleSwitch from '../../components/atoms/ToggleSwitch.jsx'
import Button from '../../components/atoms/Button.jsx'
import Divider from '../../components/atoms/Divider.jsx'
import { effectsByGroup, getEffectDef, getDefaultEffectParams, groupLabel } from './effects.config.js'
import { renderProcessed } from './engine/pipeline.js'

// One category sub-page of /effects. Stack + amount + motion + export settings
// are SHARED (held in the shell, passed down) so they persist as you move
// between categories — only the Add-Effect picker is scoped to `group`. Mirrors
// Radar's Dither: Effect/Motion rail tabs, Transport/Output/File footer, sweeps
// for motion. Canvas + Pixi tiers both render.
export default function EffectsEditor({
  group,
  stack, setStack,
  amount, setAmount,
  sweeps, setSweeps,
  animating, setAnimating,
  motionSpeed, setMotionSpeed,
  playing, setPlaying,
  timeRef,
  exportAspect, setExportAspect,
  exportScale, setExportScale,
  exportFit, setExportFit,
}) {
  const { sourceImage, isVideo, loadImageFromFile, clearImage } = useImage()
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [tab, setTab] = useState('effect') // Effect | Motion rail tabs
  const [footTab, setFootTab] = useState('transport') // Transport | Output | File

  // Animate when it's video, or a still with enabled sweeps + a dialed effect.
  const animated = isVideo || (amount > 0 && animating && sweeps.some((sw) => sw.enabled))

  // Frame the source into the chosen aspect (animated renders cap smaller — the
  // per-pixel sweep blend is the cost), returning the source + draw size.
  const frame = () => {
    const r = ratioFor(exportAspect)
    let src = sourceImage
    if (r) {
      const base = animated ? 900 : 1400
      const fw = r >= 1 ? base : Math.round(base * r)
      const fh = r >= 1 ? Math.round(base / r) : base
      src = fitSourceToFrame(sourceImage, fw, fh, exportFit, '#000000')
    }
    let dw = src.width || 1
    let dh = src.height || 1
    const cap = animated ? 900 : 1600
    if (dw > cap) { dh = Math.round(cap * dh / dw); dw = cap }
    return { src, dw, dh }
  }

  // Stills render once per state change; video / sweep-animated stills run a
  // rAF loop. The `cancelled`/`alive` guards + an in-flight flag keep the async
  // pipeline from painting stale frames or piling up renders.
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv || !sourceImage) return

    if (!animated) {
      let cancelled = false
      const { src, dw, dh } = frame()
      cv.width = dw
      cv.height = dh
      const ctx = cv.getContext('2d')
      ctx.drawImage(src, 0, 0, dw, dh) // show raw immediately (no flash)
      renderProcessed({ src, w: dw, h: dh, stack, amount })
        .then((r) => { if (!cancelled && r) ctx.drawImage(r, 0, 0, dw, dh) })
        .catch((e) => { if (!cancelled) console.error('effects render failed', e) }) // eslint-disable-line no-console
      return () => { cancelled = true }
    }

    let alive = true
    let inFlight = false
    let raf
    let last = performance.now()
    const loop = async (now) => {
      if (!alive) return
      const dt = (now - last) / 1000
      last = now
      if (playing) timeRef.current += dt * motionSpeed // transport pause freezes the clock
      if (!inFlight) {
        inFlight = true
        const { src, dw, dh } = frame()
        if (cv.width !== dw || cv.height !== dh) { cv.width = dw; cv.height = dh }
        try {
          const r = await renderProcessed({ src, w: dw, h: dh, stack, amount, time: timeRef.current, sweeps, animating })
          if (alive && r) cv.getContext('2d').drawImage(r, 0, 0, dw, dh)
        } catch (e) {
          if (alive) console.error('effects render failed', e) // eslint-disable-line no-console
        }
        inFlight = false
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(raf) }
  }, [sourceImage, isVideo, exportAspect, exportFit, stack, amount, animated, sweeps, motionSpeed, playing]) // eslint-disable-line react-hooks/exhaustive-deps

  // Transport play/pause also drives a source video.
  useEffect(() => {
    if (isVideo && sourceImage) {
      if (playing) { const pr = sourceImage.play(); if (pr && pr.catch) pr.catch(() => {}) } else sourceImage.pause()
    }
  }, [playing, isVideo, sourceImage])

  const handleFileUpload = (e) => loadImageFromFile(e.target.files[0])
  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = (e) => { e.preventDefault(); setDragging(false) }
  const handleDrop = (e) => { e.preventDefault(); setDragging(false); loadImageFromFile(e.dataTransfer.files[0]) }

  // Export at the chosen spec with the full stack baked in (current frame).
  const handleDownload = async () => {
    if (!sourceImage) return
    const dims = dimsFor(exportAspect, Number(exportScale))
    const src = dims ? fitSourceToFrame(sourceImage, dims.w, dims.h, exportFit, '#000000') : sourceImage
    const w = dims ? dims.w : (src.width || 1)
    const h = dims ? dims.h : (src.height || 1)
    const result = await renderProcessed({ src, w, h, stack, amount, time: timeRef.current, sweeps, animating })
    const link = document.createElement('a')
    link.download = `kol-effects-${Date.now()}.png`
    link.href = result.toDataURL()
    link.click()
  }

  // Stack ops (shared stack)
  const addEffect = (id) => {
    if (!id) return
    setStack((prev) => [...prev, { type: id, enabled: true, params: getDefaultEffectParams(id) }])
  }
  const removeEffect = (i) => setStack((prev) => prev.filter((_, idx) => idx !== i))
  const toggleEffect = (i) => setStack((prev) => prev.map((fx, idx) => idx === i ? { ...fx, enabled: !fx.enabled } : fx))
  const updateParam = (i, key, value) => setStack((prev) => prev.map((fx, idx) =>
    idx === i ? { ...fx, params: { ...fx.params, [key]: value } } : fx
  ))

  // Sweeps (motion). Adding any auto-enables Animate.
  const addSweep = (preset) => { setSweeps((prev) => [...prev, makeSweep(preset?.shape, preset)]); setAnimating(true) }
  const removeSweep = (i) => setSweeps((prev) => prev.filter((_, idx) => idx !== i))
  const updateSweep = (i, key, value) => setSweeps((prev) => prev.map((sw, idx) => idx === i ? { ...sw, [key]: value } : sw))

  const groupEffects = effectsByGroup.find((g) => g.id === group)?.effects || []
  const addOptions = [
    { value: '', label: 'Add effect…' },
    ...groupEffects.map((d) => ({ value: d.id, label: `${d.label}${d.tier === 'pixi' ? ' · GPU' : ''}` })),
  ]

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
            className="flex border border-dashed overflow-hidden"
            style={{
              aspectRatio: ratioFor(exportAspect) || 4 / 5,
              width: `min(100%, calc(85vh * ${ratioFor(exportAspect) || 4 / 5}))`,
              borderRadius: 'var(--kol-radius-sm)',
              borderColor: dragging ? 'var(--kol-accent-primary)' : 'var(--kol-border-default)',
              backgroundColor: dragging ? 'color-mix(in srgb, var(--kol-accent-primary) 8%, var(--kol-fg-04))' : 'var(--kol-fg-04)',
              transition: 'border-color 0.2s, background-color 0.2s',
            }}
          >
            <SourcePlaceholder onUpload={() => fileInputRef.current?.click()} />
          </div>
        ) : (
          <canvas data-vcap="stage" ref={canvasRef} className="max-w-full max-h-[90vh] object-contain" />
        )}
      </div>

      {/* Controls panel */}
      <EditorRail
        footerBare
        header={
          <>
            <RailHeader>Effects</RailHeader>
            {isVideo && sourceImage && <VideoTransport video={sourceImage} />}
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
              onStop: () => { setPlaying(false); timeRef.current = 0 },
              onRewind: () => { timeRef.current = 0 },
              tempo: Math.round(motionSpeed * 240),
              onTempo: (v) => setMotionSpeed(v / 240),
              tempoMax: 600,
            }}
            exportProps={{
              aspect: exportAspect,
              onAspect: setExportAspect,
              aspects: ASPECT_SPECS,
              scale: exportScale,
              onScale: setExportScale,
              fit: exportFit,
              onFit: setExportFit,
            }}
            exportActions={sourceImage && (
              <Button variant="primary" size="sm" onClick={handleDownload} iconLeft="download" className="w-full">Download</Button>
            )}
            file={
              <div className="flex flex-col gap-2">
                <ButtonGroup orientation="vertical" className="w-full">
                  <Button variant="primary" size="sm" onClick={() => fileInputRef.current?.click()} iconLeft="upload" className="w-full">Upload Image</Button>
                  <Button variant="primary" size="sm" onClick={() => videoInputRef.current?.click()} iconLeft="video" className="w-full">Upload Video</Button>
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
        {tab === 'effect' && (<>
          <Slider labeled label="Amount" min={0} max={100} step={1} value={amount} onChange={setAmount} variant="default" />

          <Divider />

          <Section label="Effect Stack">
            {stack.length === 0 && (
              <p className="kol-mono-10 text-fg-32">No effects yet — add one below.</p>
            )}
            {stack.map((fx, i) => {
              const def = getEffectDef(fx.type)
              if (!def) return null
              return (
                <div key={i} className="flex flex-col gap-2 p-2 rounded bg-fg-04">
                  <div className="flex items-center gap-2">
                    <ToggleSwitch labeled variant="plain" label={`${def.label}${def.tier === 'pixi' ? ' · GPU' : ''}`} checked={fx.enabled} onChange={() => toggleEffect(i)} />
                    <Button variant="ghost" size="sm" quiet iconOnly="cross" iconSize={12} className="ml-auto" aria-label="Remove effect" onClick={() => removeEffect(i)} />
                  </div>
                  {fx.enabled && Object.entries(def.params).map(([key, spec]) => (
                    <FxParamControl key={key} name={key} spec={spec} value={fx.params[key]} onChange={(v) => updateParam(i, key, v)} />
                  ))}
                </div>
              )
            })}
          </Section>

          <Divider />

          <Section label={groupLabel(group)}>
            <Dropdown
              size="sm"
              options={addOptions}
              value=""
              onChange={addEffect}
              variant="subtle"
              className="w-full"
            />
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
      </EditorRail>

      <input ref={fileInputRef} type="file" accept="image/*,.svg" onChange={handleFileUpload} className="hidden" />
      <input ref={videoInputRef} type="file" accept="video/*" onChange={handleFileUpload} className="hidden" />
    </div>
  )
}
