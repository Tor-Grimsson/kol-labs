









import { poolFor } from '../lib/charsets.js'
import { tempoScale } from '../lib/clock.js'

export function codeScroll(opts                )       {
  const rows = opts.rows ?? 4
  const groups = opts.groupsPerRow ?? 5
  const chars = opts.charsPerGroup ?? 3
  const interval = opts.interval ?? 180
  const mode = opts.mode ?? 'alphanum'
  const fontSize = opts.fontSize ?? 11

  const el = document.createElement('div')
  el.style.fontFamily = 'inherit' // inherit the screen / per-element face
  el.style.fontSize = `${fontSize}px`
  el.style.lineHeight = '1.5'
  el.style.letterSpacing = '0.08em'
  el.style.padding = '4px 2px'
  el.style.color = 'var(--fg)'
  el.style.whiteSpace = 'pre'

  const charset = poolFor(mode, opts.custom)

  let playing = true // gated by the mount's play-state (transport / tile hover)
  const pick = () => charset[(Math.random() * charset.length) | 0]
  const grp = () => { let s = ''; for (let i = 0; i < chars; i++) s += pick(); return s }
  const row = () => { const parts           = []; for (let i = 0; i < groups; i++) parts.push(grp()); return parts.join('.') }
  const paint = () => {
    if (!playing) return
    const arr           = []
    for (let i = 0; i < rows; i++) arr.push(row())
    el.textContent = arr.join('\n')
  }

  paint()
  let id
  const reschedule = () => { id = setTimeout(() => { paint(); reschedule() }, interval / Math.max(0.05, tempoScale())) }
  reschedule()
  ;(el                                           )._cleanup = () => clearTimeout(id)
  ;(el                                           )._setPlaying = (p) => { playing = p }
  opts.host.appendChild(el)
}
