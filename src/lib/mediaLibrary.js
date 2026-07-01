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

// Admin gate for the upload proxy. The server verifies this header against its
// ADMIN_PASSWORD and 401s on mismatch (the endpoint used to be open). Prompt once
// per tab, cache in sessionStorage; a 401 clears it so a wrong/rotated password
// re-prompts. The password still never reaches the bucket — only this header.
const ADMIN_PW_KEY = 'kol_admin_pw'
function adminPassword() {
  let pw = sessionStorage.getItem(ADMIN_PW_KEY)
  if (!pw) {
    pw = window.prompt('Admin password (to upload to the library):') || ''
    if (pw) sessionStorage.setItem(ADMIN_PW_KEY, pw)
  }
  return pw
}

// Save the export blob to the CDN library (kol-media bucket) via the server-side
// proxy (dev Vite plugin / prod Vercel function — the ADMIN_PASSWORD never reaches
// the client). `key` is the bucket path, e.g. "radar/dither-1718.png".
export async function uploadToLibrary(blob, key) {
  const type = blob.type || 'application/octet-stream'
  const r = await fetch(`/api/library/upload?key=${encodeURIComponent(key)}&type=${encodeURIComponent(type)}`, {
    method: 'POST',
    headers: { 'x-admin-password': adminPassword() },
    body: blob,
  })
  if (r.status === 401) { sessionStorage.removeItem(ADMIN_PW_KEY); throw new Error('401 — wrong admin password, try again') }
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
