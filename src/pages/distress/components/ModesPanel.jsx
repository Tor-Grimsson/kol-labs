import Badge from '../../../components/molecules/Badge.jsx'
import Button from '../../../components/atoms/Button.jsx'
import Divider from '../../../components/atoms/Divider.jsx'
import Section from '../../../components/molecules/Section.jsx'

function ModesPanel({ modes, activeMode, onSelectMode }) {
  return (
    <>
      <Section label="Distortion modes">
        <div className="flex flex-col gap-1">
          {modes.map((mode) => (
            <Button
              key={mode.id}
              variant="primary"
              size="sm"
              selected={mode.id === activeMode.id}
              className="w-full"
              onClick={() => onSelectMode(mode)}
            >
              {mode.name}
            </Button>
          ))}
        </div>
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
