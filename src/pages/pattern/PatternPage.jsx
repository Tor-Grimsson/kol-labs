import { useLocation } from 'react-router-dom'
import PatternEditor from './PatternEditor.jsx'
import { ALL_SUBPAGES } from './registry.js'

// /pattern shell. ONE persistent PatternEditor, NOT a per-route element: the
// current sub-page is derived from the URL so navigating between presets updates
// the `page` prop in place (no remount) — that's what keeps the rail tab + the
// animation/motion layer intact when you switch the Pattern preset (Org/Polka).
// PatternEditor re-seeds only the structural params on a page change. Routes stay
// deep-linkable (the preset dropdown still navigates); the registry owns the map.
export default function PatternPage() {
  const { pathname } = useLocation()
  const page = ALL_SUBPAGES.find((s) => s.route === pathname) || ALL_SUBPAGES[0]
  return <PatternEditor page={page} />
}
