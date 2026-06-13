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
 */
export default function EditorRail({ children }) {
  return (
    <aside className="w-[320px] shrink-0 sticky top-0 h-dvh overflow-y-auto border-l border-fg-08 bg-surface-primary p-5 flex flex-col gap-5">
      {children}
    </aside>
  )
}

export function RailHeader({ children }) {
  return <div className="kol-helper-12 text-emphasis">{children}</div>
}
