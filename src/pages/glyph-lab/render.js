



















export function render(
  ctx                          ,
  W        ,
  H        ,
  circles          ,
  edges        ,
  outline         ,
  opts            ,
)       {
  ctx.fillStyle = opts.bg
  ctx.fillRect(0, 0, W, H)

  // spokes (behind)
  ctx.strokeStyle = opts.spokeColor
  ctx.lineWidth = opts.spokeWidth
  ctx.beginPath()
  for (const c of circles) {
    for (let i = 0; i < opts.spokeCount; i++) {
      const t = (i / opts.spokeCount) * Math.PI * 2
      ctx.moveTo(c.x, c.y)
      ctx.lineTo(c.x + Math.cos(t) * c.r, c.y + Math.sin(t) * c.r)
    }
  }
  ctx.stroke()

  // edges between adjacent circles
  ctx.strokeStyle = opts.edgeColor
  ctx.lineWidth = opts.edgeWidth
  ctx.beginPath()
  for (const e of edges) {
    const a = circles[e.a], b = circles[e.b]
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
  }
  ctx.stroke()

  // boundary nodes: dot ring per circle at radius
  for (const c of circles) {
    for (let i = 0; i < opts.spokeCount; i++) {
      const t = (i / opts.spokeCount) * Math.PI * 2
      const bx = c.x + Math.cos(t) * c.r
      const by = c.y + Math.sin(t) * c.r
      ctx.fillStyle = opts.boundaryFill
      ctx.beginPath()
      ctx.arc(bx, by, opts.boundarySize, 0, Math.PI * 2)
      ctx.fill()
      if (opts.boundaryStrokeW > 0) {
        ctx.strokeStyle = opts.boundaryStroke
        ctx.lineWidth = opts.boundaryStrokeW
        ctx.stroke()
      }
    }
  }

  // center dots
  ctx.fillStyle = opts.centerColor
  for (const c of circles) {
    ctx.beginPath()
    ctx.arc(c.x, c.y, opts.centerSize, 0, Math.PI * 2)
    ctx.fill()
  }

  // outline ring
  ctx.fillStyle = opts.outlineColor
  for (const p of outline) {
    ctx.beginPath()
    ctx.arc(p[0], p[1], opts.outlineSize, 0, Math.PI * 2)
    ctx.fill()
  }
}
