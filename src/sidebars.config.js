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
  { id: 'interfaces', label: 'Interfaces', to: '/interfaces', icon: 'phone' },
  { id: 'glyph-lab', label: 'Glyph Lab', to: '/glyph-lab', icon: 'a-framed' },
  { id: 'radar', label: 'Radar', to: '/radar', icon: 'target-lock' },
  { id: 'poster', label: 'Poster', to: '/poster', icon: 'image' },
  { id: 'distress', label: 'Distress', to: '/distress', icon: 'wave' },
  { id: 'layout', label: 'Layout', to: '/layout', icon: 'layout-01' },
  { id: 'gradient', label: 'Gradient', to: '/gradient', icon: 'ball' },
  { id: 'para-type', label: 'Para Type', to: '/para-type', icon: 'aa' },
]

/* Find the active top-level page given a pathname. */
export function getActivePage(pathname) {
  if (pathname === '/') return NAV_TREE.find((n) => n.to === '/')
  return NAV_TREE.find((n) => n.to !== '/' && pathname.startsWith(n.to))
}
