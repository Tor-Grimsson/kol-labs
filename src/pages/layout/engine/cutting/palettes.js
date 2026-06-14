/* Bold poster colourways for the Cutting engine — each a {bg, ink, accent}
 * triple pulled from the brutalist / Swiss-shout reference board (effect.app,
 * unicorn.studio, awwwards poster work). `random` (palette = null) rotates per
 * seed; selecting a named one locks it. */

export const PALETTES = [
  { id: 'noir', label: 'Noir', bg: '#0E0E11', ink: '#FAFAFA', accent: '#FF4D1F' },
  { id: 'cream', label: 'Cream', bg: '#EDE7DC', ink: '#17150F', accent: '#E8521E' },
  { id: 'ultra', label: 'Ultra', bg: '#5B3DF5', ink: '#F0EBE0', accent: '#FF3B30' },
  { id: 'blush', label: 'Blush', bg: '#E7C6BE', ink: '#1A1714', accent: '#C0392B' },
  { id: 'acid', label: 'Acid', bg: '#D8FF2E', ink: '#0E0E11', accent: '#0E0E11' },
  { id: 'flare', label: 'Flare', bg: '#F0531E', ink: '#19120C', accent: '#F4E9DD' },
  { id: 'punk', label: 'Punk', bg: '#0E0E11', ink: '#F4F0EA', accent: '#FF2D78' },
]

export const pickPalette = (rng) => PALETTES[Math.floor(rng() * PALETTES.length)]
