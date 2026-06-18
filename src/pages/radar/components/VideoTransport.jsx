import { useEffect, useRef, useState } from 'react'
import Button from '../../../components/atoms/Button.jsx'
import Section from '../../../components/molecules/Section.jsx'

const fmt = (t) => {
  if (!isFinite(t) || t < 0) return '0:00'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Transport for the shared radar video source — scrub / play-pause / jump to
 * ends / loop, driven straight off the HTMLVideoElement (the ImageContext
 * source, muted + looping by default). Pausing the video also idles the page's
 * render loop, which is paced by requestVideoFrameCallback.
 */
export default function VideoTransport({ video }) {
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loop, setLoop] = useState(true)
  const seekingRef = useRef(false)

  useEffect(() => {
    if (!video) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onMeta = () => setDuration(video.duration || 0)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('loadedmetadata', onMeta)
    setPlaying(!video.paused)
    setDuration(video.duration || 0)
    setLoop(video.loop)

    // currentTime readout — rVFC when available (smooth, frame-accurate), rAF otherwise
    let handle
    let alive = true
    const tick = () => {
      if (!alive) return
      if (!seekingRef.current) setTime(video.currentTime || 0)
      handle = video.requestVideoFrameCallback
        ? video.requestVideoFrameCallback(tick)
        : requestAnimationFrame(tick)
    }
    tick()
    return () => {
      alive = false
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('loadedmetadata', onMeta)
      if (handle == null) return
      if (video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(handle)
      else cancelAnimationFrame(handle)
    }
  }, [video])

  if (!video) return null

  const playPause = () => { video.paused ? void video.play() : video.pause() }
  const toStart = () => { video.currentTime = 0; setTime(0) }
  const toEnd = () => { const t = Math.max(0, (video.duration || 0) - 0.05); video.currentTime = t; setTime(t) }
  const toggleLoop = () => { video.loop = !video.loop; setLoop(video.loop) }
  const seek = (v) => { seekingRef.current = true; video.currentTime = v; setTime(v) }
  const seekEnd = () => { seekingRef.current = false }

  return (
    <Section label="Transport">
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.01}
        value={Math.min(time, duration || 0)}
        onChange={(e) => seek(Number(e.target.value))}
        onMouseUp={seekEnd}
        onTouchEnd={seekEnd}
        className="w-full"
        style={{ accentColor: 'var(--kol-accent-primary)' }}
        aria-label="Seek"
      />
      <div className="flex items-center justify-between kol-helper-10 text-fg-32">
        <span>{fmt(time)}</span>
        <span>{fmt(duration)}</span>
      </div>
      <div className="flex gap-1">
        <Button variant="primary" size="sm" iconOnly="control-arrow-start" aria-label="To start" onClick={toStart} className="flex-1" />
        <Button variant="primary" size="sm" iconOnly={playing ? 'control-pause' : 'control-play'} aria-label={playing ? 'Pause' : 'Play'} onClick={playPause} className="flex-1" />
        <Button variant="primary" size="sm" iconOnly="control-arrow-end" aria-label="To end" onClick={toEnd} className="flex-1" />
        <Button variant={loop ? 'accent' : 'primary'} size="sm" iconOnly="repeat" aria-label="Loop" onClick={toggleLoop} className="flex-1" />
      </div>
    </Section>
  )
}
