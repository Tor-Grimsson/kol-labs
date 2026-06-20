import { Route, Routes } from 'react-router-dom'
import ScanlineEditor from './ScanlineEditor.jsx'

// Scanlines — one cumulative-sum engine in two modes (key re-seeds on switch):
//   /scanlines        → generator (procedural field)
//   /scanlines/filter → filter (image/video/webcam luma)
export default function ScanlinesPage() {
  return (
    <Routes>
      <Route path="/" element={<ScanlineEditor key="generator" mode="generator" />} />
      <Route path="filter" element={<ScanlineEditor key="filter" mode="filter" />} />
    </Routes>
  )
}
