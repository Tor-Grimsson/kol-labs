import { useEffect, useState } from 'react'
import Icon from '../loaders/Icon.jsx'
import { usePageShortcuts } from './pageShortcuts.jsx'

/**
 * App-wide help overlay, toggled by pressing `s` (ignored while typing in a
 * field). Documents the expression-param feature: any slider's number box
 * accepts a time-expression in `t` (seconds) that animates the param live.
 *
 * The reference below mirrors the grammar in src/lib/exprParam.js — keep them in
 * sync if the evaluator's functions change.
 */

const EXAMPLES = [
  ['0.5', 'a plain value — stays put (normal slider)'],
  ['t', 'counts up in seconds: 0, 1, 2 …'],
  ['t*0.1', 'counts up slowly'],
  ['sin(t)', 'smooth swing, −1 … 1'],
  ['sin(t*2)*0.5', 'faster, smaller swing'],
  ['wave(t)', 'bounce 0 → 1 → 0, once per second'],
  ['wave(t*0.5)*40', 'bounce, scaled to 0 … 40'],
  ['saw(t)', 'ramp 0 → 1, repeat'],
  ['tri(t)', 'triangle 0 → 1 → 0'],
]

const FUNCS = [
  ['oscillators · 0…1', 'wave  saw  tri  pulse(t,w)  ease(t,c)  bell  step(t,n)'],
  ['trig', 'sin  cos  tan  atan2'],
  ['math', 'abs  floor  ceil  round  sqrt  pow  min  max'],
  ['helpers', 'clamp(x,a,b)  lerp(a,b,u)  mod(a,b)  frac'],
  ['constants', 'PI  TAU  PHI  E'],
]

const isTyping = (el) =>
  !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)

export default function ShortcutsOverlay() {
  const [open, setOpen] = useState(false)
  const page = usePageShortcuts()

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); return }
      if (isTyping(document.activeElement)) return
      if ((e.key === 's' || e.key === 'S') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Shortcuts and expression help"
    >
      <div
        className="relative w-full max-w-lg max-h-[80dvh] overflow-y-auto rounded-lg border border-fg-08 bg-surface-primary p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-meta hover:text-emphasis"
          aria-label="Close"
          onClick={() => setOpen(false)}
        >
          <Icon name="x" size={16} />
        </button>

        <div className="kol-helper-12 uppercase tracking-widest text-meta">Shortcuts</div>

        {page && page.items?.length > 0 && (
          <div className="mb-6">
            <div className="kol-helper-12 uppercase tracking-widest text-meta mb-2">{page.title}</div>
            <div className="flex flex-col gap-1.5">
              {page.items.map(([keys, desc]) => (
                <div key={keys} className="flex items-baseline gap-3">
                  <kbd className="kol-mono-12 text-emphasis shrink-0 rounded bg-surface-secondary px-1.5 py-0.5 w-44">{keys}</kbd>
                  <span className="kol-mono-12 text-body">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <h2 className="kol-mono-20 text-emphasis mt-1">Animate any value</h2>
        <p className="kol-mono-12 text-body mt-2">
          Type math into any slider’s number box instead of a number. It re-evaluates every
          frame, so the value animates — no keyframes. <span className="text-emphasis">t</span> is
          the playhead in seconds, so it pauses / scrubs / tempo-scales with the transport.
          Drag the slider to clear an expression.
        </p>

        <div className="kol-helper-12 uppercase tracking-widest text-meta mt-5 mb-2">Examples</div>
        <div className="flex flex-col gap-1.5">
          {EXAMPLES.map(([expr, note]) => (
            <div key={expr} className="flex items-baseline gap-3">
              <code className="kol-mono-12 text-emphasis shrink-0 rounded bg-surface-secondary px-1.5 py-0.5 w-44">{expr}</code>
              <span className="kol-mono-12 text-body">{note}</span>
            </div>
          ))}
        </div>

        <div className="kol-helper-12 uppercase tracking-widest text-meta mt-5 mb-2">Functions</div>
        <div className="flex flex-col gap-2">
          {FUNCS.map(([group, list]) => (
            <div key={group} className="flex flex-col gap-0.5">
              <span className="kol-helper-10 uppercase tracking-widest text-meta">{group}</span>
              <code className="kol-mono-12 text-body">{list}</code>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-4 border-t border-fg-08 pt-3">
          <span className="kol-helper-10 text-meta"><kbd className="text-emphasis">Space</kbd> play / pause</span>
          <span className="kol-helper-10 text-meta"><kbd className="text-emphasis">S</kbd> toggle this</span>
          <span className="kol-helper-10 text-meta"><kbd className="text-emphasis">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
