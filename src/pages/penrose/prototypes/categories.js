// Prototype categories — exactly TWO content categories, each with 4 even subgroups.
//
//   Foundations  (the 15 round-1 base prototypes, grouped by technique)
//     Packing · Growth · Fields · Layered
//   Territories  (the 100 round-2 prototypes; their 20 research territories,
//                 encoded as `r2-<territory>-NN-name`, folded into 4 domains of 5)
//     Reaction & Life · Flow & Dynamics · Form & Geometry · Pattern & Signal
//
// categoryOf() returns the SUBGROUP key (a foundation subgroup or a territory
// domain) — that's the unit the nav links to and the browse grid filters by.

const LABELS = {
  // Foundations subgroups
  fpack: 'Packing',
  fgrow: 'Growth',
  ffield: 'Fields',
  flayer: 'Layered',
  // Territories subgroups (domains)
  dreact: 'Reaction & Life',
  dflow: 'Flow & Dynamics',
  dform: 'Form & Geometry',
  dpattern: 'Pattern & Signal',
}

// The 15 base prototypes → Foundation subgroup, by technique.
const FOUNDATION_SUB = {
  '01-packing-lloyd': 'fpack', '05-front-pack': 'fpack', '08-quadtree': 'fpack', '09-force-container': 'fpack',
  '02-diffgrow': 'fgrow', '03-space-col': 'fgrow', '06-dla': 'fgrow', '12-l-system': 'fgrow',
  '04-boids': 'ffield', '07-flow-field': 'ffield', '10-reaction-diffusion': 'ffield', '11-attractor': 'ffield',
  '13-layered': 'flayer', '14-layered-erase': 'flayer', '15-triggered': 'flayer',
}

// The 20 round-2 territories → Territory domain (4 domains × 5 territories).
const TERRITORY_DOMAIN = {
  rd: 'dreact', ca: 'dreact', nca: 'dreact', soc: 'dreact', lsys: 'dreact',
  fluid: 'dflow', wave: 'dflow', nbody: 'dflow', attr: 'dflow', phys: 'dflow',
  geom: 'dform', hyp: 'dform', tile: 'dform', topo: 'dform', curve: 'dform',
  frac: 'dpattern', spec: 'dpattern', net: 'dpattern', stoch: 'dpattern', act: 'dpattern',
}

// The subgroup keys for each of the two categories (nav groups).
export const FOUNDATION_KEYS = ['fpack', 'fgrow', 'ffield', 'flayer']
export const TERRITORY_KEYS = ['dreact', 'dflow', 'dform', 'dpattern']

// Display order: Foundations subgroups, then Territories subgroups.
export const CATEGORY_ORDER = [...FOUNDATION_KEYS, ...TERRITORY_KEYS]

export const categoryOf = (id) => {
  const m = /^r2-([a-z]+)-/.exec(id || '')
  if (m) return TERRITORY_DOMAIN[m[1]] || 'dpattern'
  return FOUNDATION_SUB[id] || 'fpack'
}

export const categoryLabel = (key) => LABELS[key] || key
