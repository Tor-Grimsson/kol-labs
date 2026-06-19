import { Route, Routes } from 'react-router-dom'
import DriftEditor from './DriftEditor.jsx'
import { ALL_SUBPAGES } from './registry.js'

// Drift — seamless motion-loop eyecandy. Router shell over /drift/* (like
// OpticPage/ScanlinesPage); one routed sub-page per registry entry. key={s.id}
// re-seeds the editor on switch.
export default function DriftPage() {
  return (
    <Routes>
      {ALL_SUBPAGES.map((s) => (
        <Route key={s.id} path={s.path} element={<DriftEditor key={s.id} page={s} />} />
      ))}
    </Routes>
  )
}
