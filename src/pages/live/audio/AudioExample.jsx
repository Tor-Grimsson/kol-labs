import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import Button from '../../../components/atoms/Button.jsx'
import { enableAudio, disableAudio, isAudioEnabled, subscribeAudio, readAudio } from '../../../lib/audioSource.js'
import { setAppSetting } from '../../../lib/appSettings.js'
import { EXAMPLES, EXAMPLE_BY_ID } from './examples.js'

// One canvas scaffold for every audio example. Runs a single rAF that sizes the
// canvas (DPR-aware), reads the live bands, and hands the chosen example's draw
// fn everything it needs. The example label + formula are shown as a caption so
// each page documents the expression it embodies.
export default function AudioExample() {
  const { exampleId } = useParams()
  const ex = EXAMPLE_BY_ID[exampleId] || EXAMPLES[0]
  const canvasRef = useRef(null)
  const stateRef = useRef({})
  const [on, setOn] = useState(isAudioEnabled())
  useEffect(() => subscribeAudio(setOn), [])

  // Fresh scratch state whenever the example changes.
  useEffect(() => { stateRef.current = { _t0: performance.now() / 1000 } }, [exampleId])

  useEffect(() => {
    let raf
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const cv = canvasRef.current
      if (!cv) return
      const rect = cv.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const W = Math.max(1, Math.round(rect.width)), H = Math.max(1, Math.round(rect.height))
      if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr }
      const ctx = cv.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      const now = performance.now() / 1000
      const st = stateRef.current
      const dt = st._last ? Math.min(0.05, now - st._last) : 0
      st._last = now
      const color = getComputedStyle(cv).color
      ex.draw({ ctx, w: W, h: H, a: readAudio(), t: now - (st._t0 || now), dt, color, state: st })
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ex])

  async function toggle() {
    if (on) { disableAudio(); setAppSetting('audioReactive', false) }
    else { const ok = await enableAudio(); if (ok) setAppSetting('audioReactive', true) }
  }

  return (
    <div className="min-h-dvh bg-surface-secondary flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-fg-08">
        <div className="flex flex-col gap-0.5">
          <span className="kol-helper-12 uppercase tracking-widest text-body">{ex.label}</span>
          <span className="kol-mono-12 text-meta">{ex.formula}</span>
        </div>
        <Button variant={on ? 'accent' : 'primary'} onClick={toggle}>
          {on ? 'Stop listening' : 'Enable audio'}
        </Button>
      </div>
      <canvas ref={canvasRef} data-vcap="stage" className="text-fg flex-1 w-full" />
      {!on && (
        <p className="kol-mono-12 text-meta text-center pb-4">Enable audio, then make a sound — or use it as <code>{ex.formula}</code> in any expression slider.</p>
      )}
    </div>
  )
}
