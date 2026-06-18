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

import { CATEGORY_ORDER, categoryLabel } from './pages/penrose/prototypes/categories.js'
import { GROUPS as INTERFACE_GROUPS } from './pages/interfaces/widgets/groups.js'

export const NAV_TREE = [
  { id: 'home', label: 'Home', to: '/', icon: 'book-open' },
  { id: 'interfaces', label: 'Interfaces', to: '/interfaces', icon: 'phone', children: [
    { label: 'View', children: [
      { to: '/interfaces', label: 'Generate' },
      { to: '/interfaces/player', label: 'Player' },
      // Screens = the gallery of 50 composed screens (the rail toggles to Elements).
      { to: '/interfaces/gallery', label: 'Screens' },
    ] },
    // Elements = the widget catalog, one entry per widget group (filters the Library).
    { label: 'Elements', children: INTERFACE_GROUPS.map((g) => ({
      to: `/interfaces/library/${g.key}`,
      label: g.label,
    })) },
  ] },
  { id: 'penrose', label: 'Penrose', to: '/penrose', icon: 'a-framed', children: [
    { label: 'View', children: [
      { to: '/penrose', label: 'Full' },
      { to: '/penrose/browse', label: 'Browse' },
    ] },
    { label: 'Categories', children: CATEGORY_ORDER.map((key) => ({
      to: `/penrose/browse/${key}`,
      label: categoryLabel(key),
      // stay active in both browse (/penrose/browse/<cat>) and full (/penrose/<cat>)
      matchPaths: [`/penrose/browse/${key}`, `/penrose/${key}`],
    })) },
  ] },
  { id: 'radar', label: 'Radar', to: '/radar', icon: 'target-lock', children: [
    { label: 'Halftone', children: [
      { to: '/radar', label: 'Dither' },
      { to: '/radar/ascii', label: 'ASCII' },
    ] },
    { label: 'Distort', children: [
      { to: '/radar/distort', label: 'Chromatic' },
    ] },
    { label: 'Synth', children: [
      { to: '/radar/trails', label: 'Trails' },
      { to: '/radar/slitscan', label: 'Slitscan' },
      { to: '/radar/scan', label: 'Scan' },
      { to: '/radar/disco', label: 'Disco' },
    ] },
  ] },
  { id: 'poster', label: 'Poster', to: '/poster', icon: 'image' },
  { id: 'distress', label: 'Distress', to: '/distress', icon: 'wave' },
  { id: 'layout', label: 'Layout', to: '/layout', icon: 'layout-01', children: [
    { to: '/layout', label: 'Conformed' },
    { to: '/layout/cutting', label: 'Cutting' },
  ] },
  { id: '3d-scene', label: '3D Scene', to: '/3d-scene', icon: 'ball', children: [
    { to: '/3d-scene', label: 'Gradient' },
    { to: '/3d-scene/primitive', label: 'Primitive Scene' },
  ] },
  // Loops = the base-motion library — a router shell with one subpage per GROUP.
  // Each subpage lists its own PRESETS in the rail's Presets tab (no per-loop
  // routes — routes are per family). Feeds effects (P4).
  { id: 'loops', label: 'Loops', to: '/loops', icon: 'cycle', children: [
    { to: '/loops', label: 'Simple' },
    { to: '/loops/pattern', label: 'Pattern' },
    { to: '/loops/field', label: 'Field' },
  ] },
  // Kinetic = typography: type-on-path · variable-font animation · per-glyph
  // motion. Router shell, one engine, three families (no per-effect routes).
  { id: 'kinetic', label: 'Kinetic', to: '/kinetic', icon: 'font-01', children: [
    { to: '/kinetic', label: 'Path' },
    { to: '/kinetic/variable', label: 'Variable' },
    { to: '/kinetic/motion', label: 'Motion' },
  ] },
  { id: 'para-type', label: 'Para Type', to: '/para-type', icon: 'aa' },
  { id: 'video', label: 'Video', to: '/video', icon: 'scissors' },
  { id: 'math', label: 'Math', to: '/math', icon: 'math', children: [
    { to: '/math', label: 'Expression' },
    { to: '/math/uzumaki', label: 'Uzumaki' },
    { to: '/math/animate', label: 'Animate' },
    { to: '/math/attractor', label: 'Attractor' },
    { to: '/math/surface', label: 'Surface' },
    { to: '/math/field', label: 'Field' },
    { to: '/math/complex', label: 'Complex' },
    { to: '/math/fourier', label: 'Fourier' },
  ] },
]

/* Find the active top-level page given a pathname. */
export function getActivePage(pathname) {
  if (pathname === '/') return NAV_TREE.find((n) => n.to === '/')
  return NAV_TREE.find((n) => n.to !== '/' && pathname.startsWith(n.to))
}
