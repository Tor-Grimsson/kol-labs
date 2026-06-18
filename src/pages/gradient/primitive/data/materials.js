// Material types the engine can build. The color/roughness/metalness/flat
// controls apply where the type supports them (Normal ignores colour; Glass
// forces transmission). No external assets — Toon bands without a gradient map,
// environment lighting comes from a procedural RoomEnvironment.
export const MATERIAL_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'phong', label: 'Phong' },
  { value: 'toon', label: 'Toon' },
  { value: 'normal', label: 'Normal' },
  { value: 'glass', label: 'Glass' },
]
