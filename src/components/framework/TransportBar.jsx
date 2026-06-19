import { useEffect, useRef } from 'react'
import Icon from '../loaders/Icon.jsx'
import Input from '../atoms/Input.jsx'

/**
 * TransportBar — playback transport laid out like <Pager>: two joined icon
 * button-groups flanking a centered tempo readout.
 *
 *   [▶ | ❚❚]      Tempo / NN      [■ | ◀◀]
 *
 * Left group = play / pause (play lit when `playing`, pause lit when not).
 * Right group = stop / rewind (rewind is a layout placeholder unless wired).
 * Center = tempo, an inline ghost input (reads as text, click to set).
 *
 * Presentational: the page owns playing/tempo state + the handlers.
 *
 * @param {boolean} props.playing
 * @param {Function} props.onPlay
 * @param {Function} props.onPause
 * @param {Function} props.onStop
 * @param {Function} props.onRewind - optional; omit to leave rewind inert
 * @param {number}   props.tempo
 * @param {Function} props.onTempo - (newValue) => void
 * @param {number}   props.tempoMax - clamp ceiling (default 100)
 * @param {string}   props.className
 */
function Cell({ name, title, active, onClick, divider }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={[
        'px-3 py-1.5 inline-flex items-center cursor-pointer transition-colors',
        divider ? 'border-l border-fg-08' : '',
        active ? 'text-emphasis' : 'text-meta hover:text-emphasis',
      ].filter(Boolean).join(' ')}
    >
      <Icon name={name} size={14} />
    </button>
  )
}

export default function TransportBar({
  playing,
  onPlay,
  onPause,
  onStop,
  onRewind,
  tempo,
  onTempo,
  tempoMax = 100,
  className = '',
}) {
  // Global Space → play / pause. The listener lives here; footer-toggle pages
  // keep the TransportBar MOUNTED (hidden when another footer tab is active) so
  // this binding stays alive regardless of which panel shows. Read via a ref so
  // it subscribes once; ignored while a form field is focused.
  const live = useRef({ playing, onPlay, onPause })
  live.current = { playing, onPlay, onPause }
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      e.preventDefault()
      const s = live.current
      if (s.playing) s.onPause?.()
      else s.onPlay?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="inline-flex rounded overflow-hidden bg-surface-secondary shrink-0">
        <Cell name="play" title="Play" active={playing} onClick={onPlay} />
        <Cell name="pause" title="Pause" active={!playing} onClick={onPause} divider />
      </div>

      <Input
        variant="ghost"
        size="sm"
        prefix="Tempo /"
        chars={3}
        value={String(tempo)}
        onChange={(e) => onTempo?.(Math.max(0, Math.min(tempoMax, Number(e.target.value) || 0)))}
        inputClassName="text-center"
        className="flex-1 justify-center"
      />

      <div className="inline-flex rounded overflow-hidden bg-surface-secondary shrink-0">
        <Cell name="stop" title="Stop" onClick={onStop} />
        <Cell name="rewind" title="Rewind" onClick={onRewind} divider />
      </div>
    </div>
  )
}
