import { Route, Routes } from 'react-router-dom'
import ScanlineEditor from './ScanlineEditor.jsx'

// Scanlines — one cumulative-sum engine in two modes (key re-seeds on switch):
//   /scanlines        → generator, first category (the index)
//   /scanlines/:cat   → generator category (sidebar hops here; presets pick in-rail)
//   /scanlines/filter → filter (image/video/webcam luma)
// The generator routes share key="generator" so switching categories applies in
// place (the editor reads :cat and loads its first preset) without a remount flash.
// `filter` is a static segment so it ranks above the dynamic :cat.
export default function ScanlinesPage() {
  return (
    <Routes>
      <Route path="/" element={<ScanlineEditor key="generator" mode="generator" />} />
      <Route path="filter" element={<ScanlineEditor key="filter" mode="filter" />} />
      <Route path=":cat" element={<ScanlineEditor key="generator" mode="generator" />} />
    </Routes>
  )
}
