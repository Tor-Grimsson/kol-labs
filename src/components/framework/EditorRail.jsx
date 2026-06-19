import { useState } from 'react'

/**
 * EditorRail — the unified right-hand editor column for experiment pages.
 *
 * The rail owns its shell completely (width, border, background, scroll);
 * pages own only the content, following the rail grammar top → bottom:
 *
 *   1. <RailHeader> — one line: page identity or position
 *   2. mode/nav zone — segmented toggles, prev/next, view switches
 *   3. control groups — each a <Section label="…">; Dividers only between
 *      major zones, never as anonymous group separators
 *   4. actions zone — ghost wrap-row for secondary, full-width primary last
 *   5. footer meta — hints/captions, kol-helper-10 text-body
 *
 * Page-structure law: stage + ONE rail, nothing else — all controls (editing,
 * library, navigation) live in the right rail; no left panes, no page top
 * bars. The only chrome allowed outside the rail is canvas-anchored direct
 * manipulation (floating tool buttons over the stage).
 *
 * Responsive: at md+ it's the 320px sticky side rail. Below md it relocates to
 * a bottom sheet pinned to the screen bottom — collapsed to a grab-handle by
 * default, tapped to reveal/hide the controls. Because the mobile rail is
 * `fixed` (out of flow), the page's stage `flex-1` fills the full width with no
 * page-side change; the sheet overlays the stage bottom. The "stage + ONE rail"
 * law holds — the rail just relocates, it's not a second pane.
 *
 * Three-zone layout: pass `header` and/or `footer` to pin them — header fixed at
 * top, `children` become the single scrolling body, footer fixed at the bottom
 * (edge-to-edge `border-t`). This is the canonical math/synth rail shape made
 * structural, so pages stop hand-rolling it (and stop needing the negative-margin
 * sticky-footer hack). Omit both and it's a single scroll of `children` exactly
 * as before — fully backward compatible.
 */
export default function EditorRail({ header, footer, footerBare = false, children }) {
  // mobile-only: bottom sheet starts hidden, revealed by its handle. Inert at
  // md+ (content is always shown via md:flex regardless of this state).
  const [open, setOpen] = useState(false)

  return (
    <aside
      className={[
        'bg-surface-primary flex flex-col z-10',
        // mobile: bottom sheet pinned to the screen bottom
        'fixed inset-x-0 bottom-0 max-h-[60dvh] border-t border-fg-08 rounded-t-xl',
        // md+: the 320px sticky side rail (reset the sheet-specific bits)
        'md:sticky md:top-0 md:inset-x-auto md:bottom-auto md:z-auto md:w-[320px] md:shrink-0 md:h-dvh md:max-h-none md:border-t-0 md:border-l md:rounded-t-none',
      ].join(' ')}
    >
      {/* mobile grab-handle — toggles the sheet; hidden on desktop */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Hide controls' : 'Show controls'}
        className="md:hidden shrink-0 flex flex-col items-center gap-1.5 py-2.5 border-b border-fg-08"
      >
        <span className="w-9 h-1 rounded-full bg-fg-24" />
        <span className="kol-helper-10 text-meta">{open ? 'Hide' : 'Controls'}</span>
      </button>

      {/* content region — collapsed on mobile when closed */}
      <div className={`${open ? 'flex' : 'hidden'} md:flex flex-1 min-h-0 flex-col overflow-hidden`}>
        {header != null && (
          <div className="shrink-0 px-5 pt-5 flex flex-col gap-5">{header}</div>
        )}
        {/* the single scrolling body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-5">{children}</div>
        {footer != null && (
          // footerBare: the footer content owns its own divider + padding (e.g.
          // RailFooterTabs); the rail just pins it. Otherwise apply the standard
          // edge-to-edge divider + padding.
          <div className={footerBare ? 'shrink-0' : 'shrink-0 border-t border-fg-08 px-5 py-3'}>{footer}</div>
        )}
      </div>
    </aside>
  )
}

export function RailHeader({ children }) {
  return <div className="kol-helper-12 text-emphasis">{children}</div>
}
