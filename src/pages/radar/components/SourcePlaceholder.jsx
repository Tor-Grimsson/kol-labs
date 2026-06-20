import { useState, useContext } from 'react'
import Icon from '../../../components/loaders/Icon.jsx'
import MediaPicker from '../../../components/framework/MediaPicker.jsx'
import { ImageContext } from '../state/ImageContext'

// The empty-state contents for an effect stage: two big icon-over-text cells
// (From library · Upload) filling the aspect frame side-by-side. `onUpload`
// triggers the page's file input; the library cell opens the CDN picker.
// A library pick goes to `onPick(url, contentType)` if supplied, else to the
// radar ImageContext's `loadImageFromUrl` — so pages outside that provider
// (e.g. scanlines, which has its own source pipeline) can reuse this component.
export default function SourcePlaceholder({ onUpload, onGenerate, onPick }) {
  const ctx = useContext(ImageContext)
  const pick = onPick || ctx?.loadImageFromUrl
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-1 w-full h-full">
      <Cell icon="image" label="From library" onClick={() => setOpen(true)} />
      <div className="w-px bg-fg-08 my-6" />
      <Cell icon="upload" label="Upload" onClick={onUpload} />
      {onGenerate && (
        <>
          <div className="w-px bg-fg-08 my-6" />
          <Cell icon="cycle" label="Generate" onClick={onGenerate} />
        </>
      )}
      <MediaPicker
        open={open}
        accept="all"
        onClose={() => setOpen(false)}
        onPick={(url, o) => pick?.(url, o?.contentType)}
      />
    </div>
  )
}

function Cell({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex-1 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-fg-inverse-48 transition-colors"
    >
      {/* Stroke icons can't take an alpha colour (overlapping strokes seam) — use an
          OPAQUE blend of fg↓onto the surface to fake the dim, full fg on hover. */}
      <Icon
        name={icon}
        size={48}
        className="transition-colors [color:color-mix(in_srgb,var(--kol-surface-on-primary)_55%,var(--kol-surface-primary))] group-hover:[color:var(--kol-surface-on-primary)]"
      />
      <span className="kol-helper-12 uppercase tracking-widest text-meta group-hover:text-emphasis">{label}</span>
    </button>
  )
}
