import { Route, Routes } from 'react-router-dom'
import ScanlineEditor from './ScanlineEditor.jsx'
import { ALL_SUBPAGES } from './registry.js'

// Scanlines — cumulative-sum variable-density scanline toys. Router shell over
// /scanlines/* (like OpticPage); one routed sub-page per registry entry across
// the three categories. key={s.id} re-seeds the editor on switch.
export default function ScanlinesPage() {
  return (
    <Routes>
      {ALL_SUBPAGES.map((s) => (
        <Route key={s.id} path={s.path} element={<ScanlineEditor key={s.id} page={s} />} />
      ))}
    </Routes>
  )
}
