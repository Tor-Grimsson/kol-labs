// Dev/preview-only middleware: POST /api/gallery/save?group=…&name=… with the
// export blob as the raw body → writes public/images/<group>/<name> and
// regenerates public/__photos.json. Dev-only by nature (the hosted build has a
// read-only filesystem) — the client hides the button outside import.meta.env.DEV.
import fs from 'node:fs'
import path from 'node:path'

const MEDIA_EXT = /\.(jpe?g|png|webp|gif|svg|mp4|webm)$/i

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function regenManifest(imagesDir, outFile) {
  const groups = []
  for (const e of fs.readdirSync(imagesDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue
    const files = fs.readdirSync(path.join(imagesDir, e.name))
      .filter((f) => MEDIA_EXT.test(f))
      .map((f) => `/images/${e.name}/${f}`)
      .sort()
    if (files.length) groups.push({ name: e.name, count: files.length, files })
  }
  fs.writeFileSync(outFile, JSON.stringify({ groups }, null, 2) + '\n', 'utf8')
}

export default function galleryApiPlugin() {
  const root = process.cwd()
  const imagesDir = path.join(root, 'public', 'images')
  const manifest = path.join(root, 'public', '__photos.json')

  const handler = async (req, res, next) => {
    if (!req.url || !req.url.startsWith('/api/gallery/save')) return next()
    if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method Not Allowed') }
    try {
      const url = new URL(req.url, 'http://localhost')
      const group = (url.searchParams.get('group') || 'saved').replace(/[^a-z0-9\-_]/gi, '') || 'saved'
      const name = (url.searchParams.get('name') || `img-${Date.now()}.png`).replace(/[^a-z0-9\-_.]/gi, '')
      const buf = await readBody(req)
      const dir = path.join(imagesDir, group)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, name), buf)
      regenManifest(imagesDir, manifest)
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ ok: true, url: `/images/${group}/${name}` }))
    } catch (e) {
      res.statusCode = 500
      res.end(String(e?.message || e))
    }
  }
  return {
    name: 'kol-gallery-api',
    configureServer(server) { server.middlewares.use(handler) },
    configurePreviewServer(server) { server.middlewares.use(handler) },
  }
}
