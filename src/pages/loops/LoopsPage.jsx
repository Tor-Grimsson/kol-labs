import { Routes, Route } from 'react-router-dom'
import SimpleLoopsPage from './SimpleLoopsPage.jsx'
import PatternLoopsPage from './PatternLoopsPage.jsx'
import FieldLoopsPage from './FieldLoopsPage.jsx'

// /loops router shell (mirrors MathPage / ThreeDScenePage): one routed subpage per
// loop GROUP. Simple is the index. All three share LoopsShell + the (eager) loop
// registry, so they live in one chunk — no per-subpage lazy split needed.
export default function LoopsPage() {
  return (
    <Routes>
      <Route path="/" element={<SimpleLoopsPage />} />
      <Route path="pattern" element={<PatternLoopsPage />} />
      <Route path="field" element={<FieldLoopsPage />} />
    </Routes>
  )
}
