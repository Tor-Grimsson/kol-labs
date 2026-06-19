// Audio example registry — 2 categories × 6 worked examples each. Every example
// is a small Canvas2D draw fn that CONSUMES the live bands, so it proves the
// modulation translating to the view (unlike a page that never resolves the
// param). The `formula` doubles as documentation: it's the expression you'd type
// into a real slider to get the same motion. Bands are 0–1 — note how each
// formula scales them into a useful range (`1 + bass*0.7`, not raw `bass`).
//
// draw({ ctx, w, h, a, t, dt, color, state }) — a = { level, bass, mid, high },
// t/dt in seconds, color = theme foreground, state = per-mount scratch object.

export const AUDIO_CATEGORIES = [
  { id: 'signals', label: 'Signals' },
  { id: 'reactive', label: 'Reactive' },
]

const BANDS = ['level', 'bass', 'mid', 'high']

// ── Signals — direct visualization of the four bands ────────────────────────

function pulse({ ctx, w, h, a, color }) {
  const cx = w / 2, cy = h / 2, m = Math.min(w, h)
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(cx, cy, m * 0.30 * (1 + a.bass * 0.7), 0, Math.PI * 2); ctx.stroke()
  ctx.globalAlpha = 0.35 + a.high * 0.65
  ctx.beginPath(); ctx.arc(cx, cy, m * 0.20 * (0.35 + a.level * 0.5), 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 1
}

function meters({ ctx, w, h, a, color }) {
  ctx.fillStyle = color
  const n = 4, gap = 16, bh = 12, total = n * bh + (n - 1) * gap
  const top = (h - total) / 2, x = w * 0.12, bw = w * 0.76
  for (let i = 0; i < n; i++) {
    const v = a[BANDS[i]], y = top + i * (bh + gap)
    ctx.globalAlpha = 0.14; ctx.fillRect(x, y, bw, bh)
    ctx.globalAlpha = 1; ctx.fillRect(x, y, bw * v, bh)
  }
}

function bars({ ctx, w, h, a, color }) {
  ctx.fillStyle = color
  const n = 4, gap = 28, bw = Math.min(64, (w * 0.7) / n)
  const total = n * bw + (n - 1) * gap, x0 = (w - total) / 2, base = h * 0.85, max = h * 0.6
  for (let i = 0; i < n; i++) {
    const v = a[BANDS[i]], x = x0 + i * (bw + gap)
    ctx.globalAlpha = 0.14; ctx.fillRect(x, base - max, bw, max)
    ctx.globalAlpha = 1; ctx.fillRect(x, base - max * v, bw, max * v)
  }
}

function rings({ ctx, w, h, a, color }) {
  ctx.strokeStyle = color; ctx.lineWidth = 2
  const cx = w / 2, cy = h / 2, m = Math.min(w, h) * 0.44
  for (let i = 0; i < 4; i++) {
    const v = a[BANDS[i]], r = m * ((i + 1) / 4) * (0.55 + v * 0.6)
    ctx.globalAlpha = 0.3 + v * 0.7
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function scope({ ctx, w, h, a, color, state }) {
  const len = Math.floor(w)
  if (!state.hist || state.hist.length !== len) state.hist = new Array(len).fill(0)
  state.hist.push(a.level); state.hist.shift()
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath()
  for (let x = 0; x < state.hist.length; x++) {
    const y = h - state.hist[x] * h * 0.9 - h * 0.05
    x ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
  }
  ctx.stroke()
}

function dots({ ctx, w, h, a, color }) {
  ctx.fillStyle = color
  const cols = 16, rows = 4, mx = w * 0.1, my = h * 0.18
  const gw = (w - mx * 2) / cols, gh = (h - my * 2) / rows, r = Math.min(gw, gh) * 0.28
  for (let ry = 0; ry < rows; ry++) {
    const v = a[BANDS[ry]]
    for (let cx = 0; cx < cols; cx++) {
      ctx.globalAlpha = cx / cols < v ? 1 : 0.12
      ctx.beginPath(); ctx.arc(mx + gw * (cx + 0.5), my + gh * (ry + 0.5), r, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}

// ── Reactive — band-driven generative motion ────────────────────────────────

function eq({ ctx, w, h, a, t, color }) {
  ctx.fillStyle = color
  const n = 40, bw = w / n
  for (let i = 0; i < n; i++) {
    const f = i / n
    const band = f < 0.34 ? a.bass : f < 0.67 ? a.mid : a.high
    const wob = 0.85 + 0.15 * Math.sin(t * 3 + i * 0.5)
    const hh = band * wob * h * 0.8
    ctx.fillRect(i * bw + 1, h - hh, bw - 2, hh)
  }
}

function waves({ ctx, w, h, a, t, color }) {
  ctx.strokeStyle = color; ctx.lineWidth = 2
  for (let l = 0; l < 3; l++) {
    ctx.globalAlpha = 0.3 + 0.3 * l
    ctx.beginPath()
    const amp = h * 0.18 * a.mid + 4, ph = t * (0.5 + a.level * 4) + l * 1.3, freq = 2 + l
    for (let x = 0; x <= w; x += 6) {
      const y = h / 2 + Math.sin((x / w) * Math.PI * 2 * freq + ph) * amp
      x ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function orbit({ ctx, w, h, a, dt, color, state }) {
  state.ang = (state.ang || 0) + dt * (0.3 + a.level * 6)
  ctx.fillStyle = color
  const cx = w / 2, cy = h / 2, n = 12, r = Math.min(w, h) * 0.18 * (1 + a.bass * 0.9)
  for (let i = 0; i < n; i++) {
    const ang = state.ang + (i / n) * Math.PI * 2
    ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 3 + a.high * 6, 0, Math.PI * 2); ctx.fill()
  }
}

function bloom({ ctx, w, h, a, dt, color, state }) {
  state.rot = (state.rot || 0) + dt * (0.2 + a.mid * 2)
  ctx.strokeStyle = color; ctx.lineWidth = 2
  const cx = w / 2, cy = h / 2
  const petals = 3 + Math.floor(a.high * 12), len = Math.min(w, h) * 0.4 * (0.5 + a.level * 0.6)
  for (let i = 0; i < petals; i++) {
    const ang = state.rot + (i / petals) * Math.PI * 2
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len); ctx.stroke()
  }
}

function type({ ctx, w, h, a, color }) {
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = `${Math.min(w, h) * 0.4 * (1 + a.bass * 0.8)}px ui-monospace, monospace`
  ctx.globalAlpha = 0.5 + a.level * 0.5
  ctx.fillText('A', w / 2, h / 2)
  ctx.globalAlpha = 1
}

function flow({ ctx, w, h, a, dt, color, state }) {
  if (!state.parts) state.parts = Array.from({ length: 120 }, () => ({ x: Math.random() * w, y: Math.random() * h }))
  ctx.fillStyle = color; ctx.globalAlpha = 0.6
  const sp = 20 + a.level * 240
  for (const p of state.parts) {
    p.x += (-0.4 + a.bass * 2) * sp * dt * 0.3
    p.y += Math.sin((p.x + p.y) * 0.01) * sp * dt * 0.2
    if (p.x < 0) p.x += w; if (p.x > w) p.x -= w
    if (p.y < 0) p.y += h; if (p.y > h) p.y -= h
    ctx.fillRect(p.x, p.y, 2, 2)
  }
  ctx.globalAlpha = 1
}

export const EXAMPLES = [
  // Signals
  { id: 'pulse',  cat: 'signals', label: 'Pulse',     formula: 'ring 1 + bass·0.7 · core 0.35 + level·0.5', draw: pulse },
  { id: 'meters', cat: 'signals', label: 'Meters',    formula: 'width = band',                              draw: meters },
  { id: 'bars',   cat: 'signals', label: 'Bars',      formula: 'height = band',                             draw: bars },
  { id: 'rings',  cat: 'signals', label: 'Rings',     formula: 'radius = base + band·k',                    draw: rings },
  { id: 'scope',  cat: 'signals', label: 'Scope',     formula: 'y(t) = level (scrolling)',                  draw: scope },
  { id: 'dots',   cat: 'signals', label: 'Dots',      formula: 'lit = col/N < band',                        draw: dots },
  // Reactive
  { id: 'eq',     cat: 'reactive', label: 'Equalizer', formula: 'height = band(spectrum)',                  draw: eq },
  { id: 'waves',  cat: 'reactive', label: 'Waves',     formula: 'amp = mid · speed = level',                draw: waves },
  { id: 'orbit',  cat: 'reactive', label: 'Orbit',     formula: 'radius = bass · ω = level',                draw: orbit },
  { id: 'bloom',  cat: 'reactive', label: 'Bloom',     formula: 'petals = 3 + high·12',                     draw: bloom },
  { id: 'type',   cat: 'reactive', label: 'Type',      formula: 'size = 1 + bass·0.8',                      draw: type },
  { id: 'flow',   cat: 'reactive', label: 'Flow',      formula: 'drift = level',                            draw: flow },
]

export const EXAMPLE_BY_ID = Object.fromEntries(EXAMPLES.map((e) => [e.id, e]))
