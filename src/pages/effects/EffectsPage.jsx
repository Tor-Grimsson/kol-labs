import { useState, useRef } from 'react'
import { Routes, Route } from 'react-router-dom'
import { defaultAspectFor, DEFAULT_SCALE } from '../_shared/exportSpecs.js'
import { EFFECT_GROUPS } from './effects.config.js'
import EffectsEditor from './EffectsEditor.jsx'
import { defaultAutoplay } from '../../lib/appSettings.js'

// Effects — a Radar effect family, mounted at /radar/effects/* inside Radar's
// ImageProvider (so the uploaded source is shared with every other Radar effect:
// upload once, apply any effect). Router shell: one sub-page per effect CATEGORY
// (first group is the index). ALL editing state lives HERE, above the <Routes>,
// so the layer stack + amount + motion + export settings persist as you switch
// categories — the category only scopes the picker.
export default function EffectsShell() {
  const [stack, setStack] = useState([]) // [{ type, enabled, params }] — shared across categories
  const [amount, setAmount] = useState(100) // 0 = raw → 100 = full stack
  const [sweeps, setSweeps] = useState([]) // motion (Radar sweep shape)
  const [animating, setAnimating] = useState(false)
  const [tempo, setTempo] = useState(120) // 120 BPM = realtime; speed = tempo/120
  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const timeRef = useRef(0)
  const [exportAspect, setExportAspect] = useState(() => defaultAspectFor('source'))
  const [exportScale, setExportScale] = useState(DEFAULT_SCALE)
  const [exportFit, setExportFit] = useState('cover')

  const shared = {
    stack, setStack,
    amount, setAmount,
    sweeps, setSweeps,
    animating, setAnimating,
    tempo, setTempo,
    playing, setPlaying,
    timeRef,
    exportAspect, setExportAspect,
    exportScale, setExportScale,
    exportFit, setExportFit,
  }

  return (
    <Routes>
      {EFFECT_GROUPS.map((g, i) => (
        <Route
          key={g.id}
          path={i === 0 ? '/' : g.id}
          element={<EffectsEditor group={g.id} {...shared} />}
        />
      ))}
    </Routes>
  )
}
