import { Routes, Route } from 'react-router-dom'
import LoopsShell from './LoopsShell.jsx'
import { GROUPS } from '../../loops/registry.js'

// /loops router shell (mirrors MathPage / Scanlines): ONE route per CATEGORY
// (Simple · Pattern · Field). The visualisers inside each are presets picked in
// the rail — they switch in-place, no per-preset route. The first category owns
// the /loops index; derived from the registry so nav + router can't drift.
const ROUTES = GROUPS.map((g) => ({ group: g.id, path: g.route === '/loops' ? '' : g.route.replace('/loops/', '') }))

export default function LoopsPage() {
  return (
    <Routes>
      {ROUTES.map(({ group, path }) => (
        <Route
          key={group}
          {...(path === '' ? { index: true } : { path })}
          element={<LoopsShell key={group} group={group} />}
        />
      ))}
    </Routes>
  )
}
