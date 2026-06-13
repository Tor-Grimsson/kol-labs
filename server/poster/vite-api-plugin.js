import path from 'node:path'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/**
 * Mounts the poster API at /api/poster/* and serves the workspace (sources/
 * outputs/thumbs) at /workspace/* in dev + preview. The /api/poster prefix
 * keeps the dev server's /api namespace shareable with future experiments.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url))
const WS = path.join(HERE, '..', '..', 'workspace', 'poster')

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
  '.json': 'application/json',
}

async function serveWorkspace(req, res) {
  const rel = decodeURIComponent((req.url || '').split('?')[0].replace('/workspace/', ''))
  const file = path.join(WS, rel)
  // stay inside the workspace
  if (!file.startsWith(WS)) { res.statusCode = 403; return res.end('forbidden') }
  try {
    const stat = await fs.stat(file)
    const ext = path.extname(file).toLowerCase()
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
    res.setHeader('Content-Length', stat.size)
    // Range support so <video> can seek
    const range = req.headers.range
    if (range) {
      const m = range.match(/bytes=(\d+)-(\d*)/)
      const start = Number(m[1])
      const end = m[2] ? Number(m[2]) : stat.size - 1
      res.statusCode = 206
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`)
      res.setHeader('Accept-Ranges', 'bytes')
      res.setHeader('Content-Length', end - start + 1)
      return createReadStream(file, { start, end }).pipe(res)
    }
    createReadStream(file).pipe(res)
  } catch {
    res.statusCode = 404
    res.end('not found')
  }
}

function mount(middlewares) {
  middlewares.use(async (req, res, next) => {
    const p = (req.url || '').split('?')[0]
    if (p.startsWith('/api/poster/')) {
      const mod = await import('./api.js')
      return mod.default(req, res)
    }
    if (p.startsWith('/workspace/')) return serveWorkspace(req, res)
    next()
  })
}

export default function posterApiPlugin() {
  return {
    name: 'poster-api',
    configureServer(server) { mount(server.middlewares) },
    configurePreviewServer(server) { mount(server.middlewares) },
  }
}
