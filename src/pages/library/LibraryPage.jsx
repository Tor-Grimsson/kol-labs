import { useEffect, useRef, useState } from 'react'
import Button from '../../components/atoms/Button.jsx'
import Icon from '../../components/loaders/Icon.jsx'
import { listMedia, mediaUrl, isImageType, isVideoType, formatSize } from '../../lib/mediaLibrary.js'

function partition(objects, prefix) {
  const folderSet = new Set()
  const files = []
  for (const o of objects) {
    const rel = prefix ? o.key.slice(prefix.length) : o.key
    const slash = rel.indexOf('/')
    if (slash !== -1) {
      folderSet.add(rel.slice(0, slash + 1))
    } else {
      files.push({ ...o, displayKey: rel })
    }
  }
  return { folders: [...folderSet].sort(), files }
}

function MediaLightbox({ files, index, onClose, onPrev, onNext }) {
  const videoRef = useRef(null)
  const o = files[index]

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext])

  useEffect(() => { videoRef.current?.load() }, [index])

  if (!o) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <button
        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded text-fg-48 hover:text-fg-default transition-colors"
        onClick={(e) => { e.stopPropagation(); onPrev() }}
      >
        <Icon name="chevron-left" size={22} />
      </button>

      <div className="max-w-[90vw] max-h-[85vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        {isImageType(o.contentType) ? (
          <img
            src={mediaUrl(o.key)}
            alt={o.displayKey}
            className="max-w-full max-h-[78vh] object-contain rounded"
            style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
          />
        ) : isVideoType(o.contentType) ? (
          <video
            ref={videoRef}
            src={mediaUrl(o.key)}
            controls
            autoPlay
            className="max-w-full max-h-[78vh] rounded"
            style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
          />
        ) : (
          <div className="w-40 h-40 flex flex-col items-center justify-center gap-2 text-fg-48">
            <Icon name="file-01" size={48} />
            <span className="kol-mono-12">{o.contentType || 'file'}</span>
          </div>
        )}
        <div className="flex items-center gap-4">
          <span className="kol-mono-12 text-fg-48">{o.displayKey}</span>
          <span className="kol-mono-12 text-fg-32">{formatSize(o.size)}</span>
        </div>
        <span className="kol-mono-10 text-fg-24">{index + 1} / {files.length}</span>
      </div>

      <button
        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded text-fg-48 hover:text-fg-default transition-colors"
        onClick={(e) => { e.stopPropagation(); onNext() }}
      >
        <Icon name="chevron-right" size={22} />
      </button>

      <button
        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded text-fg-48 hover:text-fg-default transition-colors"
        onClick={onClose}
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  )
}

export default function LibraryPage() {
  const [prefix, setPrefix] = useState('')
  const [allObjects, setAllObjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)
  const [lightboxIndex, setLightboxIndex] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listMedia('')
      .then((objs) => { if (!cancelled) setAllObjects(objs) })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const scoped = prefix ? allObjects.filter((o) => o.key.startsWith(prefix)) : allObjects
  const { folders, files } = partition(scoped, prefix)
  const crumbs = prefix ? prefix.replace(/\/$/, '').split('/') : []
  const totalBytes = files.reduce((sum, o) => sum + (o.size || 0), 0)

  const copy = async (key) => {
    try { await navigator.clipboard.writeText(mediaUrl(key)) } catch { /* blocked */ }
    setCopiedKey(key)
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500)
  }

  return (
    <main className="p-8 md:p-12">
      {lightboxIndex !== null && (
        <MediaLightbox
          files={files}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => (i - 1 + files.length) % files.length)}
          onNext={() => setLightboxIndex((i) => (i + 1) % files.length)}
        />
      )}

      <p className="kol-helper-12 text-meta uppercase mb-2">kol-media</p>
      <h1 className="kol-sans-display-01 text-emphasis mb-4">Library.</h1>
      <p className="kol-sans-body-01 text-body max-w-prose">
        Read-only browse of the kol-media CDN bucket. Click a tile to copy its
        public URL; source pages can pull straight from here via "From library".
      </p>

      <header className="mt-8 flex items-center gap-3 flex-wrap">
        <Button variant="secondary" size="sm" href="https://admin.kolkrabbi.io" iconRight="external-link" target="_blank" rel="noreferrer">
          Open admin
        </Button>
        <span className="kol-mono-12 text-meta">
          {loading ? 'Loading…' : `${files.length} ${files.length === 1 ? 'file' : 'files'} · ${formatSize(totalBytes)}`}
        </span>
      </header>

      {/* Breadcrumb */}
      <div className="mt-6 flex items-center gap-1 kol-mono-12 text-fg-48">
        <button className="hover:text-fg-default transition-colors" onClick={() => setPrefix('')}>root</button>
        {crumbs.map((seg, i) => {
          const to = crumbs.slice(0, i + 1).join('/') + '/'
          return (
            <span key={to} className="flex items-center gap-1">
              <span>/</span>
              <button className="hover:text-fg-default transition-colors" onClick={() => setPrefix(to)}>{seg}</button>
            </span>
          )
        })}
      </div>

      {error ? (
        <p className="kol-mono-12 text-ui-error mt-8">Couldn't reach the library: {error}</p>
      ) : (
        <>
          {/* Folders */}
          {folders.length > 0 && (
            <ul className="mt-6 flex flex-col border-t" style={{ borderColor: 'var(--kol-fg-08)' }}>
              {folders.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-3 py-2 border-b cursor-pointer hover:bg-fg-04 transition-colors px-1 rounded"
                  style={{ borderColor: 'var(--kol-fg-08)' }}
                  onClick={() => setPrefix(prefix + f)}
                >
                  <Icon name="folder-01" size={18} className="text-fg-48 shrink-0" />
                  <span className="kol-mono-12 text-fg-default flex-1">{f}</span>
                  <Icon name="chevron-right" size={14} className="text-fg-32" />
                </li>
              ))}
            </ul>
          )}

          {/* Files grid */}
          {files.length === 0 && !loading ? (
            <p className="kol-mono-12 text-meta mt-8">No files{prefix ? ` in "${prefix}"` : ''} yet.</p>
          ) : (
            <ul className="mt-6 grid gap-3 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
              {files.map((o, idx) => (
                <li
                  key={o.key}
                  className="flex flex-col rounded overflow-hidden border border-fg-12 bg-fg-02 cursor-pointer group"
                  onClick={() => setLightboxIndex(idx)}
                  title={o.displayKey}
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
                  <div className="p-2 flex flex-col gap-1" onClick={(e) => { e.stopPropagation(); copy(o.key) }}>
                    <p className="kol-mono-12 text-fg-default truncate" title={o.key}>{o.displayKey}</p>
                    <p className="kol-mono-12 text-meta">{formatSize(o.size)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  )
}
