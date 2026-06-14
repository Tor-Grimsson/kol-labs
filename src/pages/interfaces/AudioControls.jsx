import { useRef, useState } from 'react'
import Section from '../../components/molecules/Section.jsx'
import Button from '../../components/atoms/Button.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import { recordWebm } from './lib/download.js'
import {
  startMic, loadFile, stop as stopAudio, play, pause, seek, duration, onEnded,
  recStream, isActive, isFile, isPlaying,
} from './lib/audio.js'

/**
 * Audio source + transport for the reactive widgets (EQ Bars / Bars / VU + the
 * global `--audio` pulse). Source: Off / Mic / File. With a File loaded and a
 * recordable canvas (getCanvas), "Export synced" replays the track from 0 and
 * records the widget for its full length with the audio muxed in.
 *
 * Self-contained: reads the still-running audio singleton on mount so the UI
 * re-syncs when the rail remounts on a view switch (the engine is NOT stopped
 * on unmount — that's the page's job when leaving interfaces).
 */
export default function AudioControls({ getCanvas }) {
  const [src, setSrc] = useState(() => (isActive() ? (isFile() ? 'file' : 'mic') : 'off'))
  const [fileName, setFileName] = useState('')
  const [playing, setPlaying] = useState(() => isPlaying())
  const [exporting, setExporting] = useState(false)
  const fileRef = useRef(null)
  const stopRecRef = useRef(null)

  const chooseSrc = async (v) => {
    if (v === 'off') { stopAudio(); setSrc('off'); setPlaying(false); return }
    if (v === 'mic') { const ok = await startMic(); setSrc(ok ? 'mic' : 'off'); setPlaying(false); return }
    if (v === 'file') fileRef.current?.click() // src flips to 'file' once a file is picked
  }

  const onPick = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    await loadFile(f)
    setFileName(f.name)
    setSrc('file')
    setPlaying(false)
  }

  const togglePlay = () => {
    if (playing) { pause(); setPlaying(false) }
    else { play(); setPlaying(true) }
  }

  const exportSynced = () => {
    const canvas = getCanvas?.()
    if (!canvas || !isFile()) return
    setExporting(true)
    pause(); seek(0)
    const d = duration()
    const secs = d ? Math.ceil(d) + 0.3 : 600 // onEnded is the real stop; timer is a backstop
    onEnded(() => stopRecRef.current?.())
    stopRecRef.current = recordWebm(canvas, 'interfaces-audio', {
      seconds: secs,
      audioStream: recStream(),
      onStop: () => { setExporting(false); setPlaying(false) },
    })
    play(); setPlaying(true)
  }

  return (
    <Section label="Audio">
      <SegmentedToggle
        value={src}
        onChange={chooseSrc}
        options={[{ value: 'off', label: 'Off' }, { value: 'mic', label: 'Mic' }, { value: 'file', label: 'File' }]}
      />
      <input ref={fileRef} type="file" accept="audio/*" hidden onChange={onPick} />
      {src === 'file' && (
        <>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" iconOnly={playing ? 'pause' : 'play'} title={playing ? 'Pause' : 'Play'} onClick={togglePlay} />
            <span className="kol-helper-10 text-meta flex-1 truncate">{fileName || 'no file'}</span>
            <Button variant="primary" size="sm" onClick={() => fileRef.current?.click()}>Change</Button>
          </div>
          {getCanvas && (
            <Button variant="primary" size="sm" className="w-full" iconLeft="download" disabled={exporting} onClick={exportSynced}>
              {exporting ? 'Recording…' : 'Export synced webm'}
            </Button>
          )}
        </>
      )}
    </Section>
  )
}
