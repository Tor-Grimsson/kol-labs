import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import LiveEditor from './LiveEditor.jsx'
import { EXAMPLES } from './audio/examples.js'

// Modulation — Page > Category shell. Controllers (the gamepad FX-jam editor)
// and Audio (the example gallery, Signals + Reactive) mount under /live/*; MIDI
// lands as a sibling Controllers child in a later phase. The audio scaffold is
// lazy so the default Controllers route doesn't bundle it.
const AudioExample = lazy(() => import('./audio/AudioExample.jsx'))

export default function LivePage() {
  return (
    <Routes>
      <Route path="/" element={<LiveEditor />} />
      <Route path="controllers" element={<LiveEditor />} />
      <Route path="audio" element={<Navigate to={`/live/audio/${EXAMPLES[0].id}`} replace />} />
      <Route
        path="audio/:exampleId"
        element={
          <Suspense fallback={<div className="min-h-dvh bg-surface-secondary" />}>
            <AudioExample />
          </Suspense>
        }
      />
    </Routes>
  )
}
