/**
 * The effects radar offers, in panel-switcher order. Each effect is its own
 * route + page; adding one is a single entry here (effects.app shape).
 */
export const EFFECTS = [
  { id: 'dither', label: 'Dither', to: '/radar' },
  { id: 'distort', label: 'Distort', to: '/radar/distort' },
  { id: 'ascii', label: 'ASCII', to: '/radar/ascii' },
]
