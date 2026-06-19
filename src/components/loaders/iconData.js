/* Icon data — the eager SVG maps, isolated in their own module.
 *
 * This file is reached ONLY via the dynamic `import('./iconData.js')` in Icon.jsx,
 * so rolldown splits it (and the ~1.2 MB of inlined `?raw` SVG text) into its own
 * async chunk instead of inlining it into the entry chunk. That keeps first paint
 * fast — the icon map streams in parallel with the first route. Never static-import
 * this file, or the strings collapse back into whatever chunk imports it. */

const strokeModules = import.meta.glob('./stroke/**/*.svg',  { eager: true, query: '?raw', import: 'default' })
const solidModules  = import.meta.glob('./solid/**/*.svg',   { eager: true, query: '?raw', import: 'default' })
const legacyModules = import.meta.glob('./svg/**/*.svg',     { eager: true, query: '?raw', import: 'default' })
const kolLegacy     = import.meta.glob('./svg/00-kol/*.svg', { eager: true, query: '?raw', import: 'default' })
const webModules    = import.meta.glob('./svg-web/**/*.svg', { eager: true, query: '?raw', import: 'default' })

const byName = (mods) => {
  const c = {}
  for (const [path, svg] of Object.entries(mods)) {
    c[(path.split('/').pop() || '').replace('.svg', '')] = svg
  }
  return c
}

export const STROKE = byName(strokeModules)
export const SOLID  = byName(solidModules)
export const WEB    = byName(webModules)
export const LEGACY = (() => { const c = byName(legacyModules); Object.assign(c, byName(kolLegacy)); return c })()
