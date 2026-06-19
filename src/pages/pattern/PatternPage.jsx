import { Routes, Route } from 'react-router-dom'
import PatternEditor from './PatternEditor.jsx'
import { ALL_SUBPAGES } from './registry.js'

// /pattern router shell (mirrors DriftPage / TypePage): Page › 5 Categories ›
// ~20 sub-pages each. Every sub-page seeds the SAME PatternEditor with a full
// engine config, fully editable from there. The first registry entry owns the
// /pattern index. key={s.id} re-seeds the editor on switch. Routes derive from
// the registry so nav + router never drift.
export default function PatternPage() {
  return (
    <Routes>
      {ALL_SUBPAGES.map((s) => (
        <Route
          key={s.id}
          {...(s.path === '' ? { index: true } : { path: s.path })}
          element={<PatternEditor key={s.id} page={s} />}
        />
      ))}
    </Routes>
  )
}
