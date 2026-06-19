import { Routes, Route } from 'react-router-dom'
import LoopsShell from './LoopsShell.jsx'
import { SUBGROUPS } from '../../loops/registry.js'

// /loops router shell (mirrors MathPage / ThreeDScenePage): three CATEGORIES, each
// with six routed SUB-PAGES. Every sub-page is one scoped LoopsShell (group + sub);
// the routes are derived from the registry's SUBGROUPS so nav + router never drift.
// All share LoopsShell + the (eager) loop registry, so they live in one chunk.
const ROUTES = Object.entries(SUBGROUPS).flatMap(([group, subs]) =>
  subs.map((s) => ({ group, sub: s.sub, path: s.path })),
)

export default function LoopsPage() {
  return (
    <Routes>
      {ROUTES.map(({ group, sub, path }) => (
        <Route
          key={`${group}/${sub}`}
          {...(path === '' ? { index: true } : { path })}
          element={<LoopsShell key={`${group}/${sub}`} group={group} sub={sub} />}
        />
      ))}
    </Routes>
  )
}
