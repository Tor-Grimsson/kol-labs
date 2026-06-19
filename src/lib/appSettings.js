// appSettings — app-wide preferences, persisted to localStorage. Tiny pub/sub so
// a control (e.g. on Home) and the pages that read a default stay in sync within
// the SPA session. Pages seed their initial export aspect from here at mount.
//
//   defaultAspectFor('view')   -> '4:5' (or the surface native if set to 'native')
//   setAppSetting('defaultAspect', '1:1')
//   const { defaultAspect } = useAppSettings()

import { useEffect, useState } from 'react'

const KEY = 'kol-labs:settings'
const DEFAULTS = { defaultAspect: '4:5', defaultTheme: 'kol', autoplay: false, clipToFrame: true, audioReactive: false }

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') } }
  catch { return { ...DEFAULTS } }
}

let state = load()
const subs = new Set()

export function getAppSettings() { return state }

export function setAppSetting(key, value) {
  state = { ...state, [key]: value }
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* private mode — ignore */ }
  subs.forEach((fn) => fn(state))
}

export function subscribeAppSettings(fn) { subs.add(fn); return () => subs.delete(fn) }

export function useAppSettings() {
  const [s, set] = useState(state)
  useEffect(() => subscribeAppSettings(set), [])
  return s
}

/**
 * Resolve the global default export aspect for a surface. The stored value is
 * one of the /export-specs ratio values, or 'native' meaning each surface keeps
 * its own native row (math/3D = 'fill', radar source = 'source').
 */
export function defaultAspectFor(surface = 'view') {
  const a = state.defaultAspect
  if (!a || a === 'native') return surface === 'source' ? 'source' : 'fill'
  return a
}

/**
 * The global default theme id (set on Home). Pages seed their theme state from
 * this at mount, the same way they seed their export aspect.
 */
export function defaultTheme() {
  return state.defaultTheme || 'kol'
}

/**
 * Whether pages should start playing on mount. Default false (paused).
 * Pages that respect autoplay read this at mount via getAppSettings().autoplay.
 */
export function defaultAutoplay() {
  return state.autoplay === true
}

/**
 * Whether exports crop to the chosen aspect frame. Default true.
 * Pages seed their clip state from this at mount via getAppSettings().clipToFrame.
 */
export function defaultClipToFrame() {
  return state.clipToFrame !== false
}

/**
 * Whether the mic analyser drives the audio expression variables (level/bass/
 * mid/high). Default false. Only actually starts on an explicit toggle (a user
 * gesture); persisted true is best-effort resumed on Home mount.
 */
export function defaultAudioReactive() {
  return state.audioReactive === true
}
