import SegmentedToggle from '../molecules/SegmentedToggle.jsx'

/**
 * RailFooterTabs — the tabbed bottom panel for an EditorRail footer
 * (Transport / Output / File and friends). Owns the full-width top divider and
 * the footer padding (16 / 20 / 24 / 20); the page passes the tab set and the
 * active panel as children.
 *
 * Pair it with EditorRail's `footerBare` so the rail's own footer wrapper doesn't
 * add a second divider + padding:
 *
 *   <EditorRail
 *     footerBare
 *     footer={
 *       <RailFooterTabs value={tab} onChange={setTab} tabs={TABS}>
 *         {tab === 'transport' && <TransportBar … />}
 *         {tab === 'output' && …}
 *       </RailFooterTabs>
 *     }
 *   >
 *
 * Props:
 *   value/onChange — the active tab (SegmentedToggle state).
 *   tabs           — [{ value, label }] for the toggle.
 *   children       — the active tab's content (page-owned).
 */
export default function RailFooterTabs({ value, onChange, tabs, children }) {
  return (
    <div className="border-t border-fg-08 flex flex-col gap-3" style={{ padding: '16px 20px 24px 20px' }}>
      <SegmentedToggle value={value} onChange={onChange} options={tabs} />
      {children}
    </div>
  )
}
