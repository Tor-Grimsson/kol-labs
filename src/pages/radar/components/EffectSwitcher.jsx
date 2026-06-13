import { useLocation, useNavigate } from 'react-router-dom'
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'
import { EFFECTS } from '../effects/effectsRegistry'

/** Segmented control in each panel header that routes between effects. */
export default function EffectSwitcher() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const current = EFFECTS.find((e) => e.to === pathname)?.id ?? EFFECTS[0].id

  return (
    <SegmentedToggle
      value={current}
      onChange={(id) => {
        const next = EFFECTS.find((e) => e.id === id)
        if (next) navigate(next.to)
      }}
      options={EFFECTS.map((e) => ({ value: e.id, label: e.label }))}
    />
  )
}
