// The Lens surfaces — one sub-page each (see LensShell). Each seeds the glass
// MeshPhysicalMaterial: a physical-glass / metal preset. `geom` = the default
// glass mesh shape for that character.
export const SURFACES = [
  { id: 'glass', label: 'Glass', geom: 'slab',
    mat: { transmission: 1, ior: 1.5, roughness: 0.05, dispersion: 3, metalness: 0 } },
  { id: 'ice', label: 'Ice', geom: 'crystal',
    mat: { transmission: 1, ior: 1.31, roughness: 0.45, dispersion: 9, metalness: 0 } },
  { id: 'metal', label: 'Liquid Metal', geom: 'sphere',
    mat: { transmission: 0, ior: 1.5, roughness: 0.18, dispersion: 0, metalness: 1 } },
  { id: 'mirror', label: 'Mirror', geom: 'slab',
    mat: { transmission: 0, ior: 1.5, roughness: 0.02, dispersion: 0, metalness: 1 } },
  { id: 'ripple', label: 'Ripple', geom: 'torus',
    mat: { transmission: 1, ior: 1.4, roughness: 0.12, dispersion: 5, metalness: 0 } },
]

export const SURFACE_BY_ID = Object.fromEntries(SURFACES.map((s) => [s.id, s]))

// Glass mesh shapes the user can pick on any surface.
export const GLASS_SHAPES = [
  { value: 'slab', label: 'Slab' },
  { value: 'sphere', label: 'Sphere' },
  { value: 'torus', label: 'Ring' },
  { value: 'crystal', label: 'Crystal' },
]
