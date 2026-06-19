// Kinetic scene + element taxonomy — mirrors the Interfaces Screens/Elements model.
// SCENE_GROUPS = the 61 presets organised by visual aesthetic (what they look like).
// ELEMENT_GROUPS = the same presets organised by technical building block.

export const SCENE_GROUPS = [
  { key: 'flood', label: 'Flood' },
  { key: 'ring', label: 'Ring' },
  { key: 'flow', label: 'Flow' },
  { key: 'morph', label: 'Morph' },
  { key: 'wave', label: 'Wave' },
  { key: 'reveal', label: 'Reveal' },
]

export const ELEMENT_GROUPS = [
  { key: 'baseline', label: 'Baseline' },
  { key: 'arcs', label: 'Arcs' },
  { key: 'loops', label: 'Loops' },
  { key: 'angular', label: 'Angular' },
  { key: 'grid', label: 'Grid' },
  { key: 'weight', label: 'Weight' },
  { key: 'width', label: 'Width' },
  { key: 'cascade', label: 'Cascade' },
]

export const sceneCat = (p) => p.scene || 'flood'
export const elemCat = (p) => p.element || 'baseline'
