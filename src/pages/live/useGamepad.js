import { useEffect, useRef, useState } from 'react'

// Web Gamepad API reader. A controller doesn't appear in navigator.getGamepads()
// until it sends its first input, so the page shows a "press a button" hint until
// `gamepadconnected` fires. We poll on our own rAF and stash the latest snapshot
// in a ref — the page's render loop reads it synchronously each frame (no React
// re-render at 60fps).

// Standard-mapping labels (DualShock 4 / DualSense map to this in Chrome).
export const AXIS_LABELS = ['Left stick X', 'Left stick Y', 'Right stick X', 'Right stick Y']
export const BUTTON_LABELS = [
  'Cross', 'Circle', 'Square', 'Triangle', 'L1', 'R1', 'L2', 'R2',
  'Share', 'Options', 'L3', 'R3', 'D-pad up', 'D-pad down', 'D-pad left', 'D-pad right', 'PS',
]

export function srcLabel(src) {
  if (!src) return ''
  if (src.kind === 'stick-angle') return `${src.index ? 'Right' : 'Left'} stick ∠ (circle)`
  if (src.kind === 'stick-force') return `${src.index ? 'Right' : 'Left'} stick ⊙ (push)`
  if (src.kind === 'axis') return AXIS_LABELS[src.index] ?? `Axis ${src.index}`
  return BUTTON_LABELS[src.index] ?? `Button ${src.index}`
}

const DEADZONE = 0.08
const dead = (v) => (Math.abs(v) < DEADZONE ? 0 : v)

export function useGamepad() {
  const stateRef = useRef({ axes: [], buttons: [] })
  const [connected, setConnected] = useState(false)
  const [padId, setPadId] = useState('')

  useEffect(() => {
    let raf
    const scan = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : []
      let pad = null
      for (const p of pads) { if (p) { pad = p; break } }
      if (pad) {
        stateRef.current = {
          axes: pad.axes.map(dead),
          buttons: pad.buttons.map((b) => ({ pressed: b.pressed, value: b.value })),
        }
      }
      raf = requestAnimationFrame(scan)
    }
    raf = requestAnimationFrame(scan)

    const onConn = (e) => { setConnected(true); setPadId(e.gamepad?.id || 'Controller') }
    const onDisc = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : []
      if (!Array.from(pads).some(Boolean)) {
        setConnected(false); setPadId(''); stateRef.current = { axes: [], buttons: [] }
      }
    }
    window.addEventListener('gamepadconnected', onConn)
    window.addEventListener('gamepaddisconnected', onDisc)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('gamepadconnected', onConn)
      window.removeEventListener('gamepaddisconnected', onDisc)
    }
  }, [])

  return { getState: () => stateRef.current, connected, padId }
}

// Resolve a mapped param's live value from the current pad snapshot.

