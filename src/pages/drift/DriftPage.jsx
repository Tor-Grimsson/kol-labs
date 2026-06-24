import { Route, Routes } from 'react-router-dom'
import DriftEditor from './DriftEditor.jsx'
import { CATEGORIES } from './registry.js'

// Drift — Page › Category › Preset (like scanlines/loops). One routed CATEGORY per
// family; the 6 presets inside switch in the rail's Preset dropdown. First category
// (air) owns /drift; the rest are /drift/<cat>. key re-seeds the editor per family.
export default function DriftPage() {
  return (
    <Routes>
      {CATEGORIES.map((c) => (
        <Route key={c.id} path={c.id === CATEGORIES[0].id ? '/' : c.id} element={<DriftEditor key={c.id} category={c.id} />} />
      ))}
    </Routes>
  )
}
