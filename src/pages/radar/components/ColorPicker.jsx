import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { RgbaColorPicker } from 'react-colorful'

function hexToRgba(hex) {
  if (!hex || !hex.startsWith('#')) return { r: 0, g: 0, b: 0, a: 1 }
  const h = hex.slice(1)
  const r = parseInt(h.substring(0, 2), 16) || 0
  const g = parseInt(h.substring(2, 4), 16) || 0
  const b = parseInt(h.substring(4, 6), 16) || 0
  const a = h.length === 8 ? (parseInt(h.substring(6, 8), 16) / 255) : 1
  return { r, g, b, a }
}

function rgbaToHex({ r, g, b, a }) {
  const hex = '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
  if (a < 1) return hex + Math.round(a * 255).toString(16).padStart(2, '0')
  return hex
}

function rgbStringToHex(rgb) {
  const match = rgb.match(/\d+/g)
  if (!match || match.length < 3) return '#000000'
  return '#' + match.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
}

export default function ColorPicker({ color, onChange, className = '', defaultValue }) {
  const [open, setOpen] = useState(false)
  const [openDirection, setOpenDirection] = useState('down')
  const popoverRef = useRef(null)
  const swatchRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target) &&
          swatchRef.current && !swatchRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const isNone = !color || color === 'transparent'

  // Re-resolve when theme changes
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme'))
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  const resolvedHex = useMemo(() => {
    if (isNone) return '#000000'
    if (color && color.startsWith('#')) return color
    if (color === 'currentColor') return theme !== 'light' ? '#ffffff' : '#000000'
    if (swatchRef.current) {
      const computed = getComputedStyle(swatchRef.current)
      return rgbStringToHex(computed.color)
    }
    return theme !== 'light' ? '#ffffff' : '#000000'
  }, [color, open, isNone, theme])

  const rgbaColor = useMemo(() => hexToRgba(resolvedHex), [resolvedHex])

  const handleChange = (rgba) => {
    onChange(rgbaToHex(rgba))
  }

  // Swatch shows color with alpha via checkerboard background
  const swatchBg = isNone
    ? 'transparent'
    : rgbaColor.a < 1
      ? `rgba(${rgbaColor.r}, ${rgbaColor.g}, ${rgbaColor.b}, ${rgbaColor.a})`
      : resolvedHex

  return (
    <div className={`relative ${className}`}>
      <div
        ref={swatchRef}
        onClick={(e) => {
          if (e.altKey) { if (defaultValue !== undefined && onChange) onChange(defaultValue); return }
          if (!open && swatchRef.current) {
            const rect = swatchRef.current.getBoundingClientRect()
            const spaceBelow = window.innerHeight - rect.bottom
            setOpenDirection(spaceBelow < 260 ? 'up' : 'down')
          }
          setOpen(!open)
        }}
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '4px',
          border: '1px solid var(--kol-border-default)',
          backgroundColor: swatchBg,
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {isNone && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '-6px',
            right: '-6px',
            height: '2px',
            backgroundColor: 'var(--ui-error)',
            transform: 'rotate(-45deg)',
          }} />
        )}
      </div>
      {open && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            ...(openDirection === 'down'
              ? { top: (swatchRef.current?.getBoundingClientRect().bottom ?? 0) + 4, right: window.innerWidth - (swatchRef.current?.getBoundingClientRect().right ?? 0) }
              : { bottom: window.innerHeight - (swatchRef.current?.getBoundingClientRect().top ?? 0) + 4, right: window.innerWidth - (swatchRef.current?.getBoundingClientRect().right ?? 0) }),
            zIndex: 9999,
          }}
        >
          <style>{`
            .color-picker-small .react-colorful { width: 180px; height: 180px; border-radius: 4px; }
            .color-picker-small .react-colorful__saturation { border-radius: 4px 4px 0 0; }
            .color-picker-small .react-colorful__last-control { border-radius: 0 0 4px 4px; }
            .color-picker-small .react-colorful__pointer { width: 14px; height: 14px; border-width: 2px; }
          `}</style>
          <div className="color-picker-small">
            <RgbaColorPicker color={rgbaColor} onChange={handleChange} />
            <input
              type="text"
              value={resolvedHex}
              onChange={(e) => {
                const v = e.target.value
                if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(v)) onChange(v)
              }}
              style={{
                width: '180px',
                height: '28px',
                marginTop: '4px',
                padding: '0 8px',
                fontSize: '12px',
                fontFamily: 'var(--kol-font-family-mono)',
                color: 'var(--kol-surface-on-primary)',
                backgroundColor: 'var(--kol-surface-primary)',
                border: '1px solid var(--kol-border-default)',
                borderRadius: '4px',
                outline: 'none',
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
