import { makeThreads, ballPosN, applyDrag, TAU } from './data/threads.js'

// ThreadsEngine — two independent layers, redrawn live each frame (no accumulation):
//   • lines: a few clean slow-precessing colour loops (drawn first, behind)
//   • balls: a fast 3-wing mill that spreads to cover the surface (on top)
// The layers never interact — balls do not deform the lines.
//
// Browser-only (canvas glow). Geometry lives in data/threads.js (node-checkable).
export default class ThreadsEngine {
  constructor(w, h, params) {
    this.params = { ...params }
    this._sig = ''
    this.t = 0
    this.w = w || 1
    this.h = h || 1
    this.rebuild()
  }

  resize(w, h) {
    this.w = w
    this.h = h
  }

  _reach() {
    return Math.min(this.w, this.h) * 0.5 * (this.params.reach ?? 0.92)
  }

  rebuild() {
    const p = this.params
    this.model = makeThreads({ wings: p.wings, perWing: p.perWing, lines: p.lines, form: p.form }, p.seed ?? 1)
    this._sig = [p.wings, p.perWing, p.lines, p.form, p.seed].join('|')
    this.t = 0
  }

  reset() {
    this.rebuild()
  }

  setParams(p) {
    this.params = { ...p }
    const sig = [p.wings, p.perWing, p.lines, p.form, p.seed].join('|')
    if (sig !== this._sig) {
      this._sig = sig
      this.rebuild()
    }
  }

  step(dt) {
    this.t += dt
  }

  draw(ctx) {
    const p = this.params
    const cx = this.w / 2
    const cy = this.h / 2
    const S = this._reach()
    const t = this.t

    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = p.bg || '#050507'
    ctx.fillRect(0, 0, this.w, this.h)

    const mono = !!p.mono
    const thread = p.thread || '#ffffff'
    const glow = p.glow ?? 9
    const lineSpeed = p.lineSpeed ?? 0.25
    const ballSpeed = p.ballSpeed ?? 1

    // Ball positions FIRST — the form is dragged by them.
    const ballsN = this.model.balls.map((b) => ballPosN(b, t, ballSpeed))
    const drag = { infR: p.infR ?? 0.28, pull: p.pull ?? 0.18 }

    // ── Form (behind) — every base curve dragged by the balls, quad-smoothed.
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = p.weight ?? 2.2
    for (const path of this.model.paths) {
      const pts = applyDrag(path.pts, t, ballsN, drag, lineSpeed)
      const col = mono ? thread : `hsl(${path.hue}, 90%, 62%)`
      ctx.strokeStyle = col
      if (glow > 0) { ctx.shadowBlur = glow; ctx.shadowColor = col }
      ctx.beginPath()
      ctx.moveTo(cx + pts[0][0] * S, cy + pts[0][1] * S)
      for (let i = 1; i < pts.length - 1; i++) {
        const x = cx + pts[i][0] * S
        const y = cy + pts[i][1] * S
        const nx = cx + pts[i + 1][0] * S
        const ny = cy + pts[i + 1][1] * S
        ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2)
      }
      ctx.stroke()
    }
    ctx.shadowBlur = 0

    // ── Balls (front) — big glowing white, the windmill.
    if (p.heads !== false) {
      const base = p.ballR ?? 40
      ctx.save()
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = 'rgba(255,255,255,0.85)'
      for (let k = 0; k < ballsN.length; k++) {
        const r = base * this.model.balls[k].size
        ctx.shadowBlur = r * 1.2
        ctx.beginPath()
        ctx.arc(cx + ballsN[k][0] * S, cy + ballsN[k][1] * S, r, 0, TAU)
        ctx.fill()
      }
      ctx.restore()
    }
  }
}
