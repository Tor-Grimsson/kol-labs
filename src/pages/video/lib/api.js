/* Thin client for the video trim/crop backend (server/video/api.js). */
export const api = {
  upload: (file) =>
    fetch(`/api/video/upload?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file }).then((r) => r.json()),
  process: (payload) =>
    fetch('/api/video/process', { method: 'POST', body: JSON.stringify(payload) }).then((r) => r.json()),
  jobs: () => fetch('/api/video/jobs').then((r) => r.json()),
  deleteOutput: (name) =>
    fetch(`/api/video/output/${encodeURIComponent(name)}`, { method: 'DELETE' }).then((r) => r.json()),
}

export const fileUrl = (rel) => `/api/video/file/${rel}`

/* Normalised crop {x,y,w,h} (0..1 of the source) → pixel-exact crop window.
 * libx264 + yuv420p needs even width/height; offsets clamp inside the frame. */
export function toPixelCrop(crop, meta) {
  const even = (n) => Math.max(2, Math.round(n / 2) * 2)
  const w = Math.min(even(crop.w * meta.width), even(meta.width))
  const h = Math.min(even(crop.h * meta.height), even(meta.height))
  const x = Math.min(Math.max(0, Math.round(crop.x * meta.width)), meta.width - w)
  const y = Math.min(Math.max(0, Math.round(crop.y * meta.height)), meta.height - h)
  return { w, h, x, y }
}
