import { useEffect, useRef, useState } from 'react'
import Section from '../molecules/Section.jsx'
import Slider from '../atoms/Slider.jsx'
import Button from '../atoms/Button.jsx'

const DEFAULT = { yaw: 24, pitch: 22, dist: 3 }
const isTyping = (el) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)

export default function CameraPanel({ viewRef, spin, onSpin, bare = false }) {
  const [yaw, setYaw] = useState(DEFAULT.yaw)
  const [pitch, setPitch] = useState(DEFAULT.pitch)
  const [dist, setDist] = useState(DEFAULT.dist)
  const [slots, setSlots] = useState([null, null, null])
  const vr = useRef(viewRef)
  vr.current = viewRef

  const applyYaw = (v) => { setYaw(v); viewRef.current?.setCamera({ yaw: v }) }
  const applyPitch = (v) => { setPitch(v); viewRef.current?.setCamera({ pitch: v }) }
  const applyDist = (v) => { setDist(v); viewRef.current?.setCamera({ dist: v }) }

  const reset = () => {
    setYaw(DEFAULT.yaw); setPitch(DEFAULT.pitch); setDist(DEFAULT.dist)
    viewRef.current?.setCamera({ ...DEFAULT })
  }

  const saveSlot = (i) => {
    const cam = viewRef.current?.getCamera()
    if (!cam) return
    const { yaw: y, pitch: p, dist: d } = cam
    setYaw(y); setPitch(p); setDist(d)
    setSlots((s) => { const n = [...s]; n[i] = { yaw: y, pitch: p, dist: d }; return n })
  }

  const recallSlot = (i) => {
    const s = slots[i]
    if (!s) return
    setYaw(s.yaw); setPitch(s.pitch); setDist(s.dist)
    viewRef.current?.setCamera(s)
  }

  // ← → = yaw ±5°   ↑ ↓ = pitch ±5°   [ ] = distance ±0.5
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTyping(document.activeElement)) return
      const v = vr.current.current
      if (!v) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); const c = v.getCamera(); v.setCamera({ yaw: c.yaw - 5 }) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); const c = v.getCamera(); v.setCamera({ yaw: c.yaw + 5 }) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); const c = v.getCamera(); v.setCamera({ pitch: Math.min(89, c.pitch + 5) }) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); const c = v.getCamera(); v.setCamera({ pitch: Math.max(-89, c.pitch - 5) }) }
      else if (e.key === '[') { e.preventDefault(); const c = v.getCamera(); v.setCamera({ dist: Math.max(0.6, c.dist - 0.5) }) }
      else if (e.key === ']') { e.preventDefault(); const c = v.getCamera(); v.setCamera({ dist: Math.min(20, c.dist + 0.5) }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const body = (
    <>
      <Slider labeled label="Yaw" min={-180} max={180} step={1} value={yaw} onChange={applyYaw} variant="default" noExpr />
      <Slider labeled label="Pitch" min={-89} max={89} step={1} value={pitch} onChange={applyPitch} variant="default" noExpr />
      <Slider labeled label="Distance" min={0.6} max={20} step={0.1} value={dist} onChange={applyDist} variant="default" noExpr />
      {onSpin != null && (
        <Slider labeled label="Auto-spin" min={0} max={40} step={1} value={spin} onChange={onSpin} variant="default" />
      )}
      <div className="flex gap-1 items-center">
        {slots.map((s, i) => (
          <Button
            key={i}
            variant={s ? 'secondary' : 'ghost'}
            size="sm"
            title={s ? 'Recall (shift = overwrite)' : 'Save pose'}
            onClick={(e) => (e.shiftKey || !s) ? saveSlot(i) : recallSlot(i)}
          >
            {i + 1}
          </Button>
        ))}
        <Button variant="primary" size="sm" onClick={reset} className="ml-auto">Reset</Button>
      </div>
    </>
  )

  // `bare` skips the Section wrapper — used when an outer FloatingPanel already
  // provides the titled header (so the "Camera" label isn't doubled).
  return bare
    ? <div className="flex flex-col gap-2 px-3 py-3">{body}</div>
    : <Section label="Camera">{body}</Section>
}
