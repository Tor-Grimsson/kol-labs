// Shared time singleton. Coherent across prototypes + pausable without jump,
// and speed-scalable (global Time control) without jump. Accumulator model:
// `base` holds elapsed scaled ms up to `mark`; live time adds (real - mark) * speed.
// Use CLOCK.nowSeconds() in prototype draw loops instead of performance.now().

export class SquishyClock {
  base = 0
  mark = performance.now()
  paused = false
  speed = 1

  now() {
    if (this.paused) return this.base
    return this.base + (performance.now() - this.mark) * this.speed
  }
  nowSeconds() { return this.now() / 1000 }
  isPaused() { return this.paused }

  // Fold accumulated time into `base` and restamp `mark` — call before any
  // change to speed/pause so elapsed time stays continuous.
  settle() {
    if (!this.paused) this.base += (performance.now() - this.mark) * this.speed
    this.mark = performance.now()
  }

  setSpeed(s) {
    this.settle()
    this.speed = Math.max(0, s)
  }

  pause() {
    if (this.paused) return
    this.settle()
    this.paused = true
  }
  resume() {
    if (!this.paused) return
    this.mark = performance.now()
    this.paused = false
  }
  toggle() { this.paused ? this.resume() : this.pause() }
  reset() {
    this.base = 0
    this.mark = performance.now()
  }
}

export const CLOCK = new SquishyClock()
