import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { sampleClip, epicycleJoints } from '../engine/sample'
import { projector, resolveCam } from '../engine/camera'
import { sampleTimeline, totalDuration } from '../engine/timeline'
import { drawAxes3D } from '../../components/axes3d'
import { resolveRate } from '../../../../lib/exprParam.js'

// Plays one clip: samples the curve once, then each frame walks the keyframe
// timeline (eased), draws the trace progressively, and overlays the epicycle
// arms + joint dots / head dot. 3D clips are projected through the live camera.
const CurvePlayer = forwardRef(function CurvePlayer({ clip, paused = false, speed = 1, cameraMotion = true, manualCam = null, bg = '#050506', axis = null, onProgress = null, sampleKey = null }, ref) {
  const canvasRef = useRef(null)
  const stateRef = useRef({ clip, paused, speed, cameraMotion, manualCam, bg, axis, onProgress, sampleKey })
  stateRef.current = { clip, paused, speed, cameraMotion, manualCam, bg, axis, onProgress, sampleKey }
  const sampledRef = useRef({ key: null, data: null })
  const accumRef = useRef(0) // playhead time (seconds) — shared with seek() so the scrubber can scrub
  const durRef = useRef(1) // current clip's animated duration; seek() maps a fraction onto it
  const exportReqRef = useRef(null) // pending { w, h, resolve } — the next frame renders at that size

  // Scrub: jump the playhead to a fraction (0..1) of the animated duration. Works
  // while paused too — the frame still draws, so the figure redraws at the new t.
  useImperativeHandle(
    ref,
    () => ({
      seek(frac) {
        const f = Math.max(0, Math.min(1, frac))
        accumRef.current = f * durRef.current
      },
      // Export the current frame as a PNG blob at the on-screen size.
      exportBlob() {
        return new Promise((resolve) => canvasRef.current?.toBlob((b) => resolve(b), 'image/png'))
      },
      // Export the current frame rendered at an exact w×h (the next rAF tick
      // hijacks the canvas size for one draw, captures, then restores).
      exportBlobAt(w, h) {
        return new Promise((resolve) => { exportReqRef.current = { w, h, resolve } })
      },
    }),
    [],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = () => Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      const d = dpr()
      canvas.width = Math.max(1, Math.round((canvas.clientWidth || 1) * d))
      canvas.height = Math.max(1, Math.round((canvas.clientHeight || 1) * d))
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    let raf = 0
    let lastNow = 0
    let lastId = null

    const frame = (now) => {
      const { clip, paused, speed, cameraMotion, manualCam, bg, axis, onProgress, sampleKey } = stateRef.current
      if (!lastNow) lastNow = now
      const dt = (now - lastNow) / 1000
      lastNow = now
      if (clip.id !== lastId) {
        accumRef.current = 0
        lastId = clip.id
      }
      if (!paused) accumRef.current += dt * speed

      // Re-sample when the curve/modifiers change (sampleKey), not just the clip
      // id — so live param edits rebuild the point cloud. Falls back to id.
      const skey = sampleKey ?? clip.id
      if (sampledRef.current.key !== skey) {
        sampledRef.current = { key: skey, data: sampleClip(clip) }
      }
      const data = sampledRef.current.data
      const tl = clip.timeline
      const dur = totalDuration(tl)
      durRef.current = dur
      const tail = 1.1 // hold the finished figure, then loop
      const t = accumRef.current % (dur + tail)
      if (onProgress) onProgress({ t, dur }) // report the playhead out (ref-only; never setState here)
      const ext = data.maxExtent
      const frameState = sampleTimeline(tl, Math.min(t, dur), ext)
      // Clamp the reveal to [0,1] — overshoot easings (back/elastic/bounce) push
      // the eased value past 1, which would index past the point array. The
      // camera (frameState.cam) keeps the un-clamped overshoot for its bounce.
      const draw = Math.max(0, Math.min(1, frameState.draw))
      // Camera motion off → freeze the viewpoint; use the user's manual orbit if
      // given, else the clip's static pose / first keyframe. Trace still draws.
      const cam = cameraMotion ? frameState.cam : resolveCam(manualCam || clip.staticCam || tl[0].cam, ext)

      // For an export request, render this one frame at the requested pixel size
      // (CSS size stays the framed box, so no visible jump); d scales strokes to
      // the export resolution.
      const exReq = exportReqRef.current
      if (exReq) { canvas.width = exReq.w; canvas.height = exReq.h }
      const W = canvas.width
      const H = canvas.height
      const d = exReq ? exReq.h / Math.max(1, canvas.clientHeight) : dpr()
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      const space = clip.space || '2D'
      const proj = projector(cam, W, H, ext)

      if (axis) drawAxes3D(ctx, proj, ext, d, { ...axis, space })

      const pts = data.pts
      const N = pts.length
      const count = Math.max(1, Math.floor(draw * (N - 1)))
      const style = clip.style || {}
      const color = style.color || '#ffffff'
      // weight + repeat are render-time (NOT in sampleKey) so an expression here
      // animates without busting the point-cache. `t` = the playhead.
      const weight = resolveRate(style.weight ?? 1.5, t, 1.5) * d
      const repeat = Math.max(1, Math.min(64, Math.round(resolveRate(clip.modifiers?.repeat ?? 1, t, 1))))

      // `repeat` rotates copies about the focus in WORLD space (z-axis), so the
      // mandala is correct under any camera angle.
      for (let m = 0; m < repeat; m++) {
        const ang = (m / repeat) * Math.PI * 2
        const ca = Math.cos(ang)
        const sa = Math.sin(ang)
        const tp = repeat > 1 ? (p) => ({ x: p.x * ca - p.y * sa, y: p.x * sa + p.y * ca, z: p.z }) : (p) => p
        if (clip.curve.kind === 'points') {
          ctx.fillStyle = color
          for (let i = 0; i <= count; i++) {
            const [x, y] = proj(tp(pts[i]))
            ctx.beginPath()
            ctx.arc(x, y, weight, 0, Math.PI * 2)
            ctx.fill()
          }
        } else {
          ctx.strokeStyle = color
          ctx.lineWidth = weight
          ctx.lineJoin = 'round'
          ctx.lineCap = 'round'
          ctx.beginPath()
          for (let i = 0; i <= count; i++) {
            const [x, y] = proj(tp(pts[i]))
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          ctx.stroke()
        }
      }

      // Construction overlay.
      if (data.epi && (clip.show?.arms || clip.show?.dots)) {
        const s = data.epi.range * draw
        const joints = epicycleJoints(data.epi.terms, s)
        if (clip.show.arms) {
          ctx.strokeStyle = 'rgba(255,255,255,0.55)'
          ctx.lineWidth = Math.max(1, d * 0.8)
          ctx.beginPath()
          for (let i = 0; i < joints.length; i++) {
            const [x, y] = proj(joints[i])
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          ctx.stroke()
        }
        if (clip.show.dots) {
          ctx.fillStyle = '#ffffff'
          for (let i = 0; i < joints.length; i++) {
            const [x, y] = proj(joints[i])
            ctx.beginPath()
            ctx.arc(x, y, Math.max(2, d * 1.6), 0, Math.PI * 2)
            ctx.fill()
          }
        }
      } else if (clip.show?.dots && clip.curve.kind !== 'points') {
        const [x, y] = proj(pts[count])
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(x, y, Math.max(2, d * 1.6), 0, Math.PI * 2)
        ctx.fill()
      }

      // Finish an export: snapshot (toBlob reads current pixels), then restore
      // the on-screen backing store for subsequent frames.
      if (exReq) {
        exportReqRef.current = null
        canvas.toBlob((b) => exReq.resolve(b), 'image/png')
        const dd = dpr()
        canvas.width = Math.max(1, Math.round((canvas.clientWidth || 1) * dd))
        canvas.height = Math.max(1, Math.round((canvas.clientHeight || 1) * dd))
      }

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} className="block h-full w-full" />
})

export default CurvePlayer
