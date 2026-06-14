import { useEffect, useRef, useState } from 'react'

function PreviewPanel({
  svgSource,
  preview,
  allowPan = false,
  zoom = 1,
  objectScale = 1,
  pan: panProp,
  setPan: setPanProp,
}) {
  const [localPan, setLocalPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [spaceActive, setSpaceActive] = useState(false)
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const pan = panProp || localPan
  const setPan = setPanProp || setLocalPan

  useEffect(() => {
    if (!allowPan) return
    const handleKeyDown = (event) => {
      if (event.code === 'Space') {
        event.preventDefault()
        setSpaceActive(true)
      }
    }
    const handleKeyUp = (event) => {
      if (event.code === 'Space') {
        event.preventDefault()
        setSpaceActive(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [allowPan])

  const cursorClass = isPanning ? 'cursor-grabbing' : spaceActive ? 'cursor-grab' : 'cursor-default'

  return (
    <div
      className={`relative z-10 flex h-full w-full items-center justify-center ${allowPan ? 'pointer-events-auto' : 'pointer-events-none'} ${cursorClass}`}
      onPointerDown={(event) => {
        if (!allowPan || !spaceActive) return
        panStartRef.current = {
          x: event.clientX,
          y: event.clientY,
          panX: pan.x,
          panY: pan.y,
        }
        setIsPanning(true)
      }}
      onPointerMove={(event) => {
        if (!allowPan || !isPanning) return
        const dx = event.clientX - panStartRef.current.x
        const dy = event.clientY - panStartRef.current.y
        setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy })
      }}
      onPointerUp={() => setIsPanning(false)}
      onPointerLeave={() => setIsPanning(false)}
    >
      {svgSource.trim().length > 0 ? (
        <div
          className="max-h-[70vh] max-w-[70vw]"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <div
            className="[&_svg]:max-h-full [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:w-auto"
            style={{ transform: `scale(${objectScale})` }}
          >
            <div dangerouslySetInnerHTML={{ __html: preview.html }} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default PreviewPanel
