import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { hexToRgb } from '../style/mathStyle'

/* Fourier terms per waveform — amp in unit-amplitude space (peaks near ±1);
 * the draw scales it to pixels. Ported verbatim from the interfaces widget. */
function buildTerms(wave, n) {
  const terms = []
  if (wave === 'sawtooth') {
    for (let k = 1; k <= n; k++) terms.push({ k, amp: (2 / Math.PI) * (1 / k) * (k % 2 ? 1 : -1), phase: 0 })
  } else if (wave === 'triangle') {
    let i = 0
    for (let k = 1; k <= 2 * n - 1; k += 2) { terms.push({ k, amp: (8 / (Math.PI * Math.PI)) * (1 / (k * k)) * (i % 2 ? -1 : 1), phase: 0 }); i++ }
  } else {
    for (let k = 1; k <= 2 * n - 1; k += 2) terms.push({ k, amp: (4 / Math.PI) * (1 / k), phase: 0 })
  }
  return terms
}

// Epicycle wave synthesis on the math-page canvas contract (the de-lofi'd cousin
// of the interfaces Fourier widget). A chain of rotating circles — each a Fourier
// term — traces a band-limited wave scrolling right. Pausable tempo clock +
// exportBlobAt + aspect letterbox, mirroring Oscilloscope. `vstyle.axis !== 'none'`
// shows the epicycle scaffold (circles/spokes); the trace always draws.
const FourierScope = forwardRef(function FourierScope({
  harmonics = 5, wave = 'square', speed = 0.6,
  playing = false, tempo = 120, resetKey = 0, aspect = null, vstyle = null,
}, ref) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const accumRef = useRef(0)
  const lastRef = useRef(0)
  const exportReqRef = useRef(null)
  const stageRef = useRef(null)
  const boxRef = useRef(null)
  const pathRef = useRef([]) // synthesized tip-Y samples, newest first

  const playingRef = useRef(playing); playingRef.current = playing
  const tempoRef = useRef(tempo); tempoRef.current = tempo
  const speedRef = useRef(speed); speedRef.current = speed
  const aspectRef = useRef(aspect); aspectRef.current = aspect
  const vstyleRef = useRef(vstyle); vstyleRef.current = vstyle

  const terms = useMemo(() => buildTerms(wave, Math.max(1, Math.round(harmonics))), [wave, harmonics])
  const termsRef = useRef(terms); termsRef.current = terms

  // new wave/harmonics → drop the accumulated trace so it re-synthesizes
  useEffect(() => { pathRef.current = [] }, [terms])
  // transport stop / rewind → restart from t=0
  useEffect(() => { accumRef.current = 0; pathRef.current = [] }, [resetKey])

  useImperativeHandle(ref, () => ({
    exportBlob() { return new Promise((resolve) => canvasRef.current?.toBlob((b) => resolve(b), 'image/png')) },
    exportBlobAt(w, h) { return new Promise((resolve) => { exportReqRef.current = { w, h, resolve } }) },
  }), [])

  // Letterbox the stage to the chosen aspect (JS-fit; the DPR observer sizes the backing).
  useEffect(() => {
    const stage = stageRef.current, box = boxRef.current
    if (!stage || !box) return
    const fit = () => {
      const aw = stage.clientWidth, ah = stage.clientHeight
      const r = aspectRef.current
      let w = aw, h = ah
      if (r) { h = w / r; if (h > ah) { h = ah; w = h * r } }
      box.style.width = `${Math.max(1, Math.floor(w))}px`
      box.style.height = `${Math.max(1, Math.floor(h))}px`
    }
    fit()
    const ro = new ResizeObserver(fit); ro.observe(stage)
    return () => ro.disconnect()
  }, [aspect])

  // DPR-aware backing store sized to the wrapper.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)
      pathRef.current = [] // width changed → trace length invalid
    })
    ro.observe(canvas.parentElement)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const w = rect.width, h = rect.height
      // Export request → render this one frame at exact pixels (CSS-space draw
      // scaled onto the export backing via the transform), then restore.
      const exReq = exportReqRef.current
      if (exReq) {
        canvas.width = exReq.w; canvas.height = exReq.h
        ctx.setTransform(exReq.w / Math.max(1, w), 0, 0, exReq.h / Math.max(1, h), 0, 0)
      }

      const vs = vstyleRef.current || {}
      const bg = vs.bg || '#0b0907'
      const fg = vs.stroke || '#e5dfcf'
      const scaffoldOn = vs.axis !== 'none'
      const scaffold = `rgba(${hexToRgb(vs.gridColor || '#4a3e34')},${Math.max(0.15, vs.gridOpacity ?? 0.6)})`
      const weight = vs.weight || 1.25

      // Pausable, tempo-scaled virtual clock (tempo 120 = realtime).
      const now = performance.now()
      if (!lastRef.current) lastRef.current = now
      const dt = (now - lastRef.current) / 1000
      lastRef.current = now
      if (playingRef.current) accumRef.current += dt * (tempoRef.current / 120)
      const elapsed = accumRef.current

      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)

      const tms = termsRef.current
      const maxR = Math.min(h * 0.4, w * 0.4)
      const baseR = maxR / (tms[0]?.amp || 1)
      const originX = maxR + 4
      const cy = h / 2
      const tt = elapsed * speedRef.current * Math.PI * 2

      // epicycle chain
      let x = originX, y = cy
      for (const term of tms) {
        const px = x, py = y
        const r = Math.abs(term.amp) * baseR
        const ang = term.k * tt + term.phase + (term.amp < 0 ? Math.PI : 0)
        x += r * Math.cos(ang); y += r * Math.sin(ang)
        if (scaffoldOn) {
          ctx.strokeStyle = scaffold; ctx.lineWidth = 1
          ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke()
        }
      }
      const tipX = x, tipY = y

      // accumulate the trace only while running (one sample/frame ≈ 1px)
      const path = pathRef.current
      if (playingRef.current) {
        path.unshift(tipY)
        const maxLen = Math.max(1, Math.floor(w - originX - 8))
        if (path.length > maxLen) path.length = maxLen
      }

      const waveX0 = originX + 8
      if (path.length) {
        ctx.strokeStyle = fg; ctx.lineWidth = weight
        ctx.beginPath()
        for (let i = 0; i < path.length; i++) { const X = waveX0 + i, Y = path[i]; i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y) }
        ctx.stroke()
        if (scaffoldOn) {
          ctx.strokeStyle = scaffold; ctx.lineWidth = 1
          ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(waveX0, path[0]); ctx.stroke()
        }
      }
      ctx.fillStyle = fg
      ctx.beginPath(); ctx.arc(tipX, tipY, weight + 0.75, 0, Math.PI * 2); ctx.fill()

      if (exReq) {
        exportReqRef.current = null
        canvas.toBlob((b) => exReq.resolve(b), 'image/png')
        const dpr = window.devicePixelRatio || 1
        canvas.width = w * dpr; canvas.height = h * dpr
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div className="flex flex-col gap-2 h-full w-full">
      <div ref={stageRef} className="flex-1 relative flex items-center justify-center overflow-hidden" style={{ minHeight: 200 }}>
        <div ref={boxRef} className="bg-surface-tertiary relative overflow-hidden" style={{ width: '100%', height: '100%', borderRadius: 2, backgroundColor: vstyle?.bg || undefined }}>
          <canvas data-vcap="stage" ref={canvasRef} className="block w-full h-full" />
        </div>
      </div>
    </div>
  )
})

export default FourierScope
