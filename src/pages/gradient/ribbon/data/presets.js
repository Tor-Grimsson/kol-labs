export const RIBBON_PRESETS = [
  // Classic 3-loop fold, moderate curl — the reference "Puddle" silhouette.
  { id: 'cascade', label: 'Cascade', seed: 3, loops: 3, height: 2.2, gap: 0.92, depth: 0.35, curl: 1.0, width: 0.50, ribbonThickness: 0.12, corner: 0.045, material: 'glass' },
  // Very tall 4-loop tower, tight gap, minimal curl — vertical column read.
  { id: 'tower', label: 'Tower', seed: 17, loops: 4, height: 2.9, gap: 0.70, depth: 0.26, curl: 0.5, width: 0.44, ribbonThickness: 0.11, corner: 0.04, material: 'chrome' },
  // Single deep plunge with heavy inward curl — dropped-ribbon drape.
  { id: 'plunge', label: 'Plunge', seed: 23, loops: 1, height: 2.5, gap: 1.0, depth: 0.62, curl: 1.9, width: 0.55, ribbonThickness: 0.13, corner: 0.05, material: 'glass' },
  // 2 loops, deep z-offset, wide ribbon — gives a braided double-layer look.
  { id: 'braid', label: 'Braid', seed: 41, loops: 2, height: 1.9, gap: 0.88, depth: 0.72, curl: 0.8, width: 0.64, ribbonThickness: 0.14, corner: 0.055, material: 'chrome' },
  // 5 short loops spread low — flat fan, reads wide not tall.
  { id: 'fan', label: 'Fan', seed: 7, loops: 5, height: 1.5, gap: 0.66, depth: 0.20, curl: 0.35, width: 0.46, ribbonThickness: 0.10, corner: 0.036, material: 'glass' },
  // 1 loop into a very tight double-spiral curl — a compressed spring.
  { id: 'coil', label: 'Coil', seed: 5, loops: 1, height: 1.5, gap: 0.95, depth: 0.38, curl: 2.3, width: 0.54, ribbonThickness: 0.13, corner: 0.05, material: 'glass' },
  // 2 very tall asymmetric loops, pronounced z-depth — a lopsided arch.
  { id: 'arch', label: 'Arch', seed: 61, loops: 2, height: 3.1, gap: 1.12, depth: 0.48, curl: 1.1, width: 0.48, ribbonThickness: 0.115, corner: 0.042, material: 'chrome' },
  // 4 loops, heavy z-wave — the most three-dimensional weave in the set.
  { id: 'wave', label: 'Wave', seed: 13, loops: 4, height: 1.8, gap: 0.78, depth: 0.80, curl: 0.9, width: 0.50, ribbonThickness: 0.12, corner: 0.045, material: 'glass' },
  // 3 tight loops + heavy curl — ribbon folds into itself at the tip.
  { id: 'knot', label: 'Knot', seed: 37, loops: 3, height: 2.0, gap: 0.62, depth: 0.30, curl: 1.7, width: 0.42, ribbonThickness: 0.10, corner: 0.036, material: 'glass' },
  // 2 loops, very wide flat slab ribbon (thin) — almost like bent sheet metal.
  { id: 'slab', label: 'Slab', seed: 29, loops: 2, height: 2.5, gap: 1.02, depth: 0.28, curl: 0.5, width: 0.86, ribbonThickness: 0.065, corner: 0.022, material: 'chrome' },
]

export const DEFAULT_RIBBON = RIBBON_PRESETS[0]
