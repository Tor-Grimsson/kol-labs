import { Route, Routes } from 'react-router-dom'
import TypeEditor from './TypeEditor.jsx'
import { ALL_SUBPAGES } from './registry.js'

// Type — router shell over /type/* (mirrors drift/scanlines). `/type` is the blank
// typesetting canvas; each registry sub-page seeds the SAME editor with a loop
// composition. key={s.id} re-seeds the editor on switch.
export default function TypePage() {
  return (
    <Routes>
      <Route index element={<TypeEditor key="blank" page={null} />} />
      {ALL_SUBPAGES.map((s) => (
        <Route key={s.id} path={s.path} element={<TypeEditor key={s.id} page={s} />} />
      ))}
    </Routes>
  )
}
