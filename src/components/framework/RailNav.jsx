import Button from '../atoms/Button.jsx'
import Pager from './Pager.jsx'

/**
 * RailNav — the editor-rail nav cluster: title + single/gallery switcher + pager.
 *
 *   Title
 *   [        single / gallery        ]   ← view switcher (rendered when onToggle given)
 *   [← prev]      NN / NN      [next →]   ← Pager (rendered when total > 0)
 *
 * Presentational: the page owns the view + index state and the handlers, this
 * just lays out the cluster. Composes <Pager> for the prev/counter/next row.
 *
 * @param {ReactNode} props.title - cluster heading (RailHeader styling)
 * @param {string} props.toggleLabel - switcher button text
 * @param {Function} props.onToggle - switcher handler; switcher omitted if absent
 * @param {number} props.index - 0-based pager position
 * @param {number} props.total - collection size; pager omitted when falsy/0
 * @param {Function} props.onPrev
 * @param {Function} props.onNext
 * @param {string} props.className
 */
export default function RailNav({
  title,
  toggleLabel,
  onToggle,
  index,
  total,
  onPrev,
  onNext,
  className = '',
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {title != null && <div className="kol-helper-12 text-emphasis">{title}</div>}
      {onToggle && (
        <Button variant="primary" size="sm" className="w-full" onClick={onToggle}>{toggleLabel}</Button>
      )}
      {total > 0 && <Pager index={index} total={total} onPrev={onPrev} onNext={onNext} />}
    </div>
  )
}
