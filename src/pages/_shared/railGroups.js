/**
 * Effect-group variant registry — the ONE source of truth for the variant
 * switchers. Both the left nav (sidebars.config.js) and the in-rail
 * <RailVariantNav> read from here, so the two can't drift.
 *
 * Active state is longest-prefix (RailVariantNav / getActivePage), so a root
 * variant (/radar, /scanlines) won't steal a deeper sibling and a category with
 * nested preset routes (/scanlines/radial/rings) resolves to its category.
 */
export const RAIL_GROUPS = {
  halftone: [
    { to: '/radar', label: 'Dither' },
    { to: '/radar/ascii', label: 'ASCII' },
    { to: '/optic', label: 'Bitmap' },
  ],
}
