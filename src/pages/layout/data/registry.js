/* Artboard ratios + the curated face palette. Faces load on demand via the
 * FontFace API (files in public/fonts/) — cssWeight is the @font-face
 * descriptor (ranges allowed for VFs), drawWeight is the single weight used
 * in ctx.font / SVG output. */

export const RATIOS = [
  { id: '1:1', label: '1:1 — square', w: 1, h: 1 },
  { id: '4:5', label: '4:5 — portrait', w: 4, h: 5 },
  { id: '3:4', label: '3:4 — portrait', w: 3, h: 4 },
  { id: '9:16', label: '9:16 — story', w: 9, h: 16 },
  { id: 'a-series', label: 'A series — print', w: 1000, h: 1414 },
  { id: '16:9', label: '16:9 — wide', w: 16, h: 9 },
]

export const FACES = [
  { id: 'rg-wide-black', label: 'RG Wide Black', family: 'PP Right Grotesk Wide', url: '/fonts/Right-Grotesk/PPRightGrotesk-WideBlack.woff2', cssWeight: '900', drawWeight: '900' },
  { id: 'rg-compact-black', label: 'RG Compact Black', family: 'PP Right Grotesk Compact', url: '/fonts/Right-Grotesk/PPRightGrotesk-CompactBlack.woff2', cssWeight: '900', drawWeight: '900' },
  { id: 'rg-narrow-fine', label: 'RG Narrow Fine', family: 'PP Right Grotesk Narrow Fine', url: '/fonts/Right-Grotesk/PPRightGrotesk-NarrowFine.woff2', cssWeight: '300', drawWeight: '300' },
  { id: 'rg-spatial-light', label: 'RG Spatial Light', family: 'PP Right Grotesk Spatial Light', url: '/fonts/Right-Grotesk/PPRightGrotesk-SpatialLight.woff2', cssWeight: '300', drawWeight: '300' },
  { id: 'tg-gullhamrar', label: 'TG Gullhamrar', family: 'TG Gullhamrar', url: '/fonts/TG/TGGullhamrarVF.ttf', cssWeight: '100 900', drawWeight: '700' },
  { id: 'tg-malromur', label: 'TG Malromur', family: 'TG Malromur', url: '/fonts/TG/TGMalromurRomanVF.ttf', cssWeight: '100 900', drawWeight: '900' },
]

export const BODY_FACE = { id: 'rg-regular', label: 'RG Regular', family: 'PP Right Grotesk', url: '/fonts/Right-Grotesk/PPRightGrotesk-Regular.woff2', cssWeight: '400', drawWeight: '400' }

const loaded = new Set()

export async function ensureFace(face) {
  if (loaded.has(face.id)) return
  const ff = new FontFace(face.family, `url(${face.url})`, { weight: face.cssWeight })
  await ff.load()
  document.fonts.add(ff)
  loaded.add(face.id)
}
