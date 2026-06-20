/**
 * Section — labeled control group for inspector/editor panels.
 *
 * `action` (optional) — a node rendered flush-right on the label row, e.g. a
 * per-group Randomise button. Sits on the baseline of the label.
 */
export default function Section({ label, children, className = '', action }) {
  if (!label) {
    return <div className={`flex flex-col gap-2 ${className}`}>{children}</div>
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {action ? (
        <div className="flex items-center justify-between min-h-5">
          <span className="kol-helper-10 text-meta">{label}</span>
          {action}
        </div>
      ) : (
        <span className="kol-helper-10 text-meta">{label}</span>
      )}
      {children}
    </div>
  )
}
