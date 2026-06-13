const GridOverlay = ({
  zoom = 1,
  pan = { x: 0, y: 0 },
  gridSpacing = 64,
  axisColor = 'var(--kol-border-strong)',
  opacity = 0.16,
}) => {
  const scaledSpacing = gridSpacing * zoom
  const gridColor =
    'color-mix(in srgb, var(--kol-surface-on-primary) 18%, transparent)'
  const quadrantStyle = {
    backgroundImage: `linear-gradient(to right, ${gridColor} 1px, transparent 1px), linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)`,
    backgroundSize: `${scaledSpacing}px ${scaledSpacing}px`,
    opacity,
  }
  const axisLength = 100000

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-0">
        <div
          className="absolute top-0 left-0 h-1/2 w-1/2"
          style={{ ...quadrantStyle, backgroundPosition: 'bottom right' }}
        />
        <div
          className="absolute top-0 right-0 h-1/2 w-1/2"
          style={{ ...quadrantStyle, backgroundPosition: 'bottom left' }}
        />
        <div
          className="absolute bottom-0 left-0 h-1/2 w-1/2"
          style={{ ...quadrantStyle, backgroundPosition: 'top right' }}
        />
        <div
          className="absolute bottom-0 right-0 h-1/2 w-1/2"
          style={{ ...quadrantStyle, backgroundPosition: 'top left' }}
        />
      </div>
      <svg className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          <line
            x1={-axisLength}
            y1={0}
            x2={axisLength}
            y2={0}
            stroke={axisColor}
            strokeWidth="1"
          />
          <line
            x1={0}
            y1={-axisLength}
            x2={0}
            y2={axisLength}
            stroke={axisColor}
            strokeWidth="1"
          />
        </g>
      </svg>
    </>
  )
}

export default GridOverlay
