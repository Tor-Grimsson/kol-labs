import Button from '../atoms/Button.jsx'

const pad = (n) => String(n).padStart(2, '0')

/**
 * Pager — the prev / counter / next row used in experiment editor rails.
 *
 *   [← prev]   NN / NN   [next →]
 *
 * Presentational: the page owns navigation (its own `go(dir)` is usually
 * shared with the keyboard handler), this renders the controls + position.
 *
 * @param {Object} props
 * @param {number} props.index - 0-based current position (displayed as index+1)
 * @param {number} props.total - total item count
 * @param {Function} props.onPrev - called when ← prev is pressed
 * @param {Function} props.onNext - called when next → is pressed
 * @param {string} props.prevLabel - prev button text (default '← prev')
 * @param {string} props.nextLabel - next button text (default 'next →')
 * @param {string} props.className - extra classes on the row
 */
export default function Pager({
  index,
  total,
  onPrev,
  onNext,
  prevLabel = '← Prev',
  nextLabel = 'Next →',
  className = '',
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button variant="primary" size="sm" onClick={onPrev}>{prevLabel}</Button>
      <span className="kol-helper-10 text-meta flex-1 text-center tabular-nums">
        {pad(index + 1)} / {pad(total)}
      </span>
      <Button variant="primary" size="sm" onClick={onNext}>{nextLabel}</Button>
    </div>
  )
}
