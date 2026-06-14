import path from 'node:path'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/**
 * Mounts the video API at /api/video/* and serves produced clips at
 * /api/video/file/* (range-capable, so <video> can seek) in dev + preview.
 * Files served from workspace/video/ at the repo root (gitignored).
 *
 * Serving under /api/video/file/ keeps everything in the experiment's own
 * /api/video namespace and avoids colliding with the poster plugin's
 * /workspace/ static handler.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url))
const WS = path.join(HERE, '..', '..', 'workspace', 'video')

const MIME = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.json': 'application/json' }

async function serveFile(req, res) {
  const rel = decodeURIComponent((req.url || '').split('?')[0].replace('/api/video/file/', ''))
  const file = path.join(WS, rel)
  if (!file.startsWith(WS)) { res.statusCode = 403; return res.end('forbidden') }
  try {
    const stat = await fs.stat(file)
    const ext = path.extname(file).toLowerCase()
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
    res.setHeader('Content-Length', stat.size)
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
    if (p.startsWith('/api/video/file/')) return serveFile(req, res)
    if (p.startsWith('/api/video/')) {
      const mod = await import('./api.js')
      return mod.default(req, res)
    }
    next()
  })
}

export default function videoApiPlugin() {
  return {
    name: 'video-api',
    configureServer(server) { mount(server.middlewares) },
    configurePreviewServer(server) { mount(server.middlewares) },
  }
}
