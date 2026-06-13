// Shared time singleton. Coherent across prototypes + pausable without jump.
// Use CLOCK.nowSeconds() in prototype draw loops instead of performance.now().

class SquishyClock {
          origin = performance.now()
          pauseAt = 0
          paused = false

  now()         {
    if (this.paused) return this.pauseAt
    return performance.now() - this.origin
  }
  nowSeconds()         { return this.now() / 1000 }
  isPaused()          { return this.paused }

  pause()       {
    if (this.paused) return
    this.paused = true
    this.pauseAt = performance.now() - this.origin
  }
  resume()       {
    if (!this.paused) return
    this.paused = false
    this.origin = performance.now() - this.pauseAt
  }
  toggle()       { this.paused ? this.resume() : this.pause() }
  reset()       {
    this.origin = performance.now()
    this.pauseAt = 0
  }
}

export const CLOCK = new SquishyClock()

