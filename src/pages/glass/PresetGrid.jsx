import { useEffect, useRef } from 'react'
import { PRESETS } from './registry.js'
import { renderGlass, makePlaceholder } from './engine/displace.js'

const THUMB = 96

// The preset picker — each cell previews that preset's full config on the current
// source (or a synthetic placeholder before a photo is loaded).
export default function PresetGrid({ source, value, onChange }) {
  const refs = useRef({})
  const phRef = useRef(null)

  useEffect(() => {
    const src = source || (phRef.current ||= makePlaceholder(THUMB))
    for (const p of PRESETS) {
      const cv = refs.current[p.id]
      if (cv) renderGlass(cv, src, { ...p.params, ss: 1, time: 0 })
    }
  }, [source])

  return (
    <div className="grid grid-cols-5 gap-1.5">
      {PRESETS.map((p) => {
        const active = p.id === value
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            title={p.label}
            className="relative overflow-hidden rounded-sm"
            style={{
              aspectRatio: '1',
              outline: active ? '2px solid var(--kol-accent-primary)' : '1px solid var(--kol-border-default)',
              outlineOffset: active ? '-1px' : '0',
            }}
          >
            <canvas
              ref={(el) => { if (el) refs.current[p.id] = el }}
              width={THUMB}
              height={THUMB}
              className="block h-full w-full object-cover"
            />
          </button>
        )
      })}
    </div>
  )
}
