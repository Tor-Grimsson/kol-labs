// Dev/preview middleware: POST /api/library/upload?key=…&type=… with the export
// blob as the raw body. Forwards to the kol-media admin (admin.kolkrabbi.io,
// HTTP Basic auth user "admin") as multipart { file, key } → served at
// media.kolkrabbi.io/<key>. ADMIN_PASSWORD stays server-side, never in the client.
//
// Prod (Vercel static) has no dev server → the matching serverless function lives
// at api/library/upload.js. Same contract, same env var.
const ADMIN_BASE = 'https://admin.kolkrabbi.io'

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default function libraryApiPlugin(adminPassword) {
  const handler = async (req, res, next) => {
    if (!req.url || !req.url.startsWith('/api/library/upload')) return next()
    if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method Not Allowed') }
    if (!adminPassword) { res.statusCode = 500; return res.end('ADMIN_PASSWORD missing — set it in .env.local') }
    try {
      const url = new URL(req.url, 'http://localhost')
      const key = url.searchParams.get('key')
      const type = url.searchParams.get('type') || 'application/octet-stream'
      if (!key) { res.statusCode = 400; return res.end('missing ?key') }
      const buf = await readBody(req)
      const fd = new FormData()
      fd.append('file', new Blob([buf], { type }), key.split('/').pop())
      fd.append('key', key)
      const r = await fetch(`${ADMIN_BASE}/api/upload`, {
        method: 'POST',
        headers: { Authorization: 'Basic ' + Buffer.from(`admin:${adminPassword}`).toString('base64') },
        body: fd,
      })
      const text = await r.text()
      res.statusCode = r.status
      res.setHeader('content-type', r.headers.get('content-type') || 'application/json')
      res.end(text)
    } catch (e) {
      res.statusCode = 500
      res.end(String(e?.message || e))
    }
  }
  return {
    name: 'kol-library-api',
    configureServer(server) { server.middlewares.use(handler) },
    configurePreviewServer(server) { server.middlewares.use(handler) },
  }
}
