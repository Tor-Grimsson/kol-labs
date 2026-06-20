/* ChipsRow — pill-style chips for character-set filtering (e.g. "Rounds",
 * "Stems", "Bowls"). One selected at a time. */

export default function ChipsRow({ options, value, onChange, className = '' }) {
  return (
    <div className={`flex items-center gap-1 flex-wrap ${className}`}>
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange?.(opt.value)}
            className={`px-2 py-0.5 rounded kol-helper-10 tracking-widest border transition-colors ${
              active
                ? 'bg-fg-16 border-fg-24 text-emphasis'
                : 'bg-transparent border-fg-08 text-meta hover:border-fg-16 hover:text-body'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
