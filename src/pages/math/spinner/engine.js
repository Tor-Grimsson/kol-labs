import { makeSpinner, ballPos, TAU } from './data/spinner.js'

// SpinnerEngine — drives a Thread Spinner. Each ball's glowing thread accumulates
// on an OFFSCREEN buffer (never cleared except on reset / structural change), so
// the big loops pile up = the entropy build. The glowing white heads are drawn
// FRESH each frame on the visible canvas over a blit of the buffer, so heads stay
// single dots while only the threads accumulate. `persist < 1` fades the buffer
// for a softer build that won't fully saturate.
//
// Browser-only (offscreen <canvas>). The orbit math lives in data/spinner.js and
// is node-verifiable on its own.
export default class SpinnerEngine {
  constructor(w, h, params) {
    this.params = { ...params }
    this._sig = ''
    this.buf = document.createElement('canvas')
    this.bctx = this.buf.getContext('2d')
    this.t = 0
    this.resize(w || 1, h || 1)
    this.rebuild()
  }

  resize(w, h) {
    this.w = w
    this.h = h
    this.buf.width = w
    this.buf.height = h
    this.clearBuf()
    this.seed()
  }

  clearBuf() {
    this.bctx.globalCompositeOperation = 'source-over'
    this.bctx.globalAlpha = 1
    this.bctx.fillStyle = this.params.bg || '#060608'
    this.bctx.fillRect(0, 0, this.w, this.h)
  }

  _reach() {
    return Math.min(this.w, this.h) * 0.5 * (this.params.reach ?? 0.92)
  }

  // Place heads at t without drawing, so the first composite shows real heads.
  seed() {
    if (!this.balls) return
    const cx = this.w / 2
    const cy = this.h / 2
    const reach = this._reach()
    for (const b of this.balls) {
      const [x, y] = ballPos(b, this.t, cx, cy, reach)
      b.px = x
      b.py = y
      b.started = true
    }
  }

  rebuild() {
    const p = this.params
    this.balls = makeSpinner({ count: p.count, drift: p.drift, span: p.span }, p.seed ?? 1)
    this._sig = [p.count, p.drift, p.span, p.reach, p.seed].join('|')
    this.t = 0
    this.clearBuf()
    this.seed()
  }

  reset() {
    this.rebuild()
  }

  // Structural params rebuild the field (and clear the accumulated threads);
  // cosmetic params (weight/glow/colour/heads/persist/speed) take effect live.
  setParams(p) {
    this.params = { ...p }
    const sig = [p.count, p.drift, p.span, p.reach, p.seed].join('|')
    if (sig !== this._sig) {
      this._sig = sig
      this.rebuild()
    }
  }

  // Advance the sim by dt and lay each ball's new (glowing) thread segment.
  step(dt) {
    const p = this.params
    const persist = p.persist ?? 1
    this.bctx.globalCompositeOperation = 'source-over'
    if (persist < 1) {
      this.bctx.globalAlpha = (1 - persist) * 0.5
      this.bctx.fillStyle = p.bg || '#060608'
      this.bctx.fillRect(0, 0, this.w, this.h)
      this.bctx.globalAlpha = 1
    }

    this.t += dt * (p.speed ?? 1)
    const cx = this.w / 2
    const cy = this.h / 2
    const reach = this._reach()
    const mono = !!p.mono
    const thread = p.thread || '#ffffff'
    const glow = p.glow ?? 8

    this.bctx.lineWidth = p.weight ?? 2
    this.bctx.lineCap = 'round'
    this.bctx.lineJoin = 'round'
    for (const b of this.balls) {
      const [x, y] = ballPos(b, this.t, cx, cy, reach)
      if (b.started) {
        const col = mono ? thread : `hsl(${b.hue}, 90%, 62%)`
        this.bctx.strokeStyle = col
        if (glow > 0) { this.bctx.shadowBlur = glow; this.bctx.shadowColor = col }
        this.bctx.beginPath()
        this.bctx.moveTo(b.px, b.py)
        this.bctx.lineTo(x, y)
        this.bctx.stroke()
      }
      b.px = x
      b.py = y
      b.started = true
    }
    this.bctx.shadowBlur = 0
  }

  // Composite the accumulated threads + the current glowing heads.
  draw(ctx) {
    const p = this.params
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, this.w, this.h)
    ctx.drawImage(this.buf, 0, 0)
    if (p.heads !== false) {
      const r = p.ballR ?? 9
      ctx.save()
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = 'rgba(255,255,255,0.85)'
      ctx.shadowBlur = r * 1.6
      for (const b of this.balls) {
        ctx.beginPath()
        ctx.arc(b.px, b.py, r, 0, TAU)
        ctx.fill()
      }
      ctx.restore()
    }
  }
}
