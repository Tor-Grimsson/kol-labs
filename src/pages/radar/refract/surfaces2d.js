// The 2D Lens surfaces — one sub-page each (Lens2DShell). `reflect` = the default
// surface-reflection strength so chrome/mirror read as a front layer at rest.
// `type` = the shader H() branch (see engine.js TYPE_INDEX).
export const SURFACES_2D = [
  { id: 'glass', label: 'Glass', type: 'glass', reflect: 0.1 },
  { id: 'ice', label: 'Ice', type: 'ice', reflect: 0.35 },
  { id: 'metal', label: 'Liquid Metal', type: 'mirror', reflect: 0.7 },
  { id: 'mirror', label: 'Mirror', type: 'kaleido', reflect: 0.55 },
  { id: 'ripple', label: 'Ripple', type: 'ripple', reflect: 0.15 },
  { id: 'waves', label: 'Waves', type: 'waves', reflect: 0.2 },
]

export const SURFACE2D_BY_ID = Object.fromEntries(SURFACES_2D.map((s) => [s.id, s]))
