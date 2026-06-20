// Scene presets — one 3D scene concept (photo plane behind a glass mesh), six
// distinct moods. Each preset SEEDS the whole rig (geometry + material + backdrop
// + camera + finish). LensShell reads these on mount (route key re-seeds on
// switch); the material/post values are pushed per-frame so they stay live.
//
// Fields (all optional; LensShell falls back to the surface defaults):
//   surface       distorters.SURFACE_BY_ID key — the material base
//   shape         glass mesh geom (slab | sphere | torus | crystal)
//   size,distance mesh scale + z-gap to the photo
//   ior,roughness,dispersion,thickness  material character (override the surface)
//   fov,envIntensity  camera + reflection strength
//   tint,tintDistance glass absorption colour + depth
//   bg            solid backdrop colour (shorthand)
//   background    full backdrop object (overrides bg) — solid|linear|radial|glass…
//   filters       post stack { aberration, grain, vignette, bloom } + which are live

export const SCENE_PRESETS = [
  // Clean museum glass — crisp slab, neutral dark, a whisper of bloom.
  { id: 'vitrine', label: 'Vitrine', surface: 'glass', shape: 'slab',
    distance: 1.0, size: 1.0, roughness: 0.04, dispersion: 2, thickness: 1.1,
    fov: 40, envIntensity: 1.3, bg: '#0b0d12',
    filters: { bloom: 0.45 } },

  // Frosted ice crystal — rough, milky, cool, thick.
  { id: 'frost', label: 'Frost', surface: 'ice', shape: 'crystal',
    distance: 1.2, size: 1.1, roughness: 0.6, dispersion: 8, thickness: 1.8,
    fov: 38, envIntensity: 1.7, bg: '#0d1418',
    filters: { grain: 0.08 } },

  // Liquid chrome sphere — mirror metal, bright environment, faint fringing.
  { id: 'chrome', label: 'Chrome', surface: 'metal', shape: 'sphere',
    distance: 0.8, size: 0.95, roughness: 0.12, dispersion: 0, thickness: 1.2,
    fov: 42, envIntensity: 2.4, bg: '#08080a',
    filters: { aberration: 0.5 } },

  // Submerged ring — blue absorption, far gap, vignetted depth.
  { id: 'aquarium', label: 'Aquarium', surface: 'glass', shape: 'torus',
    distance: 1.6, size: 1.2, roughness: 0.08, dispersion: 5, thickness: 1.4,
    fov: 36, envIntensity: 1.2, tint: '#bfe6ff', tintDistance: 3,
    background: { type: 'radial', color: '#0a2436', color2: '#04101a', cx: 0.5, cy: 0.45, radius: 0.9, brightness: 1, opacity: 1 },
    filters: { vignette: 0.5 } },

  // Spectral prism — flat ice face on pure black, dispersion + fringing maxed.
  { id: 'prism', label: 'Prism', surface: 'ice', shape: 'slab',
    distance: 1.1, size: 1.0, ior: 1.5, roughness: 0.05, dispersion: 18, thickness: 1.3,
    fov: 44, envIntensity: 1.9, bg: '#000000',
    filters: { aberration: 1.2 } },

  // Warm portal — ripple ring, glowing edge, amber backdrop.
  { id: 'portal', label: 'Portal', surface: 'ripple', shape: 'torus',
    distance: 1.3, size: 1.1, roughness: 0.12, dispersion: 6, thickness: 1.2,
    fov: 40, envIntensity: 1.5,
    background: { type: 'radial', color: '#3a1606', color2: '#0c0604', cx: 0.5, cy: 0.55, radius: 0.95, brightness: 1, opacity: 1 },
    filters: { bloom: 0.9 } },
]

export const SCENE_BY_ID = Object.fromEntries(SCENE_PRESETS.map((s) => [s.id, s]))
