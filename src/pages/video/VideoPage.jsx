import { useCallback, useEffect, useRef, useState } from 'react'
import Button from '../../components/atoms/Button.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import SegmentedToggle from '../../components/molecules/SegmentedToggle.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import Section from '../../components/molecules/Section.jsx'
import Divider from '../../components/atoms/Divider.jsx'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import EditorFooter from '../../components/framework/EditorFooter.jsx'
import { usePublishShortcuts } from '../../components/framework/pageShortcuts.jsx'
import Timeline from './Timeline.jsx'
import Stage from './Stage.jsx'
import { api, fileUrl, toPixelCrop } from './lib/api.js'
import { saveClip, loadClip, saveState, loadState } from './lib/persist.js'
import { PROJECTS, projectFor, outputDims, windowRect, DEFAULT_WINDOW } from './data/projects.js'
import { defaultAutoplay } from '../../lib/appSettings.js'

const DEFAULT_CROP = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }

// Page shortcuts — published to the `s` overlay (no inline hint strings on the
// stage). Space is owned by the footer TransportBar; i/o + ↑↓ are page-specific.
const SHORTCUTS = [
  ['space', 'play / pause'],
  ['I / O', 'set in / out point'],
  ['↑ / ↓', 'jump to in / out'],
]

export default function VideoPage() {
  const [file, setFile] = useState(null)
  const [srcUrl, setSrcUrl] = useState(null)
  const [meta, setMeta] = useState(null) // {width,height,duration}
  const [inPoint, setInPoint] = useState(0)
  const [outPoint, setOutPoint] = useState(0)
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(() => defaultAutoplay())
  const [tempo, setTempo] = useState(120) // 120 = realtime; drives clip playbackRate
  const [loop, setLoop] = useState(true)
  const [projectKey, setProjectKey] = useState('source')
  const [win, setWin] = useState(DEFAULT_WINDOW)
  const [crop, setCrop] = useState(DEFAULT_CROP)
  const [mode, setMode] = useState('fast')
  const [footTab, setFootTab] = useState('transport')
  const [uploadedId, setUploadedId] = useState(null)
  const [jobs, setJobs] = useState([])
  const videoRef = useRef(null)
  const fileRef = useRef(null)
  const restoringRef = useRef(null) // saved state held until metadata loads
  const hydratedRef = useRef(false) // gate persistence until the restore pass runs

  usePublishShortcuts('Video', SHORTCUTS)

  const project = projectFor(projectKey)
  const kind = project.ratio == null ? project.key : 'aspect' // 'source' | 'free' | 'aspect'
  const precise = mode === 'precise' || kind !== 'source'
  const out = project.ratio ? outputDims(project.ratio) : null

  useEffect(() => {
    const t = setInterval(() => { api.jobs().then(setJobs) }, 1500)
    return () => clearInterval(t)
  }, [])

  // tempo drives clip playback rate (120 = realtime) — the video-page convention.
  useEffect(() => {
    const v = videoRef.current
    if (v) v.playbackRate = Math.max(0.1, tempo / 120)
  }, [tempo, srcUrl])

  // smooth playhead + loop within the trimmed region while playing
  useEffect(() => {
    if (!playing) return
    let raf
    const tick = () => {
      const v = videoRef.current
      if (v) {
        if (v.currentTime >= outPoint) {
          if (loop) v.currentTime = inPoint
          else { v.pause(); v.currentTime = outPoint; setPlaying(false) }
        }
        setCurrent(v.currentTime)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, inPoint, outPoint, loop])

  // keyboard: ↑/↓ jump to in/out · i/o set in/out. Space (play/pause) is owned by
  // the footer TransportBar so it stays alive across footer tabs.
  useEffect(() => {
    const onKey = (e) => {
      const v = videoRef.current
      if (!v) return
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return
      const t = v.currentTime
      if (e.key === 'i' || e.key === 'I') setInPoint(Math.min(t, outPoint - 0.05))
      else if (e.key === 'o' || e.key === 'O') setOutPoint(Math.max(t, inPoint + 0.05))
      else if (e.key === 'ArrowUp') { e.preventDefault(); seek(inPoint) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); seek(outPoint) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inPoint, outPoint])

  // rehydrate clip (IndexedDB) + edit state (localStorage) after an accidental reload
  useEffect(() => {
    (async () => {
      const f = await loadClip()
      if (f) {
        const saved = loadState()
        restoringRef.current = saved || {} // trim restored once metadata loads
        setFile(f)
        setSrcUrl(URL.createObjectURL(f))
        if (saved) {
          setProjectKey(saved.projectKey ?? 'source')
          setWin(saved.win ?? DEFAULT_WINDOW)
          setCrop(saved.crop ?? DEFAULT_CROP)
          setMode(saved.mode ?? 'fast')
          setLoop(saved.loop ?? true)
        }
      }
      hydratedRef.current = true
    })()
  }, [])

  // persist edit state on change (cheap; clip itself is saved once, in onFile)
  useEffect(() => {
    if (!hydratedRef.current || !file) return
    saveState({ projectKey, win, crop, inPoint, outPoint, mode, loop })
  }, [file, projectKey, win, crop, inPoint, outPoint, mode, loop])

  const onFile = useCallback((f) => {
    if (!f || !f.type.startsWith('video/')) return
    restoringRef.current = null
    saveClip(f) // persist for reload survival
    setSrcUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(f) })
    setFile(f)
    setUploadedId(null)
    setMeta(null)
    setPlaying(false)
    setProjectKey('source')
    setWin(DEFAULT_WINDOW)
    setCrop(DEFAULT_CROP)
  }, [])

  const onLoadedMetadata = () => {
    const v = videoRef.current
    v.playbackRate = Math.max(0.1, tempo / 120)
    setMeta({ width: v.videoWidth, height: v.videoHeight, duration: v.duration })
    const saved = restoringRef.current
    restoringRef.current = null
    if (saved && saved.inPoint != null) {
      const ip = saved.inPoint
      const op = saved.outPoint ?? v.duration
      setInPoint(ip); setOutPoint(op); setCurrent(ip); v.currentTime = ip
    } else {
      setInPoint(0); setOutPoint(v.duration); setCurrent(0)
    }
  }

  const seek = (t) => { const v = videoRef.current; if (v) { v.currentTime = t; setCurrent(t) } }

  const play = () => {
    const v = videoRef.current
    if (!v) return
    if (v.currentTime < inPoint || v.currentTime >= outPoint) v.currentTime = inPoint
    v.playbackRate = Math.max(0.1, tempo / 120)
    v.play(); setPlaying(true)
  }
  const pause = () => { const v = videoRef.current; if (v) { v.pause(); setPlaying(false) } }
  const togglePlay = () => { const v = videoRef.current; if (v) v.paused ? play() : pause() }
  const stop = () => { const v = videoRef.current; if (v) v.pause(); seek(inPoint); setPlaying(false) }

  const changeProject = (key) => { setProjectKey(key); setWin(DEFAULT_WINDOW) }

  const exportClip = async () => {
    if (!file || !meta) return
    let sid = uploadedId
    if (!sid) { const up = await api.upload(file); sid = up.id; setUploadedId(sid) }
    let op
    if (kind === 'source') op = { kind: 'trim' }
    else if (kind === 'free') op = { kind: 'crop', crop: toPixelCrop(crop, meta) }
    else {
      const rect = windowRect(meta.width, meta.height, project.ratio, win)
      op = { kind: 'format', crop: toPixelCrop(rect, meta), out }
    }
    await api.process({ sourceId: sid, in: inPoint, out: outPoint, op, mode })
    api.jobs().then(setJobs)
  }

  const removeOutput = async (name) => { await api.deleteOutput(name); api.jobs().then(setJobs) }

  const clipLen = Math.max(0, outPoint - inPoint)

  // Source upload (File tab) + the empty-state dropzone share one hidden input.
  const sourceDrop = (
    <Section label="Source">
      <div
        className="border border-dashed border-fg-24 rounded p-4 text-center kol-mono-10 text-meta cursor-pointer hover:border-fg-48 hover:text-emphasis transition-colors"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}
      >
        {file ? <>{file.name}<br />drop to replace</> : <>Drop video<br />or click to choose</>}
      </div>
    </Section>
  )

  const footer = (
    <EditorFooter
      tab={footTab}
      onTab={setFootTab}
      transport={{ playing, onPlay: play, onPause: pause, onStop: stop, onRewind: () => seek(inPoint), tempo, onTempo: setTempo, tempoMax: 300 }}
      transportExtras={meta && (
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" iconOnly="skip-back" onClick={() => seek(inPoint)} aria-label="To in" title="To in (↑)" />
              <Button variant="ghost" size="sm" iconOnly="skip-forward" onClick={() => seek(outPoint)} aria-label="To out" title="To out (↓)" />
              <Button variant="ghost" size="sm" iconOnly="repeat" selected={loop} onClick={() => setLoop((l) => !l)} aria-label="Loop" title="Loop" />
            </div>
            <span className="kol-helper-10 text-meta tabular-nums">
              clip {clipLen.toFixed(2)}s{out ? ` · ${out.w}×${out.h}` : ''}
            </span>
          </div>
          <Timeline
            duration={meta.duration}
            inPoint={inPoint}
            outPoint={outPoint}
            current={current}
            onChangeIn={setInPoint}
            onChangeOut={setOutPoint}
            onSeek={seek}
          />
        </div>
      )}
      output={
        <div className="flex flex-col gap-3">
          <Button variant="primary" size="sm" className="w-full" onClick={exportClip} disabled={!meta} iconLeft="scissors">
            Export {precise ? 'precise' : 'fast'}
          </Button>
          {jobs.length > 0 && (
            <Section label="Outputs">
              <ul className="flex flex-col gap-1">
                {jobs.map((j) => (
                  <li key={j.id} className="flex items-center gap-2 kol-mono-10">
                    {j.status === 'done' ? (
                      <>
                        <a href={fileUrl(`outputs/${j.output}`)} download className="flex-1 min-w-0 truncate text-body hover:text-emphasis">{j.output}</a>
                        <Button variant="ghost" size="sm" iconOnly="cross" onClick={() => removeOutput(j.output)} aria-label="Delete output" title="Delete output" />
                      </>
                    ) : j.status === 'error' ? (
                      <span className="flex-1 text-meta" title={j.error}>{j.label} — failed</span>
                    ) : (
                      <>
                        <span className="w-28 truncate text-meta">{j.label}</span>
                        <span className="flex-1 h-1.5 bg-fg-08 rounded overflow-hidden"><span className="block h-full bg-fg-48 transition-all" style={{ width: `${j.progress}%` }} /></span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      }
      file={sourceDrop}
    />
  )

  return (
    <div className="min-h-dvh bg-surface-primary text-emphasis flex">
      {/* ── stage ── */}
      <main
        className="flex-1 p-6 flex flex-col gap-4 min-w-0 bg-surface-secondary"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}
      >
        {!srcUrl && (
          <div
            className="flex-1 flex items-center justify-center border border-dashed border-fg-24 rounded kol-mono-12 text-meta cursor-pointer hover:border-fg-48 hover:text-emphasis transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            Drop a video here, or click to choose
          </div>
        )}

        {srcUrl && (
          <Stage
            srcUrl={srcUrl}
            videoRef={videoRef}
            kind={kind}
            ratio={project.ratio}
            meta={meta}
            win={win}
            onWin={setWin}
            crop={crop}
            onCrop={setCrop}
            onLoadedMetadata={onLoadedMetadata}
            onTogglePlay={togglePlay}
          />
        )}

        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => onFile(e.target.files[0])} />
      </main>

      {/* ── rail ── */}
      <EditorRail
        footerBare
        header={<RailHeader>{file ? file.name : 'Video'}</RailHeader>}
        footer={footer}
      >
        <Section label="Trim">
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => setInPoint(Math.min(current, outPoint - 0.05))} disabled={!meta}>Set in (I)</Button>
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => setOutPoint(Math.max(current, inPoint + 0.05))} disabled={!meta}>Set out (O)</Button>
          </div>
          <p className="kol-helper-10 text-meta tabular-nums">
            {inPoint.toFixed(2)}s → {outPoint.toFixed(2)}s · {clipLen.toFixed(2)}s
          </p>
        </Section>

        <Divider />

        <Section label="Project">
          <Dropdown size="sm" variant="subtle" openUp className="w-full" value={projectKey} onChange={changeProject}
            options={PROJECTS.map((p) => ({ value: p.key, label: p.label }))} />
          {out && <p className="kol-helper-10 text-meta tabular-nums">output {out.w}×{out.h}</p>}
        </Section>

        {kind === 'aspect' && (
          <Section label="Window">
            <Slider labeled label="Zoom" min={1} max={5} step={0.05} value={win.zoom} onChange={(v) => setWin((w) => ({ ...w, zoom: v }))} />
            <Slider labeled label="X" min={0} max={1} step={0.01} value={win.ox} onChange={(v) => setWin((w) => ({ ...w, ox: v }))} />
            <Slider labeled label="Y" min={0} max={1} step={0.01} value={win.oy} onChange={(v) => setWin((w) => ({ ...w, oy: v }))} />
            <Button variant="primary" size="sm" className="w-full" onClick={() => setWin(DEFAULT_WINDOW)}>Reset window</Button>
          </Section>
        )}

        <Divider />

        <Section label="Quality">
          <SegmentedToggle value={mode} onChange={setMode}
            options={[{ value: 'fast', label: 'Fast' }, { value: 'precise', label: 'Precise' }]} />
        </Section>
      </EditorRail>
    </div>
  )
}
