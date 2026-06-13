









export function codeScroll(opts                )       {
  const rows = opts.rows ?? 4
  const groups = opts.groupsPerRow ?? 5
  const chars = opts.charsPerGroup ?? 3
  const interval = opts.interval ?? 180
  const mode = opts.mode ?? 'alphanum'
  const fontSize = opts.fontSize ?? 11

  const el = document.createElement('div')
  el.style.fontFamily = 'ui-monospace, Monaco, monospace'
  el.style.fontSize = `${fontSize}px`
  el.style.lineHeight = '1.5'
  el.style.letterSpacing = '0.08em'
  el.style.padding = '4px 2px'
  el.style.color = 'var(--fg)'
  el.style.whiteSpace = 'pre'

  const charset =
    mode === 'hex' ? '0123456789ABCDEF'
    : mode === 'alpha' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    : mode === 'dna' ? 'ACGT'
    : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

  const pick = () => charset[(Math.random() * charset.length) | 0]
  const grp = () => { let s = ''; for (let i = 0; i < chars; i++) s += pick(); return s }
  const row = () => { const parts           = []; for (let i = 0; i < groups; i++) parts.push(grp()); return parts.join('.') }
  const paint = () => {
    const arr           = []
    for (let i = 0; i < rows; i++) arr.push(row())
    el.textContent = arr.join('\n')
  }

  paint()
  const id = setInterval(paint, interval)
  ;(el                                           )._cleanup = () => clearInterval(id)
  opts.host.appendChild(el)
}
