// mediaLibrary — read-only access to the kol-media CDN bucket (the same bucket
// the brand.kolkrabbi.io "Library" browses). Public, no auth: list via the admin
// API, fetch objects by their public URL. Works on a static deploy (Vercel) with
// no backend of our own.
//
//   const objs = await listMedia('photoshoot/')  // [{ key, contentType, size }]
//   <img src={mediaUrl(obj.key)} />               // https://media.kolkrabbi.io/<key>
//
// NOTE for canvas consumers (radar): load the image/video with crossOrigin so the
// canvas isn't tainted (export reads pixels). The CDN must send an
// Access-Control-Allow-Origin header for that to succeed.

const ADMIN_BASE = 'https://admin.kolkrabbi.io'
const PUBLIC_BASE = 'https://media.kolkrabbi.io'

export const mediaUrl = (key) => `${PUBLIC_BASE}/${key}`
export const isImageType = (ct) => !!ct && ct.startsWith('image/')
export const isVideoType = (ct) => !!ct && ct.startsWith('video/')

// List bucket objects, optionally under a folder prefix. Throws on a non-OK
// response so callers can show an error.
export async function listMedia(prefix = '', { signal } = {}) {
  const params = new URLSearchParams()
  if (prefix) params.set('prefix', prefix)
  const res = await fetch(`${ADMIN_BASE}/api/list?${params}`, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return data.objects || []
}

// Save the export blob to the CDN library (kol-media bucket) via the server-side
// proxy (dev Vite plugin / prod Vercel function — the ADMIN_PASSWORD never reaches
// the client). `key` is the bucket path, e.g. "radar/dither-1718.png".
export async function uploadToLibrary(blob, key) {
  const type = blob.type || 'application/octet-stream'
  const r = await fetch(`/api/library/upload?key=${encodeURIComponent(key)}&type=${encodeURIComponent(type)}`, { method: 'POST', body: blob })
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
  return r.json()
}

// Save the export blob to the local gallery (public/images/<group>/<name>).
// Dev-only — the hosted build has no writable filesystem.
export async function saveToGallery(blob, group, name) {
  const r = await fetch(`/api/gallery/save?group=${encodeURIComponent(group)}&name=${encodeURIComponent(name)}`, { method: 'POST', body: blob })
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
  return r.json()
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
