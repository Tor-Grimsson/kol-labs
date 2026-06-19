import { useRef } from 'react'
import { curveBlend, clamp } from './engine/morph.js'

// On-canvas morph control for the selected morph instance: a draggable blend dot
// on a track (echoes the brand Type-Lab blend handle), with a dashed curve graph
// above it visualizing how the blend is distributed across the word (morph mode).
// Sits centred over the frame; everything else is pointer-events:none so it never
// blocks the stage.
const STROKE = 'var(--kol-accent-primary, #F2C94C)'
const SAMPLES = 40

function curvePoints(width, height, curve, blend, cp1, cp2) {
  const pts = []
  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1)
    const v = clamp(curveBlend(t, curve, blend, cp1, cp2))
    pts.push(`${(t * width).toFixed(1)},${((1 - v) * height).toFixed(1)}`)
  }
  return pts.join(' ')
}

export default function MorphOverlay({ instance, stage, onBlend }) {
  const trackRef = useRef(null)
  const dragging = useRef(false)
  const m = instance.morph || {}
  const W = stage?.w || 1
  const H = stage?.h || 1
  const blend = typeof m.blend === 'number' ? m.blend : 0.5
  const mode = m.mode || 'morph'
  const trackW = Math.min(W * 0.62, 560)
  const graphH = 44
  const showGraph = mode === 'morph'

  const setFromX = (clientX) => {
    const el = trackRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    onBlend(clamp((clientX - r.left) / (r.width || 1)))
  }
  const onDown = (e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); setFromX(e.clientX) }
  const onMove = (e) => { if (dragging.current) setFromX(e.clientX) }
  const onUp = (e) => { dragging.current = false; try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* */ } }

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: '50%', top: '50%', width: W, height: H, transform: 'translate(-50%, -50%)' }}
    >
      <div
        className="absolute"
        style={{ left: '50%', bottom: 26, width: trackW, transform: 'translateX(-50%)' }}
      >
        {showGraph && (
          <svg
            aria-hidden width={trackW} height={graphH} viewBox={`0 0 ${trackW} ${graphH}`}
            className="block" style={{ overflow: 'visible', opacity: 0.85, marginBottom: 6 }}
          >
            <polyline
              points={curvePoints(trackW, graphH, m.curve || 'flat', blend, m.cp1 || { x: 0.33, y: 0.33 }, m.cp2 || { x: 0.66, y: 0.66 })}
              fill="none" stroke={STROKE} strokeWidth="1.5" strokeDasharray="4 3"
            />
          </svg>
        )}

        {/* blend / seed track */}
        <div
          ref={trackRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          title={mode === 'random' ? 'Drag to reshuffle' : 'Drag to scrub the morph blend'}
          className="relative pointer-events-auto cursor-ew-resize"
          style={{ height: 14, display: 'flex', alignItems: 'center' }}
        >
          <div style={{ position: 'absolute', left: 0, right: 0, top: 6, height: 2, background: 'rgba(255,255,255,0.18)' }} />
          <div
            style={{
              position: 'absolute', left: `${blend * 100}%`, top: '50%',
              width: 15, height: 15, marginTop: -7, transform: 'translateX(-50%)',
              borderRadius: 999, background: STROKE, border: '2px solid white',
              boxShadow: '0 1px 4px rgba(0,0,0,0.45)',
            }}
          />
        </div>
        <div className="kol-helper-10 text-center mt-1" style={{ color: 'var(--kol-fg-meta)' }}>
          {mode === 'random' ? 'Seed' : mode === 'fade' ? 'Fade A↔B' : 'Morph A → B'} · {Math.round(blend * 100)}%
        </div>
      </div>
    </div>
  )
}
