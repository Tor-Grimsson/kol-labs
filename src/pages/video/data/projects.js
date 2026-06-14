/* Output formats for the reframe model. `ratio` = w/h; null means the frame
 * follows the source (Source = trim only, Free = draggable crop box). */
export const PROJECTS = [
  { key: 'source', label: 'Source', ratio: null },
  { key: 'free', label: 'Free', ratio: null },
  { key: '1:1', label: '1:1', ratio: 1 },
  { key: '4:5', label: '4:5', ratio: 4 / 5 },
  { key: '5:4', label: '5:4', ratio: 5 / 4 },
  { key: '2:3', label: '2:3', ratio: 2 / 3 },
  { key: '3:2', label: '3:2', ratio: 3 / 2 },
  { key: '9:16', label: '9:16', ratio: 9 / 16 },
  { key: '16:9', label: '16:9', ratio: 16 / 9 },
  { key: '5:3', label: '5:3', ratio: 5 / 3 },
  { key: '3:4', label: '3:4', ratio: 3 / 4 },
  { key: '4:3', label: '4:3', ratio: 4 / 3 },
  { key: '2:1', label: '2:1', ratio: 2 },
]

export const projectFor = (key) => PROJECTS.find((p) => p.key === key) || PROJECTS[0]

const even = (n) => Math.max(2, Math.round(n / 2) * 2)

/* Output pixel dimensions for a ratio — short edge pinned to 1080 (so 9:16 →
 * 1080×1920, 16:9 → 1920×1080, 1:1 → 1080×1080), matching social conventions. */
export function outputDims(ratio) {
  return ratio >= 1 ? { w: even(1080 * ratio), h: 1080 } : { w: 1080, h: even(1080 / ratio) }
}

/* The largest window of `ratio` that fits inside the source, normalised (0..1
 * of source). zoom 1 = this window; higher zoom shrinks it for a tighter crop. */
export function maxWindow(srcW, srcH, ratio) {
  const wpx = Math.min(srcW, srcH * ratio)
  return { w: wpx / srcW, h: wpx / ratio / srcH }
}

/* The source NEVER moves — the format is an output window placed over it.
 * params {zoom, ox, oy}: zoom (≥1) sizes the window, ox/oy (0..1) center it.
 * Returns the window as a normalised crop rect, clamped inside the source. */
export function windowRect(srcW, srcH, ratio, p) {
  const m = maxWindow(srcW, srcH, ratio)
  const w = m.w / p.zoom
  const h = m.h / p.zoom
  const x = Math.min(Math.max(0, p.ox - w / 2), 1 - w)
  const y = Math.min(Math.max(0, p.oy - h / 2), 1 - h)
  return { x, y, w, h }
}

export const DEFAULT_WINDOW = { zoom: 1, ox: 0.5, oy: 0.5 }
