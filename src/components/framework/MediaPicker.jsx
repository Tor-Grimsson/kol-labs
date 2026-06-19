import { useEffect, useState } from 'react'
import Button from '../atoms/Button.jsx'
import Input from '../atoms/Input.jsx'
import SegmentedToggle from '../molecules/SegmentedToggle.jsx'
import { listMedia, mediaUrl } from '../../lib/mediaLibrary.js'

/**
 * MediaPicker — modal to pull a source from one of two places, returned via
 * onPick(url, { contentType }):
 *   • Library — the kol-media CDN bucket (admin.kolkrabbi.io/api/list)
 *   • Gallery — the local public/images set (the /__photos.json manifest)
 *
 * `accept`: 'image' | 'video' | 'all' filters the grid.
 */
const isVideoExt = (s) => /\.(mp4|webm|mov|m4v)$/i.test(s)

// Both sources normalise to { url, name, contentType }.
async function loadLibrary(prefix) {
  const objs = await listMedia(prefix)
  return objs.map((o) => ({ url: mediaUrl(o.key), name: o.key.split('/').pop(), path: o.key, contentType: o.contentType }))
}
async function loadGallery() {
  const res = await fetch('/__photos.json')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  const files = (data.groups || []).flatMap((g) => g.files || [])
  return files.map((f) => ({ url: f, name: f.split('/').pop(), path: f, contentType: isVideoExt(f) ? 'video/*' : 'image/*' }))
}

export default function MediaPicker({ open, onClose, onPick, accept = 'image' }) {
  const [source, setSource] = useState('library') // library (CDN) | gallery (local)
  const [prefix, setPrefix] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    const p = source === 'gallery' ? loadGallery() : loadLibrary(prefix)
    p.then((list) => { if (!cancelled) setItems(list) })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, source, prefix])

  if (!open) return null

  const wanted = (it) => {
    const img = it.contentType?.startsWith('image/')
    const vid = it.contentType?.startsWith('video/')
    return accept === 'video' ? vid : accept === 'image' ? img : (img || vid)
  }
  // Library is filtered server-side by prefix; gallery filters client-side.
  const visible = items
    .filter(wanted)
    .filter((it) => source === 'library' || !prefix || it.path.includes(prefix))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-surface-primary border border-fg-12 rounded-[var(--kol-radius-sm)] w-full max-w-3xl max-h-[80vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-4 p-5 border-b border-fg-08">
          <SegmentedToggle
            className="w-56 shrink-0"
            value={source}
            onChange={setSource}
            options={[{ value: 'library', label: 'Library' }, { value: 'gallery', label: 'Gallery' }]}
          />
          <Input
            variant="filled"
            size="sm"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder={source === 'gallery' ? 'filter — e.g. kol-mood' : 'prefix — e.g. photoshoot/'}
            className="flex-1"
          />
          <Button variant="primary" size="sm" iconOnly="cross" onClick={onClose} className="ml-auto shrink-0" style={{ padding: 0, width: 26, height: 26, minHeight: 0 }} />
        </div>

        <div className="flex-1 overflow-y-auto p-5 [scrollbar-width:thin]">
          {error ? (
            <p className="kol-mono-12 text-ui-error">Couldn’t load: {error}</p>
          ) : loading ? (
            <p className="kol-mono-12 text-meta">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="kol-mono-12 text-meta">Nothing here{prefix ? ` for “${prefix}”` : ''}.</p>
          ) : (
            <ul className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
              {visible.map((it) => (
                <li
                  key={it.url}
                  className="cursor-pointer group"
                  title={it.path}
                  onClick={() => { onPick?.(it.url, it); onClose?.() }}
                >
                  <div className="aspect-square bg-fg-04 rounded overflow-hidden border border-fg-08 group-hover:border-fg-24 transition-colors">
                    {it.contentType?.startsWith('image/') ? (
                      <img src={it.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <video src={it.url} muted preload="metadata" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <p className="kol-mono-10 text-meta truncate mt-1">{it.name}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
