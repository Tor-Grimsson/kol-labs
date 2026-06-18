// Simple (shape) loops — the base draw-fn modules + the picker presets. A preset
// names a base loop + a partial param override; the picker lists presets, the
// player resolves `{...loopDefaults(loop), ...preset.params}`. Add a base loop to
// SHAPE_LOOPS, add picker entries to SHAPE_PRESETS.

import morphCircle from './morphCircle.js'
import squareToCircle from './squareToCircle.js'
import barsWave from './barsWave.js'
import ringPulse from './ringPulse.js'
import lissajous from './lissajous.js'
import spiral from './spiral.js'
import starMorph from './starMorph.js'
import orbitDots from './orbitDots.js'
import waveGrid from './waveGrid.js'
import checkerPulse from './checkerPulse.js'
import arcSweep from './arcSweep.js'
import concentricArcs from './concentricArcs.js'
import rose from './rose.js'
import gridRotor from './gridRotor.js'
import blob from './blob.js'
import radialBars from './radialBars.js'

export const SHAPE_LOOPS = [
  morphCircle, squareToCircle, barsWave, ringPulse, lissajous, spiral,
  starMorph, orbitDots, waveGrid, checkerPulse, arcSweep, concentricArcs,
  rose, gridRotor, blob, radialBars,
]

const P = (id, label, loop, params = {}, sub) => ({ id, label, loop, params, sub })

export const SHAPE_PRESETS = [
  // Discs & polygons
  P('circle-morph', 'Circle morph', 'morph-circle', {}, 'Discs & polygons'),
  P('circle-warm', 'Circle morph · ember', 'morph-circle', { colA: '#f6c453', colB: '#7a1f12' }, 'Discs & polygons'),
  P('square-circle', 'Square ↔ circle', 'square-circle', {}, 'Discs & polygons'),
  P('star-classic', 'Star morph', 'star-morph', {}, 'Discs & polygons'),
  P('star-7', 'Heptagram', 'star-morph', { points: 7, colB: '#3a6ea5' }, 'Discs & polygons'),
  P('blob-soft', 'Blob', 'blob', {}, 'Discs & polygons'),
  P('blob-spiky', 'Blob · spiky', 'blob', { amp: 0.34, lobes: 6, colA: '#2a8f8f', colB: '#f4f1ea' }, 'Discs & polygons'),
  // Curves
  P('lissajous-32', 'Lissajous 3:2', 'lissajous', { a: 3, b: 2 }, 'Curves'),
  P('lissajous-54', 'Lissajous 5:4', 'lissajous', { a: 5, b: 4, dot: '#7fd1ff' }, 'Curves'),
  P('spiral-arch', 'Spiral', 'spiral', {}, 'Curves'),
  P('spiral-tight', 'Spiral · tight', 'spiral', { turns: 8, spin: 2, colB: '#c2502e' }, 'Curves'),
  P('rose-5', 'Rose · 5', 'rose-curve', { k: 5 }, 'Curves'),
  P('rose-4', 'Rose · 4', 'rose-curve', { k: 4, colB: '#c2502e' }, 'Curves'),
  // Rings & sweeps
  P('ring-pulse', 'Ring pulse', 'ring-pulse', {}, 'Rings & sweeps'),
  P('arc-sweep', 'Arc sweep', 'arc-sweep', {}, 'Rings & sweeps'),
  P('arc-double', 'Arc sweep · double', 'arc-sweep', { turns: 2, sweep: '#f6c453' }, 'Rings & sweeps'),
  P('concentric', 'Concentric arcs', 'concentric-arcs', {}, 'Rings & sweeps'),
  P('radial-bars', 'Radial bars', 'radial-bars', {}, 'Rings & sweeps'),
  P('orbit-dots', 'Orbit dots', 'orbit-dots', {}, 'Rings & sweeps'),
  // Grids
  P('bars-wave', 'Bars wave', 'bars-wave', {}, 'Grids'),
  P('wave-grid', 'Wave grid', 'wave-grid', {}, 'Grids'),
  P('checker-pulse', 'Checker pulse', 'checker-pulse', {}, 'Grids'),
  P('grid-rotor', 'Grid rotor', 'grid-rotor', {}, 'Grids'),
]
