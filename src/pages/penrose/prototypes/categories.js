// Prototype categories — derived, no per-file edits.
//
// The 100 round-2 prototypes are organized into 20 research "territories" of 5,
// encoded in their ids: `r2-<territory>-NN-name` (e.g. `r2-rd-01-fhn`). The
// base-15 (round 1) carry no prefix and group as "Foundations". categoryOf()
// reads the prefix; the label map names each territory.

const LABELS = {
  foundations: 'Foundations',
  fluid: 'Fluid',
  rd: 'Reaction-Diffusion',
  lsys: 'L-Systems',
  ca: 'Cellular Automata',
  nca: 'Neural CA',
  act: 'Active Matter',
  attr: 'Attractors',
  frac: 'Fractals',
  nbody: 'N-Body',
  wave: 'Waves',
  tile: 'Tiling',
  topo: 'Topology',
  net: 'Networks',
  spec: 'Harmonographs',
  stoch: 'Stochastic',
  soc: 'Sandpiles',
  curve: 'Curve Flows',
  geom: 'Geometry',
  hyp: 'Hyperbolic',
  phys: 'Physical',
}

// Display order: Foundations first, then the territories.
export const CATEGORY_ORDER = [
  'foundations',
  'fluid', 'rd', 'lsys', 'ca', 'nca', 'act', 'attr', 'frac', 'nbody', 'wave',
  'tile', 'topo', 'net', 'spec', 'stoch', 'soc', 'curve', 'geom', 'hyp', 'phys',
]

export const categoryOf = (id) => {
  const m = /^r2-([a-z]+)-/.exec(id || '')
  return m ? m[1] : 'foundations'
}

export const categoryLabel = (key) => LABELS[key] || key
