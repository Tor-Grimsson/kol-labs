// Pattern catalog — single source of truth for the /pattern sub-pages. The
// kolkrabbi rule/tiling engine (src/loops/pattern) rendered as a standalone
// vector-pattern studio: Page › 5 Categories › ~20 sub-pages each (~100 total),
// mirroring the drift/type/scanlines registry model so nav + routes can't drift.
//
// Each category file (./categories/<id>.js) exports an array of { id, label,
// params } where `params` is a full patch over the patternLoop defaults. This
// module derives the cat/path/route: the very FIRST sub-page owns /pattern (the
// index); every other is /pattern/<cat>/<id>.

import STRIPES from './categories/stripes.js'
import TARTAN from './categories/tartan.js'
import BLOCKS from './categories/blocks.js'
import ORGANIC from './categories/organic.js'
import INTERLACE from './categories/interlace.js'

export const CATEGORIES = [
  { id: 'stripes', label: 'Stripes' },
  { id: 'tartan', label: 'Tartan' },
  { id: 'blocks', label: 'Blocks' },
  { id: 'organic', label: 'Organic' },
  { id: 'interlace', label: 'Interlace' },
]
export const categoryById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0]

const RAW = { stripes: STRIPES, tartan: TARTAN, blocks: BLOCKS, organic: ORGANIC, interlace: INTERLACE }

// Derive path/route. The first sub-page of the first category is the /pattern
// index (path ''); all others route to /pattern/<cat>/<id>.
let first = true
export const SUBPAGES = Object.fromEntries(
  CATEGORIES.map((cat) => [
    cat.id,
    (RAW[cat.id] || []).map((s) => {
      const isIndex = first
      first = false
      return {
        ...s,
        cat: cat.id,
        path: isIndex ? '' : `${cat.id}/${s.id}`,
        route: isIndex ? '/pattern' : `/pattern/${cat.id}/${s.id}`,
      }
    }),
  ]),
)

export const ALL_SUBPAGES = CATEGORIES.flatMap((c) => SUBPAGES[c.id])
export const subpageById = (id) => ALL_SUBPAGES.find((s) => s.id === id) || ALL_SUBPAGES[0]
