import Section from '../../../components/molecules/Section.jsx'
import Tag from '../../../components/molecules/Tag.jsx'

function ModesPanel({ modes, activeMode, onSelectMode }) {
  return (
    <aside className="w-full">
      <div>
        <p className="kol-helper-12 uppercase text-meta">Kolkrabbi</p>
        <h1 className="mt-3 kol-mono-20 uppercase tracking-[0.08em] text-emphasis">
          Workshop
        </h1>
        <p className="mt-2 kol-mono-12 text-meta">
          Distressed outlines from basic vectors with print-worn texture.
        </p>

        <div className="mt-6 space-y-5 border-t border-fg-08 pt-5">
          <Section label="Distortion Modes">
            <div className="grid gap-2">
              {modes.map((mode) => {
                const isActive = mode.id === activeMode.id
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onSelectMode(mode)}
                    className={`flex items-center justify-between gap-3 rounded border px-4 py-2 text-left transition ${
                      isActive
                        ? 'border-fg-24 bg-fg-04 text-emphasis'
                        : 'border-fg-08 text-meta hover:border-fg-16 hover:text-emphasis'
                    }`}
                  >
                    <span className="kol-helper-12 uppercase">{mode.name}</span>
                    <span className="kol-mono-10 text-meta">{mode.tags[0]}</span>
                  </button>
                )
              })}
            </div>
          </Section>

          <div className="rounded border border-fg-08 bg-surface-primary p-4">
            <Section label="Selected">
              <p className="kol-mono-14 text-emphasis">{activeMode.name}</p>
              <p className="kol-mono-12 text-meta">{activeMode.blurb}</p>
              <div className="flex flex-wrap gap-2">
                {activeMode.tags.map((tag) => (
                  <Tag key={tag} size="sm" hash={false}>
                    {tag}
                  </Tag>
                ))}
              </div>
            </Section>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default ModesPanel
