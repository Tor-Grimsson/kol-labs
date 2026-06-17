/**
 * ButtonGroup — clusters related buttons with consistent spacing.
 *
 * A thin layout primitive: a flex row or column with a gap, so related actions
 * read as one set (typically tighter than the surrounding rail rhythm). Buttons
 * keep their own shape — this does NOT join/segment them. Orientation- and
 * button-agnostic: any number of <Button>s (any variant) or raw <button>/<a>.
 *
 *   <ButtonGroup gap={1}>…</ButtonGroup>                    // horizontal, 4px gap
 *   <ButtonGroup orientation="vertical" className="w-full"> // stacked, full width
 *     <Button …/>
 *     <Button …/>
 *   </ButtonGroup>
 *
 * Props:
 *   orientation — 'horizontal' (default) | 'vertical'
 *   gap         — spacing step 0–4 → Tailwind gap-N (default 2 = 8px)
 *   className   — extra classes on the shell (e.g. 'w-full')
 *   children    — the buttons; any type, any count
 */
const GAP = { 0: 'gap-0', 1: 'gap-1', 2: 'gap-2', 3: 'gap-3', 4: 'gap-4' }

export default function ButtonGroup({ orientation = 'horizontal', gap = 2, className = '', children, ...props }) {
  const dir = orientation === 'vertical' ? 'flex-col' : 'flex-row'
  return (
    <div role="group" className={`flex ${dir} ${GAP[gap] ?? GAP[2]} ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}
