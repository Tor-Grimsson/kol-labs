/* Engine registry. Add new engines here and they appear in the engine
 * dropdown automatically. */

import { classic } from './classic.js'
import { skeleton } from './skeleton.js'

export const ENGINES = {
  classic:  { label: 'Classic',  render: classic },
  skeleton: { label: 'Skeleton', render: skeleton },
}

export const ENGINE_OPTIONS = Object.entries(ENGINES).map(([k, v]) => ({
  value: k, label: v.label,
}))

export function renderGlyph(engineName, glyphName, params) {
  const engine = ENGINES[engineName] || ENGINES.classic
  const fn = engine.render[glyphName]
  if (!fn) return null
  return fn(params)
}
