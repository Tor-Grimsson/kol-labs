/**
 * Icon Component
 *
 * Dynamically loads and renders SVG icons from the svg/ directory (including subdirectories)
 *
 * @param {Object} props
 * @param {string} props.name - Icon name (matches SVG filename without extension)
 * @param {number|string} props.size - Icon size (default: 16)
 * @param {string} props.className - Additional classes
 * @param {Object} props.style - Inline styles
 * @param {ReactNode} props.children - Optional: Direct SVG path content for custom icons
 */
import { useEffect, useState } from 'react'

/* Unified icon home. Canonical mirrored set (stroke + solid) + legacy loader set
 * + web's app-specific set (chess/dashboard/docs), all folded into this package so
 * a name always resolves across web + brand. `variant` picks stroke vs solid.
 *
 * The ~2,259 raw SVG strings live in ./iconData.js and are pulled in via a single
 * dynamic import — that keeps them out of the entry chunk (off the critical first-
 * paint path) and streams them in their own async chunk. Once loaded the maps are
 * cached at module scope, so resolution stays synchronous for every render after. */
let ICONS = null            // { STROKE, SOLID, WEB, LEGACY } once the chunk resolves
let loadPromise = null
const subscribers = new Set()

const loadIcons = () => {
  if (!loadPromise) {
    loadPromise = import('./iconData.js').then((mod) => {
      ICONS = mod
      subscribers.forEach((fn) => fn())
      return mod
    })
  }
  return loadPromise
}

// Start fetching the icon chunk the moment this module evaluates, in parallel with
// the rest of boot — by first paint it's usually already in flight or resolved.
loadIcons()

const useIconsReady = () => {
  const [ready, setReady] = useState(() => !!ICONS)
  useEffect(() => {
    if (ICONS) return undefined
    const cb = () => setReady(true)
    subscribers.add(cb)
    loadIcons()
    return () => subscribers.delete(cb)
  }, [])
  return ready
}

/* Canonical staging variant wins (kills drift); then the other variant, then the
 * legacy loader set, then web's app-specific icons. */
const resolveIcon = (name, variant) => {
  if (!ICONS) return undefined
  return (variant === 'solid' ? ICONS.SOLID : ICONS.STROKE)[name]
    ?? (variant === 'solid' ? ICONS.STROKE : ICONS.SOLID)[name]
    ?? ICONS.LEGACY[name]
    ?? ICONS.WEB[name]
}

const normalizeSize = (value) => {
  if (typeof value === 'number') {
    return `${value}px`
  }
  if (typeof value === 'string') {
    return value
  }
  return '16px'
}

const applySizeToMarkup = (markup, sizeValue) => {
  let updated = markup

  if (/width="/i.test(updated)) {
    updated = updated.replace(/width="[^"]*"/i, `width="${sizeValue}"`)
  } else {
    updated = updated.replace('<svg', `<svg width="${sizeValue}"`)
  }

  if (/height="/i.test(updated)) {
    updated = updated.replace(/height="[^"]*"/i, `height="${sizeValue}"`)
  } else {
    updated = updated.replace('<svg', `<svg height="${sizeValue}"`)
  }

  return updated
}

const Icon = ({
  name,
  size = 16,
  variant = 'stroke',
  className = '',
  style = {},
  children
}) => {
  const ready = useIconsReady()

  // If children are provided, render directly (for custom icons)
  if (children) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        className={`inline-block ${className}`}
        style={{
          verticalAlign: 'middle',
          ...style
        }}
      >
        {children}
      </svg>
    )
  }

  const dimension = normalizeSize(size)

  // Icon map still streaming in — hold the layout box so the icon pops in without
  // shifting anything. Only ever shown on the first paint before the chunk lands.
  if (!ready) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center ${className}`}
        style={{ width: dimension, height: dimension, lineHeight: 0, ...style }}
      />
    )
  }

  const svgMarkup = resolveIcon(name, variant)

  if (!svgMarkup) {
    console.warn(`Icon "${name}" not found in icon set`)
    return null
  }

  const sizedMarkup = applySizeToMarkup(svgMarkup, dimension)

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={{
        width: dimension,
        height: dimension,
        lineHeight: 0,
        ...style
      }}
      dangerouslySetInnerHTML={{ __html: sizedMarkup }}
    />
  )
}

export default Icon
