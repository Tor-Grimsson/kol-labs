import { useState } from 'react'
import ClipEditor from './components/ClipEditor'
import { CLIPS, DEFAULT_CLIP } from './data/clips'
import { mulberry32, randomSeed } from '../../../lib/rng.js'
import Button from '../../../components/atoms/Button.jsx'
import Section from '../../../components/molecules/Section.jsx'

// Uzumaki — math-expression curve visualiser. The editable clip harness lives in
// ClipEditor; this page only owns the preset selection + the clip gallery (fed in
// as the rail extras). Picking a clip swaps ClipEditor's base, which drops edits.
export default function UzumakiPage() {
  const [clipId, setClipId] = useState(DEFAULT_CLIP.id)
  const [seed, setSeed] = useState(1)
  const base = CLIPS.find((c) => c.id === clipId) || DEFAULT_CLIP

  // Randomise → pick a random preset clip from the gallery.
  const rollFrom = (s) => {
    const rng = mulberry32(s)
    const c = CLIPS[Math.floor(rng() * CLIPS.length)]
    if (c) setClipId(c.id)
  }
  const onRandomize = () => { const s = randomSeed(); setSeed(s); rollFrom(s) }
  const getExtraSettings = () => ({ clipId })
  const applyExtraSettings = (st) => { if (st.clipId != null) setClipId(st.clipId) }

  const gallery = (
    <>
      <Section label="Clips">
        <div className="flex flex-col gap-1">
          {CLIPS.map((c) => (
            <Button
              key={c.id}
              variant="secondary"
              size="sm"
              selected={c.id === clipId}
              onClick={() => setClipId(c.id)}
              className="w-full"
              style={{ justifyContent: 'flex-start' }}
            >
              {c.title}
            </Button>
          ))}
        </div>
      </Section>
      <div className="kol-helper-10 text-body">{CLIPS.length} clips · function + keyframes</div>
    </>
  )

  return (
    <ClipEditor
      baseClip={base}
      headerLabel="Curves"
      railExtras={gallery}
      settingsPage="math-uzumaki"
      onRandomize={onRandomize}
      seed={seed}
      onSeed={(n) => { setSeed(n); rollFrom(n) }}
      getExtraSettings={getExtraSettings}
      applyExtraSettings={applyExtraSettings}
    />
  )
}
