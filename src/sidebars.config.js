/**
 * Single navigation tree for the labs shell.
 *
 * Leaf shape:
 *   { id: 'about',  label: 'About' }   — page section anchor (#about)
 *   { to: '/about', label: 'About' }   — sub-route link
 * Group shape (no id, no to):
 *   { label: 'Color', children: [...] }
 *
 * Stub: one Home entry. Add a top-level entry here + a matching <Route> in
 * App.jsx as experiments land.
 */

export const NAV_TREE = [
  { id: 'home', label: 'Home', to: '/', icon: 'book-open' },
  { id: 'interfaces', label: 'Interfaces', to: '/interfaces', icon: 'phone', children: [
    { to: '/interfaces', label: 'Generate' },
    { to: '/interfaces/player', label: 'Player' },
    // Browse = the two overview grids (Screens + Elements), switched in-rail.
    { to: '/interfaces/gallery', label: 'Browse', matchPaths: ['/interfaces/gallery', '/interfaces/library'] },
  ] },
  { id: 'penrose', label: 'Penrose', to: '/penrose', icon: 'a-framed' },
  { id: 'radar', label: 'Radar', to: '/radar', icon: 'target-lock', children: [
    { label: 'Halftone', children: [
      { to: '/radar', label: 'Dither' },
      { to: '/radar/ascii', label: 'ASCII' },
    ] },
    { to: '/radar/distort', label: 'Distort' },
  ] },
  { id: 'poster', label: 'Poster', to: '/poster', icon: 'image' },
  { id: 'distress', label: 'Distress', to: '/distress', icon: 'wave' },
  { id: 'layout', label: 'Layout', to: '/layout', icon: 'layout-01', children: [
    { to: '/layout', label: 'Conformed' },
    { to: '/layout/cutting', label: 'Cutting' },
  ] },
  { id: '3d-scene', label: '3D Scene', to: '/3d-scene', icon: 'ball' },
  { id: 'para-type', label: 'Para Type', to: '/para-type', icon: 'aa' },
  { id: 'video', label: 'Video', to: '/video', icon: 'scissors' },
]

/* Find the active top-level page given a pathname. */
export function getActivePage(pathname) {
  if (pathname === '/') return NAV_TREE.find((n) => n.to === '/')
  return NAV_TREE.find((n) => n.to !== '/' && pathname.startsWith(n.to))
}
