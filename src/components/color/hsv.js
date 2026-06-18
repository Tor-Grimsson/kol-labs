// hex <-> HSV helpers, hand-rolled to avoid a `colord` dependency (kol-labs is
// zero-new-deps). Ranges mirror colord exactly — h: 0–360, s: 0–100, v: 0–100 —
// so the ported SpectrumControls (HueStrip/SBSquare, written against colord's
// `.toHsv()`) work unchanged.

/** Normalise any input to `#RRGGBB` uppercase; garbage falls back to #000000.
 *  Accepts `#rgb`, `rgb`, `#rrggbb`, `rrggbb`, mixed case. */
export function clampHex(hex) {
  if (typeof hex !== 'string') return '#000000'
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return '#000000'
  return '#' + h.toUpperCase()
}

/** True when `hex` is a complete `#RRGGBB` / `RRGGBB` (3-digit shorthand too). */
export function isHex(hex) {
  if (typeof hex !== 'string') return false
  const h = hex.trim().replace(/^#/, '')
  return /^[0-9a-fA-F]{3}$/.test(h) || /^[0-9a-fA-F]{6}$/.test(h)
}

export function hexToRgb(hex) {
  const h = clampHex(hex).slice(1)
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

export function rgbToHex(r, g, b) {
  const to = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return ('#' + to(r) + to(g) + to(b)).toUpperCase()
}

/** `#RRGGBB` → { h: 0–360, s: 0–100, v: 0–100 }. */
export function hexToHsv(hex) {
  const { r, g, b } = hexToRgb(hex)
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn)      h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else                 h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h, s: s * 100, v: max * 100 }
}

/** { h: 0–360, s: 0–100, v: 0–100 } → `#RRGGBB`. */
export function hsvToHex(h, s, v) {
  const sn = s / 100, vn = v / 100
  const c = vn * sn
  const hp = ((((h % 360) + 360) % 360)) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0, g = 0, b = 0
  if      (hp < 1) [r, g, b] = [c, x, 0]
  else if (hp < 2) [r, g, b] = [x, c, 0]
  else if (hp < 3) [r, g, b] = [0, c, x]
  else if (hp < 4) [r, g, b] = [0, x, c]
  else if (hp < 5) [r, g, b] = [x, 0, c]
  else             [r, g, b] = [c, 0, x]
  const m = vn - c
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255)
}
