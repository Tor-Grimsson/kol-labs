import { PAL } from './_helpers.js'

// WEAVE — true over/under interlacing (render:'weave'). The warp (vertical) and weft
// (horizontal) ribbons cross, and a `weaveType` parity decides which passes OVER at
// each crossing — real z-ordering, not a fake opacity check.
//   weaveType   plain · twill · satin · basket       strandWidth  ribbon width (× cell)
//   color = warp · color2 = weft · bg = gaps         cols/rows/cell/gap = the lattice
// camFlow travels the over/under boundary diagonally; Motion Form pulses/fades the
// crossings (both whole cycles ⇒ seamless). The shape-engine tessellations that merely
// LOOK woven (herringbone, lattice, chainlink, …) live in the Interlace category.

const weave = (o) => ({ render: 'weave', ...o })

export default [
  { id: 'plain-weave', label: 'Plain weave', params: weave({
    weaveType: 'plain', cols: 8, rows: 8, cell: 90, gap: 4, strandWidth: 0.74,
    color: PAL.camel, color2: PAL.tan, bg: PAL.char }) },
  { id: 'twill-weave', label: 'Twill weave', params: weave({
    weaveType: 'twill', cols: 10, rows: 10, cell: 78, gap: 4, strandWidth: 0.76,
    color: PAL.navy, color2: PAL.blue, bg: PAL.ink }) },
  { id: 'basketweave', label: 'Basketweave', params: weave({
    weaveType: 'basket', cols: 8, rows: 8, cell: 88, gap: 4, strandWidth: 0.8,
    color: PAL.amber, color2: PAL.ochre, bg: PAL.noir }) },
  { id: 'satin-weave', label: 'Satin weave', params: weave({
    weaveType: 'satin', cols: 10, rows: 10, cell: 76, gap: 3, strandWidth: 0.78,
    color: PAL.gold, color2: PAL.amber, bg: PAL.ink }) },
  { id: 'mesh', label: 'Mesh', params: weave({
    weaveType: 'plain', cols: 16, rows: 16, cell: 60, gap: 5, strandWidth: 0.5,
    color: PAL.ink, color2: PAL.slate, bg: PAL.bone }) },
]
