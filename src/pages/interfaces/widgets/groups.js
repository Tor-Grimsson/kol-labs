// Widget categories — the one axis used by the registry, the Library browse, and
// the sidebar nav. Kept in its own pure module (no factory imports) so the nav
// config can list categories without pulling the heavy widget graph into the
// eager bundle.
export const GROUPS = [
  { key: 'displays', label: 'Displays' },
  { key: 'meters', label: 'Meters' },
  { key: 'controls', label: 'Controls' },
  { key: 'grids', label: 'Grids' },
  { key: 'readouts', label: 'Readouts' },
  { key: 'dimensional', label: '3D' },
  { key: 'chrome', label: 'Chrome' },
]
