/**
 * UI face palette for interfaces text (DOM chrome, labels, cipher, code). Stacks
 * resolve to faces @font-face'd in synth.css. Applied per-UI (the whole screen)
 * or per-element (a section override). Canvas widgets draw shapes, not text, so
 * fonts mainly affect the DOM chrome layer.
 */
export const FONTS = [
  { key: 'mono', label: 'Mono', stack: "ui-monospace, 'SF Mono', Menlo, Monaco, monospace" },
  { key: 'jetbrains', label: 'JetBrains', stack: "'JetBrains Mono', ui-monospace, monospace" },
  { key: 'malromur', label: 'Malromur', stack: "'TG Malromur', ui-monospace, monospace" },
  { key: 'grotesk', label: 'Grotesk', stack: "'PP Right Grotesk', system-ui, sans-serif" },
  { key: 'gullhamrar', label: 'Gullhamrar', stack: "'TG Gullhamrar', serif" },
  { key: 'ordspor', label: 'Ordspor', stack: "'TG Ordspor', sans-serif" },
  { key: 'rot', label: 'Rot', stack: "'TG Rot', sans-serif" },
  { key: 'dylgjur', label: 'Dylgjur', stack: "'TG Dylgjur', sans-serif" },
  { key: 'silfurbarki', label: 'Silfurbarki', stack: "'TG Silfurbarki', sans-serif" },
  { key: 'trollatunga', label: 'Trollatunga', stack: "'TG Trollatunga', sans-serif" },
]

export const fontStack = (key) => FONTS.find((f) => f.key === key)?.stack || FONTS[0].stack
