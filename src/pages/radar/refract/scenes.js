// Scene presets — one 3D scene concept (photo plane behind a glass mesh), six
// distinct SETTINGS moods. Each page seeds these scene-level values (surface +
// background + depth + camera + look); the glass material stays live-switchable
// via the floating MaterialMenu. `surface` keys map to distorters.SURFACE_BY_ID.

export const SCENE_PRESETS = [
  { id: 'vitrine', label: 'Vitrine', surface: 'glass', bg: '#0b0d12', distance: 1.0, size: 1.0, envIntensity: 1.3, fov: 40 },
  { id: 'frost', label: 'Frost', surface: 'ice', bg: '#0d1418', distance: 1.2, size: 1.1, envIntensity: 1.7, fov: 38 },
  { id: 'chrome', label: 'Chrome', surface: 'metal', bg: '#08080a', distance: 0.8, size: 0.95, envIntensity: 2.1, fov: 42 },
  { id: 'aquarium', label: 'Aquarium', surface: 'glass', bg: '#06141a', distance: 1.6, size: 1.2, envIntensity: 1.2, fov: 36, tint: '#bfe6ff', tintDistance: 3 },
  { id: 'prism', label: 'Prism', surface: 'ice', bg: '#000000', distance: 1.1, size: 1.0, envIntensity: 1.9, fov: 44 },
  { id: 'portal', label: 'Portal', surface: 'ripple', bg: '#140a0a', distance: 1.3, size: 1.1, envIntensity: 1.5, fov: 40 },
]

export const SCENE_BY_ID = Object.fromEntries(SCENE_PRESETS.map((s) => [s.id, s]))
