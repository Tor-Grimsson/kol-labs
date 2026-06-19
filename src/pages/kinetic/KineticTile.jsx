import { useEffect, useRef, useState } from 'react'
import KineticType from './engine/KineticType.js'
import { loadFonts } from './lib/vfAxes.js'
import Button from '../../components/atoms/Button.jsx'

const TILE_W = 180
const TILE_H = 225

/**
 * Gallery / Library / Saved tile. Lazy-mounts a paused KineticType preview only
 * when scrolled into view; animates on hover (mirrors interfaces' ScreenTile).
 * Takes resolved `params` + a stable `keyId` (preset id or saved ts) so the mount
 * effect doesn't churn on the params object's changing identity. Optional
 * `onDelete` renders a corner badge (saved-composition grid, like GenTile).
 */
export default function KineticTile({ params, label, keyId, playing, focused, onClick, onOpen, onDelete }) {
  const wrapRef = useRef(null)
  const hostRef = useRef(null)
  const engRef = useRef(null)
  const paramsRef = useRef(params)
  paramsRef.current = params
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState(false)
  const active = playing && hovered

  useEffect(() => {
    loadFonts()
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '300px' })
    if (wrapRef.current) io.observe(wrapRef.current)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (focused) wrapRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [focused])

  useEffect(() => {
    if (!visible) return
    const node = hostRef.current
    const eng = new KineticType(node, paramsRef.current)
    eng.resize(TILE_W, TILE_H)
    eng.setTransport({ paused: true, speed: 1 })
    engRef.current = eng
    return () => {
      eng.dispose()
      engRef.current = null
      if (node) node.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, keyId])

  useEffect(() => {
    engRef.current?.setTransport({ paused: !active, speed: 1 })
  }, [active])

  return (
    <div
      ref={wrapRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative flex flex-col gap-1"
    >
      <button type="button" onClick={onClick} onDoubleClick={onOpen} title="Click to select · double-click to open" className="block text-left">
        <div
          className={`overflow-hidden rounded border transition-colors ${focused ? 'border-yellow-400 ring-2 ring-yellow-400' : 'border-fg-08 group-hover:border-fg-24'}`}
          style={{ width: TILE_W, height: TILE_H }}
        >
          <div ref={hostRef} style={{ width: TILE_W, height: TILE_H }} />
        </div>
      </button>
      <div className="flex items-center justify-between gap-2" style={{ maxWidth: TILE_W }}>
        <span className="kol-helper-10 text-meta group-hover:text-emphasis transition-colors truncate">{label}</span>
        {onDelete && (
          <Button variant="ghost" size="sm" quiet iconOnly="cross" iconSize={12} aria-label="Delete" onClick={onDelete} />
        )}
      </div>
    </div>
  )
}
