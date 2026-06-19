/**
 * Single navigation tree for the labs shell.
 *
 * Node shapes:
 *   { section: 'Label' }               — top-level section header (no link)
 *   { id, label, to, icon, children }  — a page hop (+ optional sub-tree)
 * Sub-tree leaf / group shapes:
 *   { id: 'about',  label: 'About' }   — page section anchor (#about)
 *   { to: '/about', label: 'About' }   — sub-route link
 *   { label: 'View', children: [...] } — labeled group
 *
 * Order groups by what you're MAKING: the first three groups generate from
 * nothing; "Source-in" pages take a media input (upload, or the CDN library).
 * Add a top-level entry here + a matching <Route> in App.jsx.
 */

import { categoryLabel, FOUNDATION_KEYS, TERRITORY_KEYS } from './pages/penrose/prototypes/categories.js'
import { GROUPS as INTERFACE_GROUPS } from './pages/interfaces/widgets/groups.js'
import { SCREEN_GROUPS } from './pages/interfaces/screens.groups.js'
import { EFFECT_GROUPS } from './pages/effects/effects.config.js'
import { SCENE_GROUPS, ELEMENT_GROUPS } from './pages/kinetic/scenes/groups.js'

export const NAV_TREE = [
  { id: 'home', label: 'Home', to: '/', icon: 'book-open' },
  { id: 'library', label: 'Library', to: '/library', icon: 'image' },
  { id: 'gallery', label: 'Gallery', to: '/gallery', icon: 'layout-01' },
  { id: 'radar', label: 'Radar', to: '/radar', icon: 'target-lock', children: [
    { label: 'Halftone', children: [
      { to: '/radar/ascii', label: 'ASCII' },
      { to: '/radar', label: 'Dither' },
    ] },
    { label: 'Distortion', children: [
      { to: '/radar/distort', label: 'Chromatic' },
      { to: '/radar/refract', label: 'Refract' },
    ] },
    { label: 'Synth', children: [
      { to: '/radar/trails', label: 'Trails' },
      { to: '/radar/slitscan', label: 'Slitscan' },
      { to: '/radar/scan', label: 'Scan' },
      { to: '/radar/disco', label: 'Disco' },
    ] },
    { label: 'Effects', children: EFFECT_GROUPS.map((g, i) => ({
      to: i === 0 ? '/radar/effects' : `/radar/effects/${g.id}`,
      label: g.label,
    })) },
  ] },

  { section: 'Generative' },
  { id: 'interfaces', label: 'Interfaces', to: '/interfaces', icon: 'phone', children: [
    { label: 'View', children: [
      { to: '/interfaces/generate', label: 'Generate' },
      { to: '/interfaces/player', label: 'Player' },
    ] },
    // Screens = the gallery of 50 composed screens, grouped by content category.
    { label: 'Screens', children: SCREEN_GROUPS.map((g) => ({
      to: `/interfaces/gallery/${g.key}`,
      label: g.label,
    })) },
    // Elements = the widget catalog, one entry per widget group (filters the Library).
    { label: 'Elements', children: INTERFACE_GROUPS.map((g) => ({
      to: `/interfaces/library/${g.key}`,
      label: g.label,
    })) },
  ] },
  { id: 'penrose', label: 'Penrose', to: '/penrose', icon: 'a-framed', children: [
    { label: 'View', children: [
      { to: '/penrose/generate', label: 'Generate' },
      { to: '/penrose/player', label: 'Player' },
    ] },
    // Two big content categories (mirrors interfaces' Screens + Elements):
    // Foundations = the 15 base prototypes, grouped by technique; Territories =
    // the 100 round-2 prototypes grouped into their 20 research territories.
    // Exactly two content categories, four even subgroups each.
    { label: 'Foundations', children: FOUNDATION_KEYS.map((key) => ({
      to: `/penrose/browse/${key}`,
      label: categoryLabel(key),
      matchPaths: [`/penrose/browse/${key}`],
    })) },
    { label: 'Territories', children: TERRITORY_KEYS.map((key) => ({
      to: `/penrose/browse/${key}`,
      label: categoryLabel(key),
      matchPaths: [`/penrose/browse/${key}`],
    })) },
  ] },
  { id: 'kinetic', label: 'Kinetic', to: '/kinetic', icon: 'font-01', children: [
    { label: 'View', children: [
      { to: '/kinetic/generate', label: 'Generate' },
      { to: '/kinetic/player',   label: 'Player' },
    ] },
    { label: 'Scenes', children: SCENE_GROUPS.map((g) => ({
      to: `/kinetic/gallery/${g.key}`,
      label: g.label,
    })) },
    { label: 'Elements', children: ELEMENT_GROUPS.map((g) => ({
      to: `/kinetic/library/${g.key}`,
      label: g.label,
    })) },
  ] },

  { id: 'math', label: 'Math', to: '/math', icon: 'math', children: [
    { to: '/math', label: 'Expression' },
    { to: '/math/uzumaki', label: 'Uzumaki' },
    { to: '/math/animate', label: 'Animate' },
    { to: '/math/attractor', label: 'Attractor' },
    { to: '/math/surface', label: 'Surface' },
    { to: '/math/field', label: 'Field' },
    { to: '/math/complex', label: 'Complex' },
    { to: '/math/fourier', label: 'Fourier' },
    { to: '/math/orbits', label: 'Orbits' },
  ] },
  { id: 'loops', label: 'Loops', to: '/loops', icon: 'cycle', children: [
    { to: '/loops', label: 'Simple' },
    { to: '/loops/pattern', label: 'Pattern' },
    { to: '/loops/field', label: 'Field' },
  ] },
  { id: '3d-scene', label: '3D Scene', to: '/3d-scene', icon: 'ball', children: [
    { to: '/3d-scene', label: 'Gradient' },
    { to: '/3d-scene/primitive', label: 'Primitive Scene' },
    { to: '/3d-scene/forms', label: 'Forms' },
  ] },
  { id: 'optic', label: 'Optic', to: '/optic', icon: 'ptrn-dot', children: [
    { to: '/optic', label: 'Halftone' },
    { to: '/optic/gradient-field', label: 'Mesh Gradient' },
    { to: '/optic/moire', label: 'Moiré' },
    { to: '/optic/reaction', label: 'Reaction' },
  ] },

  { section: 'Source-in' },
  { id: 'poster', label: 'Poster', to: '/poster', icon: 'image' },
  { id: 'video', label: 'Video', to: '/video', icon: 'scissors' },

  { section: 'Vector shapes' },
  { id: 'para-type', label: 'Para Type', to: '/para-type', icon: 'aa' },
  { id: 'distress', label: 'Distress', to: '/distress', icon: 'wave' },
]

/* Find the active top-level page given a pathname. Section headers have no `to`. */
export function getActivePage(pathname) {
  if (pathname === '/') return NAV_TREE.find((n) => n.to === '/')
  return NAV_TREE.find((n) => n.to && n.to !== '/' && pathname.startsWith(n.to))
}
