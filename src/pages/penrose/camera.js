// Camera: drag = pan · wheel = zoom-at-cursor · shift-drag = rotate X/Y · alt-drag = rotate Z.
// Applies as a CSS transform on the target element. Click events still reach canvas children
// because we don't call preventDefault on pointerup and the browser treats tap as click.






export const CAMERA_DEFAULT              = { tx: 0, ty: 0, scale: 1, rx: 0, ry: 0, rz: 0 }

export class Camera {
  state              = { ...CAMERA_DEFAULT }
          subs                                  = []
          el
          dragging = false
          rotMode                    = null
          lx = 0
          ly = 0

  constructor(target             ) {
    this.el = target
    this.attach()
    this.apply()
  }

  subscribe(fn                          ) {
    this.subs.push(fn)
    return () => { this.subs = this.subs.filter(s => s !== fn) }
  }

  get snapshot()              { return { ...this.state } }

  set(patch                      ) {
    Object.assign(this.state, patch)
    this.apply()
  }

  reset() {
    this.state = { ...CAMERA_DEFAULT }
    this.apply()
  }

          apply() {
    const { tx, ty, scale, rx, ry, rz } = this.state
    this.el.style.transform =
      `translate(${tx}px, ${ty}px) scale(${scale}) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`
    this.el.style.transformOrigin = 'center center'
    for (const fn of this.subs) fn(this.state)
  }

          onDown = (e              ) => {
    if (e.button !== 0) return
    this.dragging = true
    this.rotMode = e.shiftKey ? 'xy' : e.altKey ? 'z' : null
    this.lx = e.clientX
    this.ly = e.clientY
    this.el.setPointerCapture(e.pointerId)
  }

          onMove = (e              ) => {
    if (!this.dragging) return
    const dx = e.clientX - this.lx
    const dy = e.clientY - this.ly
    this.lx = e.clientX
    this.ly = e.clientY
    if (this.rotMode === 'xy') {
      this.state.ry += dx * 0.4
      this.state.rx -= dy * 0.4
    } else if (this.rotMode === 'z') {
      this.state.rz += dx * 0.4
    } else {
      this.state.tx += dx
      this.state.ty += dy
    }
    this.apply()
  }

          onUp = (e              ) => {
    this.dragging = false
    this.rotMode = null
    try { this.el.releasePointerCapture(e.pointerId) } catch { /* noop */ }
  }

          onWheel = (e            ) => {
    if (e.ctrlKey) return
    e.preventDefault()
    if (e.altKey) {
      this.state.rz += e.deltaY * 0.2
      this.apply()
      return
    }
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    const rect = this.el.getBoundingClientRect()
    const cx = e.clientX - (rect.left + rect.width / 2)
    const cy = e.clientY - (rect.top + rect.height / 2)
    this.state.tx = (this.state.tx - cx) * factor + cx
    this.state.ty = (this.state.ty - cy) * factor + cy
    this.state.scale *= factor
    this.state.scale = Math.max(0.1, Math.min(40, this.state.scale))
    this.apply()
  }

          attach() {
    this.el.addEventListener('pointerdown', this.onDown)
    this.el.addEventListener('pointermove', this.onMove)
    this.el.addEventListener('pointerup', this.onUp)
    this.el.addEventListener('pointercancel', this.onUp)
    this.el.addEventListener('wheel', this.onWheel, { passive: false })
  }

  detach() {
    this.el.removeEventListener('pointerdown', this.onDown)
    this.el.removeEventListener('pointermove', this.onMove)
    this.el.removeEventListener('pointerup', this.onUp)
    this.el.removeEventListener('pointercancel', this.onUp)
    this.el.removeEventListener('wheel', this.onWheel)
  }
}
