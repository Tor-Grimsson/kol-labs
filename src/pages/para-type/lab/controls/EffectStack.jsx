/* EffectStack — list of FX presets with one-click toggles. Sets a single
 * active filter (radio-style for simplicity in v1; could be multi-toggle
 * later). */

import { FX_PRESETS } from '../effects/filters.jsx'

export default function EffectStack({ value, onChange, className = '' }) {
  return (
    <div className={`grid grid-cols-2 gap-1 ${className}`}>
      {FX_PRESETS.map(fx => {
        const active = fx.id === value
        return (
          <button
            key={fx.id}
            type="button"
            onClick={() => onChange?.(fx.id)}
            className={`px-2 py-1.5 rounded text-left border transition-colors kol-mono-12 ${
              active
                ? 'bg-fg-16 border-fg-24 text-emphasis'
                : 'bg-transparent border-fg-08 text-body hover:border-fg-16'
            }`}
          >
            {fx.label}
          </button>
        )
      })}
    </div>
  )
}
