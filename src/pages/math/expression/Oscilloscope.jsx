import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { hexToRgb } from '../style/mathStyle'

// The oscilloscope display — expression input + live-plotted canvas. Pure stage:
// scope state (bounds / view / pan) lives in ExpressionPage so the rail can
// drive it; this component mirrors the props into refs for the rAF draw loop.
// `aspect` (ratio | null) letterboxes the scope; exposes exportBlob/exportBlobAt
// via a ref. Drawing logic ported from kol-mirror's ExpressionReference.
const Oscilloscope = forwardRef(function Oscilloscope({
  expr, setExpr, fn,
  min, max, duration,
  zoomX, zoomY, panX, panY, setPanX, setPanY, onZoom,
  playing = true, tempo = 120, resetKey = 0, aspect = null, vstyle = null,
}, ref) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const fnRef = useRef(fn)
  const accumRef = useRef(0)   // virtual elapsed seconds — tempo-scaled + pausable
  const lastRef = useRef(0)
  const dragRef = useRef(null)
  const playingRef = useRef(playing)
  const tempoRef = useRef(tempo)
  playingRef.current = playing
  tempoRef.current = tempo
  const aspectRef = useRef(aspect)
  aspectRef.current = aspect
  const exportReqRef = useRef(null) // pending { w, h, resolve } — one frame renders at that size
  const stageRef = useRef(null)
  const boxRef = useRef(null)
  const vstyleRef = useRef(vstyle)
  vstyleRef.current = vstyle
  const onZoomRef = useRef(onZoom)
  onZoomRef.current = onZoom

  const minRef = useRef(min)
  const maxRef = useRef(max)
  const durRef = useRef(duration)
  const zoomXRef = useRef(zoomX)
  const zoomYRef = useRef(zoomY)
  const panXRef = useRef(panX)
  const panYRef = useRef(panY)
  minRef.current = min
  maxRef.current = max
  durRef.current = duration
  zoomXRef.current = zoomX
  zoomYRef.current = zoomY
  panXRef.current = panX
  panYRef.current = panY

  // New compile → reset the playhead so the trace restarts from t=0.
  useEffect(() => {
    fnRef.current = fn
    accumRef.current = 0
  }, [fn])

  // Transport stop / rewind → restart the playhead from t=0.
  useEffect(() => { accumRef.current = 0 }, [resetKey])

  useImperativeHandle(ref, () => ({
    exportBlob() {
      return new Promise((resolve) => canvasRef.current?.toBlob((b) => resolve(b), 'image/png'))
    },
    exportBlobAt(w, h) {
      return new Promise((resolve) => { exportReqRef.current = { w, h, resolve } })
    },
  }), [])

  // Letterbox the scope to the chosen aspect (JS-fit; the DPR observer below then
  // sizes the backing store to the box).
  useEffect(() => {
    const stage = stageRef.current
    const box = boxRef.current
    if (!stage || !box) return
    const fit = () => {
      const aw = stage.clientWidth
      const ah = stage.clientHeight
      const r = aspectRef.current
      let w = aw
      let h = ah
      if (r) { h = w / r; if (h > ah) { h = ah; w = h * r } }
      box.style.width = `${Math.max(1, Math.floor(w))}px`
      box.style.height = `${Math.max(1, Math.floor(h))}px`
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [aspect])

  // DPR-aware backing store, sized to the wrapper. setTransform (not scale) so
  // repeated resizes don't compound the device-pixel-ratio transform.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)
    })
    ro.observe(canvas.parentElement)
    return () => ro.disconnect()
  }, [])

  // Two-finger trackpad / wheel over the scope → zoom. Native non-passive
  // listener so preventDefault actually stops the page from scrolling.
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const onWheel = (e) => {
      e.preventDefault()
      onZoomRef.current?.(e.deltaY < 0 ? 1.1 : 1 / 1.1)
    }
    box.addEventListener('wheel', onWheel, { passive: false })
    return () => box.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      // Export request → render this one frame at exact pixels: scale the
      // CSS-space draw onto an exReq.w×exReq.h backing via the transform.
      const exReq = exportReqRef.current
      if (exReq) {
        canvas.width = exReq.w
        canvas.height = exReq.h
        ctx.setTransform(exReq.w / Math.max(1, w), 0, 0, exReq.h / Math.max(1, h), 0, 0)
      }
      const fnNow = fnRef.current
      const vs = vstyleRef.current || {}
      const stroke = vs.stroke || '#2dd4bf'
      const strokeRgb = hexToRgb(stroke)
      const gridOn = vs.axis && vs.axis !== 'none'
      const gridCol = hexToRgb(vs.gridColor || '#ffffff')
      const gridOp = vs.gridOpacity ?? 0.06
      // Pausable, tempo-scaled virtual clock (tempo 120 = realtime, matching the
      // interfaces / 3D-scene TransportBar convention).
      const now = performance.now()
      if (!lastRef.current) lastRef.current = now
      const dt = (now - lastRef.current) / 1000
      lastRef.current = now
      if (playingRef.current) accumRef.current += dt * (tempoRef.current / 120)
      const elapsed = accumRef.current

      ctx.clearRect(0, 0, w, h)

      const mn = minRef.current
      const mx = maxRef.current
      const baseDur = durRef.current
      const zx = zoomXRef.current
      const zy = zoomYRef.current
      const px = panXRef.current
      const py = panYRef.current
      const dur = baseDur / zx
      const pad = 12
      const range = (mx - mn) / zy || 1
      const center = (mn + mx) / 2 + py
      const lo = center - range / 2
      const toY = (v) => pad + (h - pad * 2) * (1 - (v - lo) / range)
      const toT = (pixelX) => (pixelX / w) * dur + px

      if (fnNow) {
        // Sample once to find the curve's actual min/max for the grid labels.
        let vMin = Infinity, vMax = -Infinity
        for (let i = 0; i < w; i++) {
          const t = toT(i)
          try {
            const v = fnNow(t, Math.round(t * 60), 0, 100)
            if (v < vMin) vMin = v
            if (v > vMax) vMax = v
          } catch { break }
        }
        const vMid = (vMin + vMax) / 2

        // Knob range 0–100 reference lines (red dashed).
        ctx.strokeStyle = 'rgba(231,76,60,0.3)'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        const y0 = toY(0), y100 = toY(100)
        ctx.beginPath(); ctx.moveTo(0, y100); ctx.lineTo(w, y100); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(w, y0); ctx.stroke()
        ctx.setLineDash([])
        ctx.font = '9px var(--kol-font-family-mono)'
        ctx.fillStyle = 'rgba(231,76,60,0.4)'
        ctx.fillText('100', w - 20, y100 + 10)
        ctx.fillText('0', w - 10, y0 - 4)

        // Grid lines at the curve's min / mid / max (gated by the axis style).
        ctx.lineWidth = 1
        ctx.fillStyle = `rgba(${gridCol},${Math.min(1, gridOp * 3)})`
        for (const v of [vMax, vMid, vMin]) {
          const y = toY(v)
          if (gridOn) { ctx.strokeStyle = `rgba(${gridCol},${gridOp})`; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
          ctx.fillText(Math.round(v), 4, y - 3)
        }

        // Static curve (full window, dim).
        ctx.strokeStyle = `rgba(${strokeRgb},0.15)`
        ctx.lineWidth = 1
        ctx.beginPath()
        for (let i = 0; i < w; i++) {
          const t = toT(i)
          try {
            const v = fnNow(t, Math.round(t * 60), 0, 100)
            const y = toY(v)
            i === 0 ? ctx.moveTo(i, y) : ctx.lineTo(i, y)
          } catch { break }
        }
        ctx.stroke()

        // Playhead.
        const playT = (elapsed % baseDur)
        const playX = ((playT - px) / dur) * w
        ctx.strokeStyle = `rgba(${strokeRgb},0.4)`
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(playX, 0); ctx.lineTo(playX, h); ctx.stroke()

        // Live trace up to the playhead.
        ctx.strokeStyle = stroke
        ctx.lineWidth = 2
        ctx.beginPath()
        const traceEnd = Math.min(playX, w)
        for (let i = 0; i < traceEnd; i++) {
          const t = toT(i)
          try {
            const v = fnNow(t, Math.round(t * 60), 0, 100)
            const y = toY(v)
            i === 0 ? ctx.moveTo(i, y) : ctx.lineTo(i, y)
          } catch { break }
        }
        ctx.stroke()

        // Current-value dot.
        try {
          const curV = fnNow(playT, Math.round(playT * 60), 0, 100)
          const dotY = toY(curV)
          ctx.fillStyle = stroke
          ctx.beginPath(); ctx.arc(playX, dotY, 3, 0, Math.PI * 2); ctx.fill()
        } catch { /* skip dot */ }
      }

      // Finish an export: snapshot, then restore the on-screen backing + transform.
      if (exReq) {
        exportReqRef.current = null
        canvas.toBlob((b) => exReq.resolve(b), 'image/png')
        const dpr = window.devicePixelRatio || 1
        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }

      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div className="flex flex-col gap-2 h-full w-full">
      <input
        type="text"
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        onClick={(e) => { if (e.altKey) setExpr('') }}
        placeholder="wave(t)"
        spellCheck={false}
        className="w-full bg-surface-tertiary text-fg-96 kol-helper-10 shrink-0"
        style={{ border: 'none', outline: 'none', padding: '8px 10px', borderRadius: 2, height: 32, fontFamily: 'var(--kol-font-family-mono)' }}
      />
      <div ref={stageRef} className="flex-1 relative flex items-center justify-center overflow-hidden" style={{ minHeight: 200 }}>
        <div
          ref={boxRef}
          className="bg-surface-tertiary relative overflow-hidden"
          style={{ width: '100%', height: '100%', borderRadius: 2, cursor: 'grab', touchAction: 'none', backgroundColor: vstyle?.bg || undefined }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            e.currentTarget.style.cursor = 'grabbing'
            dragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: panX, startPanY: panY }
          }}
          onPointerMove={(e) => {
            if (!dragRef.current) return
            const dx = e.clientX - dragRef.current.startX
            const dy = e.clientY - dragRef.current.startY
            const rect = e.currentTarget.getBoundingClientRect()
            const w = rect.width || 300
            const h = rect.height || 160
            const dur = (Number(duration) || 5) / zoomX
            const range = ((Number(max) || 100) - (Number(min) || 0)) / zoomY
            setPanX(dragRef.current.startPanX - (dx / w) * dur)
            setPanY(dragRef.current.startPanY + (dy / h) * range)
          }}
          onPointerUp={(e) => {
            e.currentTarget.style.cursor = 'grab'
            dragRef.current = null
          }}
        >
          <canvas ref={canvasRef} className="block w-full h-full" />
        </div>
      </div>
    </div>
  )
})

export default Oscilloscope
