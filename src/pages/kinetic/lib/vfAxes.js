// Font registry for the Kinetic page — the variable fonts (with their REAL fvar
// axes, read from the ttf fvar tables) plus a couple of statics for contrast.
// Each VF axis is exposed both as a static slider and as an animation target.

export const FONTS = [
  { key: 'gullhamrar', label: 'Gullhamrar', family: 'TG Gullhamrar', url: '/fonts/TG/TGGullhamrarVF.ttf', axes: [{ tag: 'wght', min: 300, max: 900, def: 300 }] },
  { key: 'malromur', label: 'Malromur', family: 'TG Malromur', url: '/fonts/TG/TGMalromurRomanVF.ttf', axes: [{ tag: 'wght', min: 300, max: 900, def: 300 }] },
  { key: 'ordspor', label: 'Ordspor', family: 'TG Ordspor', url: '/fonts/TG/TGOrdsporVF.ttf', axes: [{ tag: 'wght', min: 300, max: 900, def: 300 }] },
  { key: 'rot', label: 'Rot', family: 'TG Rot', url: '/fonts/TG/TGRotVF.ttf', axes: [{ tag: 'wdth', min: 64, max: 172, def: 100 }, { tag: 'wght', min: 100, max: 900, def: 400 }] },
  { key: 'jetbrains', label: 'JetBrains Mono', family: 'JetBrains Mono', url: '/fonts/jetbrains-mono/JetBrainsMono-Regular.woff2', axes: [] },
]

export const FONT_OPTIONS = FONTS.map((f) => ({ value: f.key, label: f.label }))
export const AXIS_LABELS = { wght: 'Weight', wdth: 'Width', ital: 'Italic', slnt: 'Slant', opsz: 'Optical size' }
export const fontByKey = (k) => FONTS.find((f) => f.key === k) || FONTS[0]

// Default vf object for a font (each present axis at its default value).
export function defaultVf(font) {
  const out = {}
  for (const a of font.axes) out[a.tag] = a.def
  return out
}

// vf object → `'wght' 600, 'wdth' 120` (a font-variation-settings string).
export function vfString(vf) {
  const parts = Object.entries(vf || {}).map(([tag, val]) => `'${tag}' ${Math.round(val * 100) / 100}`)
  return parts.length ? parts.join(', ') : 'normal'
}

// Load every registered font via FontFace. Variable ranges are declared so the
// browser treats them as variable (weight/stretch ranges). Idempotent.
let started = false
export async function loadFonts() {
  if (started || typeof FontFace === 'undefined') return
  started = true
  for (const f of FONTS) {
    const desc = {}
    const wght = f.axes.find((a) => a.tag === 'wght')
    const wdth = f.axes.find((a) => a.tag === 'wdth')
    if (wght) desc.weight = `${wght.min} ${wght.max}`
    if (wdth) desc.stretch = `${wdth.min}% ${wdth.max}%`
    try {
      const ff = new FontFace(f.family, `url(${f.url})`, desc)
      document.fonts.add(ff)
      ff.load().catch(() => {})
    } catch { /* ignore */ }
  }
  try { await document.fonts.ready } catch { /* ignore */ }
}
