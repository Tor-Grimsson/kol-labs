import Badge from '../../../components/molecules/Badge.jsx'
import Dropdown from '../../../components/molecules/Dropdown.jsx'
import Divider from '../../../components/atoms/Divider.jsx'
import Section from '../../../components/molecules/Section.jsx'

function ModesPanel({ modes, activeMode, onSelectMode }) {
  return (
    <>
      <Section label="Distortion modes">
        <Dropdown
          size="sm"
          variant="subtle"
          className="w-full"
          value={activeMode.id}
          onChange={(id) => onSelectMode(modes.find((m) => m.id === id))}
          options={modes.map((m) => ({ value: m.id, label: m.name }))}
        />
      </Section>

      <Divider />

      <Section label="Selected">
        <p className="kol-mono-14 text-emphasis">{activeMode.name}</p>
        <p className="kol-mono-12 text-meta">{activeMode.blurb}</p>
        <div className="flex flex-wrap gap-2">
          {activeMode.tags.map((tag) => (
            <Badge key={tag} variant="secondary" size="sm">
              {tag}
            </Badge>
          ))}
        </div>
      </Section>
    </>
  )
}

export default ModesPanel
