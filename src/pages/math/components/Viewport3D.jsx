import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { resolveCam, projector } from '../uzumaki/engine/camera'
import { drawAxes3D } from './axes3d'
import { resolveRate } from '../../../lib/exprParam.js'
import { useViewportZoom } from '../../../components/framework/useViewportZoom.js'

// Shared interactive 3D viewport for the math visualisers. Owns the canvas, an
// orbit camera (drag = yaw/pitch, wheel = zoom) built on the uzumaki camera, an
// optional auto-spin, aspect letterboxing, and exact-size PNG export (one rAF
// frame renders at the requested pixels, then restores). Each frame it clears to
// `bg`, builds a projector, and calls `render({ ctx, W, H, d, proj, ext, t })` —
// the page draws its scene in world space and projects with `proj`.
//
// Time `t` is a pausable, tempo-scaled accumulator (seconds). With `dur` set it
// wraps (loops) and onProgress/seek work against it for a scrubber.
const DEFAULT_CAM = { yaw: 24, pitch: 22, dist: 3, zoom: 1 }

const Viewport3D = forwardRef(function Viewport3D(
  { render, ext = 1, paused = false, speed = 1, spin = 0, dur = null, aspect = null, bg = '#050506', axis = null, onProgress = null },
  ref,
) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const camRef = useRef({ ...DEFAULT_CAM })
  const stateRef = useRef({})
  stateRef.current = { render, ext, paused, speed, spin, dur, bg, axis, onProgress }
  const aspectRef = useRef(aspect)
  aspectRef.current = aspect
  const accumRef = useRef(0)
  const dragRef = useRef(null)
  const exportReqRef = useRef(null)
  const sizeRef = useRef(null)

  // = / − zoom · 0 reset framing. Wheel/two-finger zoom is already wired below.
  useViewportZoom({
    zoom: (f) => { const c = camRef.current; c.dist = Math.max(0.6, Math.min(20, c.dist / f)) },
    reset: () => { camRef.current = { ...DEFAULT_CAM } },
  })

  useImperativeHandle(ref, () => ({
    resetCamera() { camRef.current = { ...DEFAULT_CAM } },
    resetTime() { accumRef.current = 0 },
    seek(frac) { accumRef.current = Math.max(0, Math.min(1, frac)) * (stateRef.current.dur || 1) },
    exportBlob() { return new Promise((res) => canvasRef.current?.toBlob((b) => res(b), 'image/png')) },
    exportBlobAt(w, h) { return new Promise((res) => { exportReqRef.current = { w, h, resolve: res } }) },
  }), [])

  const dpr = () => Math.min(window.devicePixelRatio || 1, 2)

  useEffect(() => {
    const wrap = wrapRef.current
    const cv = canvasRef.current
    const ctx = cv.getContext('2d')

    const sizeCanvas = () => {
      const aw = wrap.clientWidth
      const ah = wrap.clientHeight
      const r = aspectRef.current
      let w = aw
      let h = ah
      if (r) { h = w / r; if (h > ah) { h = ah; w = h * r } }
      w = Math.max(1, Math.floor(w))
      h = Math.max(1, Math.floor(h))
      cv.style.width = `${w}px`
      cv.style.height = `${h}px`
      const d = dpr()
      cv.width = Math.round(w * d)
      cv.height = Math.round(h * d)
    }
    sizeCanvas()
    sizeRef.current = sizeCanvas
    const ro = new ResizeObserver(sizeCanvas)
    ro.observe(wrap)

    let raf = 0
    let last = 0
    const frame = (now) => {
      const { render, ext, paused, speed, spin, dur, bg, axis, onProgress } = stateRef.current
      if (!last) last = now
      const dt = (now - last) / 1000
      last = now
      if (!paused) accumRef.current += dt * speed
      // Spin only while playing — paused (the default on load) is fully frozen.
      // `spin` may be an expression (resolved at the playhead; never NaN, so the
      // accumulating yaw can't get stuck).
      if (spin && !paused && !dragRef.current) camRef.current.yaw += resolveRate(spin, accumRef.current, 0) * dt

      const exReq = exportReqRef.current
      if (exReq) { cv.width = exReq.w; cv.height = exReq.h }
      const W = cv.width
      const H = cv.height
      const d = exReq ? exReq.h / Math.max(1, cv.clientHeight) : dpr()

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      const cam = resolveCam(camRef.current, ext)
      const proj = projector(cam, W, H, ext)
      if (axis) drawAxes3D(ctx, proj, ext, d, axis) // reference axes under the figure
      const t = dur ? accumRef.current % dur : accumRef.current
      try { render?.({ ctx, W, H, d, proj, ext, t, eye: cam.eye }) } catch { /* one bad frame shouldn't kill the loop */ }
      onProgress?.({ t, dur: dur || 1 })

      if (exReq) {
        exportReqRef.current = null
        cv.toBlob((b) => exReq.resolve(b), 'image/png')
        const dd = dpr()
        cv.width = Math.round((cv.clientWidth || 1) * dd)
        cv.height = Math.round((cv.clientHeight || 1) * dd)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const onWheel = (e) => {
      e.preventDefault()
      const c = camRef.current
      c.dist = Math.max(0.6, Math.min(20, c.dist * (e.deltaY > 0 ? 1.08 : 0.92)))
    }
    cv.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      cv.removeEventListener('wheel', onWheel)
    }
  }, [])

  useEffect(() => { sizeRef.current?.() }, [aspect])

  const onDown = (e) => { e.currentTarget.setPointerCapture(e.pointerId); dragRef.current = { x: e.clientX, y: e.clientY } }
  const onMove = (e) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.x
    const dy = e.clientY - dragRef.current.y
    dragRef.current = { x: e.clientX, y: e.clientY }
    const c = camRef.current
    c.yaw += dx * 0.4
    c.pitch = Math.max(-89, Math.min(89, c.pitch - dy * 0.4))
  }
  const onUp = (e) => { dragRef.current = null; e.currentTarget.releasePointerCapture?.(e.pointerId) }

  return (
    <div ref={wrapRef} className="relative h-full w-full flex items-center justify-center overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block cursor-grab"
        style={{ touchAction: 'none' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      />
    </div>
  )
})

export default Viewport3D
