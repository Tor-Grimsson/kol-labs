import { Routes, Route } from 'react-router-dom'
import PathPage from './PathPage.jsx'
import VariablePage from './VariablePage.jsx'
import MotionPage from './MotionPage.jsx'

// /kinetic router shell (mirrors MathPage / LoopsPage): one routed subpage per
// family. Path is the index. All three share KineticShell + the engine, so they
// live in one chunk — no per-subpage lazy split needed.
export default function KineticPage() {
  return (
    <Routes>
      <Route path="/" element={<PathPage />} />
      <Route path="variable" element={<VariablePage />} />
      <Route path="motion" element={<MotionPage />} />
    </Routes>
  )
}
