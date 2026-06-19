import { useEffect, useState } from 'react'
import Button from '../../components/atoms/Button.jsx'
import Input from '../../components/atoms/Input.jsx'
import { listMedia, mediaUrl, isImageType, isVideoType, formatSize } from '../../lib/mediaLibrary.js'

// Read-only browse of the kol-media CDN bucket (shared with brand.kolkrabbi.io's
// Library). Click a tile to copy its public URL. Source pages (radar) can also
// pull straight from here via the "From library" picker — no disk upload.
export default function LibraryPage() {
  const [prefix, setPrefix] = useState('')
  const [objects, setObjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listMedia(prefix)
      .then((objs) => { if (!cancelled) setObjects(objs) })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [prefix])

  const copy = async (key) => {
    try { await navigator.clipboard.writeText(mediaUrl(key)) } catch { /* clipboard blocked */ }
    setCopiedKey(key)
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500)
  }

  const totalBytes = objects.reduce((sum, o) => sum + (o.size || 0), 0)

  return (
    <main className="p-8 md:p-12">
      <p className="kol-helper-12 text-meta uppercase mb-2">kol-media</p>
      <h1 className="kol-sans-display-01 text-emphasis mb-4">Library.</h1>
      <p className="kol-sans-body-01 text-body max-w-prose">
        Read-only browse of the kol-media CDN bucket. Click a tile to copy its
        public URL; source pages can pull straight from here via “From library”.
      </p>

      <header className="mt-8 flex items-center gap-3 flex-wrap">
        <Button
          variant="secondary"
          size="sm"
          href="https://admin.kolkrabbi.io"
          iconRight="external-link"
          target="_blank"
          rel="noreferrer"
        >
          Open admin
        </Button>
        <span className="kol-mono-12 text-meta">
          {loading ? 'Loading…' : `${objects.length} ${objects.length === 1 ? 'file' : 'files'} · ${formatSize(totalBytes)}`}
        </span>
      </header>

      <div className="mt-6 max-w-md">
        <label className="kol-helper-12 uppercase tracking-widest text-body block mb-1.5">Folder prefix</label>
        <Input
          variant="filled"
          size="sm"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          placeholder="e.g. photoshoot/"
          className="w-full"
        />
      </div>

      {error ? (
        <p className="kol-mono-12 text-ui-error mt-8">Couldn’t reach the library: {error}</p>
      ) : objects.length === 0 && !loading ? (
        <p className="kol-mono-12 text-meta mt-8">No files{prefix ? ` under “${prefix}”` : ''} yet.</p>
      ) : (
        <ul className="mt-8 grid gap-3 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
          {objects.map((o) => (
            <li
              key={o.key}
              className="flex flex-col rounded overflow-hidden border border-fg-12 bg-fg-02 cursor-pointer group"
              onClick={() => copy(o.key)}
              title="Click to copy public URL"
            >
              <div className="aspect-square flex items-center justify-center bg-fg-04 overflow-hidden relative">
                {isImageType(o.contentType) ? (
                  <img src={mediaUrl(o.key)} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : isVideoType(o.contentType) ? (
                  <video src={mediaUrl(o.key)} className="w-full h-full object-cover" muted preload="metadata" />
                ) : (
                  <span className="kol-mono-12 text-meta">{o.contentType?.split('/')[0] || 'file'}</span>
                )}
                {copiedKey === o.key && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <span className="kol-mono-14 text-fg-default">Copied</span>
                  </div>
                )}
              </div>
              <div className="p-2 flex flex-col gap-1">
                <p className="kol-mono-12 text-fg-default truncate" title={o.key}>{o.key}</p>
                <p className="kol-mono-12 text-meta">{formatSize(o.size)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
