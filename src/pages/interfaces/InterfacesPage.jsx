import { useEffect, useRef, useState } from 'react'
import Button from '../../components/atoms/Button.jsx'
import Divider from '../../components/atoms/Divider.jsx'
import Section from '../../components/molecules/Section.jsx'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import './synth.css'
import { SCREENS } from './screens'

export default function InterfacesPage() {
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [recording, setRecording] = useState(false)
  const [stopNonce, setStopNonce] = useState(0)

  const hostRef = useRef(null)
  const instancesRef = useRef([])
  const playingRef = useRef(true)

  // Sync play state to live p5 instances. Declared before the mount effect so
  // playingRef is current when a screen mounts in the same commit (stop).
  useEffect(() => {
    playingRef.current = playing
    for (const p of instancesRef.current) {
      if (playing) p.loop()
      else p.noLoop()
    }
  }, [playing])

  // Mount the current screen: def.build(node) appends widget DOM + returns p5
  // instances; widgets hang _cleanup on their elements.
  useEffect(() => {
    const def = SCREENS[idx]
    const node = hostRef.current
    const instances = def.build(node)
    instancesRef.current = instances
    const cleanups = []
    node.querySelectorAll('*').forEach((n) => {
      if (n._cleanup) cleanups.push(n._cleanup)
    })
    for (const p of instances) {
      if (playingRef.current) p.loop()
      else p.noLoop()
    }
    return () => {
      for (const p of instances) p.remove()
      for (const c of cleanups) c()
      instancesRef.current = []
      node.innerHTML = ''
    }
  }, [idx, stopNonce])

  const go = (d) => setIdx((i) => (i + d + SCREENS.length) % SCREENS.length)
  const doStop = () => { setPlaying(false); setStopNonce((n) => n + 1) /* fresh remount */ }
  const doRec = () => setRecording((r) => !r)
  const toggle = () => setPlaying((p) => !p)

  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') { go(-1); e.preventDefault() }
      else if (e.key === 'ArrowRight') { go(1); e.preventDefault() }
      else if (e.code === 'Space') { toggle(); e.preventDefault() }
      else if (e.key === 's' || e.key === 'S') { doStop() }
      else if (e.key === 'r' || e.key === 'R') { doRec() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date()
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      document.querySelectorAll('.js-clock').forEach((n) => { n.textContent = `${hh}:${mm}` })
    }, 10_000)
    return () => clearInterval(id)
  }, [])

  const def = SCREENS[idx]
  return (
    <div className="flex min-h-dvh">
      {/* Stage: lofi scope — only the artwork lives inside .interfaces-page */}
      <div className="interfaces-page flex-1 min-w-0 bg-surface-primary">
        <div key={`${idx}:${stopNonce}`} className={`screen theme-${def.theme ?? 'default'}`} ref={hostRef} />
      </div>

      {/* Chrome: unified editor rail, outside the lofi CSS scope */}
      <EditorRail>
        <RailHeader><b>{def.id}</b> / {String(SCREENS.length).padStart(2, '0')} · {def.title}</RailHeader>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => go(-1)}>← prev</Button>
          <Button variant="outline" size="sm" onClick={() => go(1)}>next →</Button>
        </div>

        <Divider />

        <Section label="Transport">
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" iconOnly="stop" title="Stop & reset (S)" onClick={doStop} />
            <Button variant="ghost" size="sm" iconOnly="play" title="Play (Space)" selected={playing} onClick={() => setPlaying(true)} />
            <Button variant="ghost" size="sm" iconOnly="pause" title="Pause (Space)" selected={!playing} onClick={() => setPlaying(false)} />
            <Button variant="ghost" size="sm" iconOnly="circle" title="Record (R)" selected={recording} onClick={doRec} />
          </div>
        </Section>

        <Divider />

        <div className="kol-helper-10 text-body flex flex-col gap-1">
          <div>SPACE · PLAY/PAUSE</div>
          <div>←/→ · SCREEN</div>
          <div>S · STOP</div>
          <div>R · REC</div>
        </div>

        <div className="kol-helper-10 text-body">{def.subtitle}</div>
      </EditorRail>
    </div>
  )
}
