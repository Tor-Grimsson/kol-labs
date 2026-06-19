import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ClipEditor from '../uzumaki/components/ClipEditor'
import { mulberry32, randomSeed } from '../../../lib/rng.js'

const TAU = Math.PI * 2

// A few polar curves the Randomise button can re-seed the clip from (the page
// is normally fed by a forwarded expression, but Randomise needs its own pool).
const RANDOM_EXPRS = ['3*sin(6*θ)', '4*sin(24*θ/25) + 10', '3*sin(6.08*θ)', '0.5*θ', 'exp(0.15*θ)', '3 + sin(5*θ)']

// Build a uzumaki clip from forwarded query params. Two mappings of an authored
// expression into a curve:
//   polar    — the scalar IS the radius r(θ) (θ = sweep). Single expr.
//   param2d  — x(t), y(t) from two exprs (Lissajous / butterfly / any 2D
//              parametric figure). The oscilloscope forwards a single expr as
//              the GRAPH form x=t, y=f(t); true x/y is editable in the Curve tab.
// A 3D height-ribbon mapping can extend the switch later.
//
// The id embeds the expressions so re-forwarding re-seeds ClipEditor (which
// drops edits when baseClip.id changes).
const COMMON = {
  title: 'animate',
  space: '2D',
  show: { trace: true },
  style: { color: '#9ec1ff', weight: 1.6 },
  modifiers: { repeat: 1, spiral: 0 },
  timeline: [
    { at: 0, draw: 0, cam: { yaw: -20, pitch: 18, zoom: 1 }, ease: 'inout' },
    { at: 6, draw: 1, cam: { yaw: 20, pitch: 12, zoom: 1 }, ease: 'inout' },
    { at: 9, draw: 1, cam: { yaw: 0, pitch: 30, zoom: 1 }, ease: 'inout' },
  ],
}

function synthClip({ map, expr, x, y }) {
  if (map === 'param2d') {
    const xe = (x && x.trim()) || 'sin(3*t)'
    const ye = (y && y.trim()) || 'sin(2*t + 0.6)'
    return { ...COMMON, id: `animate:param2d:${xe}|${ye}`, ref: `x=${xe}, y=${ye}`, curve: { kind: 'param2d', range: [0, TAU], x: xe, y: ye } }
  }
  const e = (expr && expr.trim()) || '3*sin(6*θ)'
  return { ...COMMON, id: `animate:polar:${e}`, ref: `r(θ) = ${e}`, curve: { kind: 'polar', range: [0, 6 * TAU], r: e } }
}

// Math · Animate — takes an expression forwarded from the oscilloscope page
// (?expr=…&map=polar, or ?x=…&y=…&map=param2d) and animates it through the full
// uzumaki clip harness (copies / spiral / camera movement / style). The whole
// control surface is reused from ClipEditor; this page only synthesizes the seed.
export default function AnimatePage() {
  const [params] = useSearchParams()
  const qMap = params.get('map') || 'polar'
  const qExpr = params.get('expr') || ''
  const qX = params.get('x') || ''
  const qY = params.get('y') || ''
  // `over` lets Randomise / Import replace the forwarded query without navigating.
  const [over, setOver] = useState(null)
  const [seed, setSeed] = useState(1)
  const map = over?.map ?? qMap
  const expr = over?.expr ?? qExpr
  const x = over?.x ?? qX
  const y = over?.y ?? qY
  const baseClip = useMemo(() => synthClip({ map, expr, x, y }), [map, expr, x, y])

  // Randomise → re-seed the clip with a random polar expression.
  const rollFrom = (s) => {
    const rng = mulberry32(s)
    const e = RANDOM_EXPRS[Math.floor(rng() * RANDOM_EXPRS.length)]
    setOver({ map: 'polar', expr: e, x: '', y: '' })
  }
  const onRandomize = () => { const s = randomSeed(); setSeed(s); rollFrom(s) }
  const getExtraSettings = () => ({ map, expr, x, y })
  const applyExtraSettings = (st) => {
    if (st.map != null || st.expr != null || st.x != null || st.y != null) {
      setOver({ map: st.map ?? map, expr: st.expr ?? expr, x: st.x ?? x, y: st.y ?? y })
    }
  }

  return (
    <ClipEditor
      baseClip={baseClip}
      headerLabel="Animate"
      settingsPage="math-animate"
      onRandomize={onRandomize}
      seed={seed}
      onSeed={(n) => { setSeed(n); rollFrom(n) }}
      getExtraSettings={getExtraSettings}
      applyExtraSettings={applyExtraSettings}
    />
  )
}
