import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { hexToRgb } from '../style/mathStyle'

const TAU = Math.PI * 2

/* Closed-form Fourier terms for the three ideal waves — amp in unit-amplitude
 * space (peaks near ±1). Used only as the fallback when no `terms` are supplied
 * (the deep /math/fourier route). The Waveforms editor passes DFT-derived terms. */
function buildTerms(wave, n, rolloff = 0) {
  const terms = []
  if (wave === 'sawtooth') {
    for (let k = 1; k <= n; k++) terms.push({ k, amp: (2 / Math.PI) * (1 / k) * (k % 2 ? 1 : -1), phase: 0 })
  } else if (wave === 'triangle') {
    let i = 0
    for (let k = 1; k <= 2 * n - 1; k += 2) { terms.push({ k, amp: (8 / (Math.PI * Math.PI)) * (1 / (k * k)) * (i % 2 ? -1 : 1), phase: 0 }); i++ }
  } else {
    for (let k = 1; k <= 2 * n - 1; k += 2) terms.push({ k, amp: (4 / Math.PI) * (1 / k), phase: 0 })
  }
  if (rolloff) for (const t of terms) t.amp *= Math.pow(t.k, -rolloff)
  return terms
}

const PAN_VEC = {
  right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1],
  diag: [0.7071, 0.7071], anti: [-0.7071, 0.7071],
}

// Epicycle wave synthesis on the math-page canvas contract. A chain of rotating
// circles — each a Fourier term — synthesises a periodic wave whose value scrolls
// right as the trace.
//
// Play/pause (Space) starts/stops the whole clock — oscillation, camera and Form
// modulation alike. What it must NOT do is RESET the trace: editing anything
// (function, harmonics, weight, transform, colour) only changes what's drawn from
// now on — already-graphed samples scroll off as drawn. Only a transport
// stop/rewind (`resetKey`) clears the trace; tempo just rescales the rate.
//
// `terms` (DFT-derived, from the editor's function input) wins; absent it, the
// closed-form `wave`+`harmonics` fallback keeps the deep /math/fourier route
// unchanged — that route also drives the scaffold via `vstyle.axis`.
const FourierScope = forwardRef(function FourierScope({
  terms = null, wave = 'square', harmonics = 5, rolloff = 0, phaseOff = 0,
  speed = 0.3, stagger = 0, pulse = 0, fade = 0, swing = 0,         // Form (animation)
  flow = 0, panDir = 'right', zoom = 1, angle = 0,                  // Frame (animation)
  posX = 0, posY = 0, baseScale = 1,                               // Transform (static)
  circlesShow = null, circlesColor = null, circlesWeight = null, circlesOpacity = null,
  loopShow = null, loopColor = null, loopWeight = null, loopOpacity = null,
  graphShow = null, graphColor = null, graphWeight = null, graphOpacity = null, graphLength = 1, graphDot = 1,
  playing = false, tempo = 120, resetKey = 0, aspect = null, vstyle = null,
}, ref) {
  const canvasRef = useRef(null)
  const figRef = useRef(null) // offscreen figure buffer (framing + pan composite over it)
  const rafRef = useRef(null)
  const accumRef = useRef(0)  // play-gated clock — Space stops/starts it
  const lastRef = useRef(0)
  const exportReqRef = useRef(null)
  const stageRef = useRef(null)
  const boxRef = useRef(null)
  const pathRef = useRef([]) // synthesized tip-Y samples, newest first

  // Live refs so the rAF loop reads current props without re-subscribing.
  const P = useRef({})
  P.current = {
    phaseOff, speed, stagger, pulse, fade, swing,
    flow, panDir, zoom, angle, posX, posY, baseScale,
    circlesShow, circlesColor, circlesWeight, circlesOpacity,
    loopShow, loopColor, loopWeight, loopOpacity,
    graphShow, graphColor, graphWeight, graphOpacity, graphLength, graphDot,
    playing, tempo, aspect, vstyle,
  }
  const aspectRef = useRef(aspect); aspectRef.current = aspect

  const resolvedTerms = useMemo(
    () => (Array.isArray(terms) && terms.length ? terms : buildTerms(wave, Math.max(1, Math.round(harmonics)), rolloff)),
    [terms, wave, harmonics, rolloff],
  )
  const termsRef = useRef(resolvedTerms); termsRef.current = resolvedTerms

  // transport stop / rewind → restart the clock from t=0 and clear the trace.
  // NOTE: a function / harmonics / rolloff change does NOT clear — new terms only
  // affect newly-drawn samples; what's already graphed scrolls off as it was drawn.
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

    // Render the whole figure (epicycle chain + trace + tip dot) onto a transparent
    // offscreen buffer in CSS space. The main pass fills bg then composites this
    // buffer under the framing transform + toroidal pan.
    const drawFigure = (fctx, w, h, T) => {
      const p = P.current
      const vs = p.vstyle || {}
      const fg = vs.stroke || '#e5dfcf'
      const axisOn = vs.axis !== 'none'
      const gridCol = vs.gridColor || fg
      const gridOp = vs.gridOpacity ?? 0.6
      // Per-element look. Opacity 0 hides the element (it replaces the old Show toggle);
      // nulls fall back to the deep /math/fourier route's vstyle (axis + grid + weight).
      const cOp = p.circlesOpacity ?? gridOp
      const cShow = (p.circlesShow == null ? axisOn : p.circlesShow) && cOp > 0.004
      const cStroke = `rgba(${hexToRgb(p.circlesColor || gridCol)},${cOp})`
      const cW = Math.max(0.25, p.circlesWeight ?? 1)
      const lOp = p.loopOpacity ?? gridOp
      const lShow = (p.loopShow == null ? axisOn : p.loopShow) && lOp > 0.004
      const lStroke = `rgba(${hexToRgb(p.loopColor || gridCol)},${lOp})`
      const lW = Math.max(0.25, p.loopWeight ?? 1)
      const gOp = p.graphOpacity ?? 1
      const gShow = (p.graphShow == null ? true : p.graphShow) && gOp > 0.004
      const gColor = p.graphColor || fg
      const gW = p.graphWeight ?? (vs.weight || 1.25)
      const gLen = p.graphLength ?? 1
      const gDot = p.graphDot ?? 1

      fctx.clearRect(0, 0, w, h)

      const tms = termsRef.current
      let maxAmp = 0
      for (const t of tms) { const a = Math.abs(t.amp); if (a > maxAmp) maxAmp = a }
      const maxR = Math.min(h * 0.4, w * 0.4) * Math.max(0.1, p.baseScale)
      // Form · Pulse breathes the amplitude.
      const pulseScale = 1 - p.pulse * 0.5 * (1 - Math.cos(T * 0.35 * TAU))
      const baseR = (maxR / (maxAmp || 1)) * pulseScale
      // Transform · static origin. Graph shown → anchor left so the trace fills the
      // right; graph hidden → no trace, so centre the epicycle.
      const originX = (gShow ? maxR + 4 : w / 2) + p.posX * w * 0.45
      const cy = h / 2 + p.posY * h * 0.45
      // One play-gated clock drives the rotation and the Form phase mods.
      const tt = T * p.speed * TAU
      const phaseRad = (p.phaseOff * Math.PI) / 180
      const swingRad = ((p.swing * Math.PI) / 180) * Math.sin(T * 0.4 * TAU)
      const staggerOsc = p.stagger * Math.sin(T * 0.5 * TAU)

      // epicycle chain
      let x = originX, y = cy
      for (const term of tms) {
        const px = x, py = y
        const r = Math.abs(term.amp) * baseR
        const ang = term.k * tt + term.phase + (term.amp < 0 ? Math.PI : 0)
          + phaseRad + swingRad + staggerOsc * term.k * 0.25
        x += r * Math.cos(ang); y += r * Math.sin(ang)
        if (cShow) { fctx.strokeStyle = cStroke; fctx.lineWidth = cW; fctx.beginPath(); fctx.arc(px, py, r, 0, TAU); fctx.stroke() }
        if (lShow) { fctx.strokeStyle = lStroke; fctx.lineWidth = lW; fctx.beginPath(); fctx.moveTo(px, py); fctx.lineTo(x, y); fctx.stroke() }
      }
      const tipX = x, tipY = y

      // accumulate the trace while playing (Space pauses it); trim either way
      const path = pathRef.current
      const waveX0 = originX + 8
      const maxLen = Math.max(1, Math.floor((w - waveX0 - 8) * Math.max(0.02, gLen)))
      if (p.playing) path.unshift(tipY)
      if (path.length > maxLen) path.length = maxLen

      // Graph · the waveform trace + connector + drawing head, in its own colour/weight/opacity.
      // Form · Fade breathes the trace opacity on the ANIMATION clock.
      const traceAlpha = 1 - p.fade * 0.6 * (1 - Math.cos(T * 0.5 * TAU)) * 0.5
      if (gShow) {
        if (path.length) {
          fctx.save()
          fctx.globalAlpha = Math.max(0.02, gOp * traceAlpha)
          fctx.strokeStyle = gColor; fctx.lineWidth = gW
          fctx.beginPath()
          for (let i = 0; i < path.length; i++) { const X = waveX0 + i, Y = path[i]; i === 0 ? fctx.moveTo(X, Y) : fctx.lineTo(X, Y) }
          fctx.stroke()
          fctx.restore()
          if (lShow) { fctx.strokeStyle = lStroke; fctx.lineWidth = lW; fctx.beginPath(); fctx.moveTo(tipX, tipY); fctx.lineTo(waveX0, path[0]); fctx.stroke() }
        }
        fctx.save()
        fctx.globalAlpha = Math.max(0.02, gOp)
        fctx.fillStyle = gColor
        fctx.beginPath(); fctx.arc(tipX, tipY, (gW + 0.75) * Math.max(0.1, gDot), 0, TAU); fctx.fill()
        fctx.restore()
      }
    }

    const draw = () => {
      const p = P.current
      const rect = canvas.getBoundingClientRect()
      const w = rect.width, h = rect.height
      const exReq = exportReqRef.current
      if (exReq) {
        canvas.width = exReq.w; canvas.height = exReq.h
        ctx.setTransform(exReq.w / Math.max(1, w), 0, 0, exReq.h / Math.max(1, h), 0, 0)
      }

      const vs = p.vstyle || {}
      const bg = vs.bg || '#0b0907'

      // Tempo-scaled clock — advances only while playing (Space stops/starts it).
      const now = performance.now()
      if (!lastRef.current) lastRef.current = now
      const dt = (now - lastRef.current) / 1000
      lastRef.current = now
      if (p.playing) accumRef.current += dt * (p.tempo / 120)
      const T = accumRef.current

      // figure buffer (CSS-sized, transparent)
      let fig = figRef.current
      const fw = Math.max(1, Math.ceil(w)), fh = Math.max(1, Math.ceil(h))
      if (!fig) { fig = document.createElement('canvas'); figRef.current = fig }
      if (fig.width !== fw || fig.height !== fh) { fig.width = fw; fig.height = fh }
      const fctx = fig.getContext('2d')
      drawFigure(fctx, w, h, T)

      // main: bg, then composite the figure under the framing transform + pan tiling
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)

      ctx.save()
      if (p.zoom !== 1 || p.angle) {
        ctx.translate(w / 2, h / 2)
        ctx.rotate((p.angle * Math.PI) / 180)
        ctx.scale(p.zoom || 1, p.zoom || 1)
        ctx.translate(-w / 2, -h / 2)
      }
      // Frame · flow + direction drift the figure (toroidal wrap).
      if (p.flow > 0) {
        const [dx, dy] = PAN_VEC[p.panDir] || PAN_VEC.right
        const drift = T * p.flow * Math.min(w, h) * 0.15
        const ox = (((drift * dx) % w) + w) % w
        const oy = (((drift * dy) % h) + h) % h
        const margin = (p.zoom && p.zoom < 1) ? Math.ceil(1 / p.zoom) : 0
        for (let gx = ox - w * (1 + margin); gx < w * (1 + margin); gx += w)
          for (let gy = oy - h * (1 + margin); gy < h * (1 + margin); gy += h)
            ctx.drawImage(fig, gx, gy, w, h)
      } else {
        ctx.drawImage(fig, 0, 0, w, h)
      }
      ctx.restore()

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
