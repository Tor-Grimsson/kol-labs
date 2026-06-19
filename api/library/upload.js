// Vercel serverless function (prod): POST /api/library/upload?key=…&type=… with
// the export blob as the raw body → forwards to the kol-media admin (Basic auth)
// so the hosted site can save to the CDN bucket. Mirrors the dev Vite plugin at
// server/library/vite-api-plugin.js. ADMIN_PASSWORD comes from Vercel env vars.
export const config = { api: { bodyParser: false } }

const ADMIN_BASE = 'https://admin.kolkrabbi.io'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed')
  const pw = process.env.ADMIN_PASSWORD
  if (!pw) return res.status(500).end('ADMIN_PASSWORD not set')
  const key = req.query.key
  const type = req.query.type || 'application/octet-stream'
  if (!key) return res.status(400).end('missing ?key')

  const chunks = []
  for await (const c of req) chunks.push(c)
  const buf = Buffer.concat(chunks)

  const fd = new FormData()
  fd.append('file', new Blob([buf], { type }), String(key).split('/').pop())
  fd.append('key', key)

  const r = await fetch(`${ADMIN_BASE}/api/upload`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`admin:${pw}`).toString('base64') },
    body: fd,
  })
  const text = await r.text()
  res.status(r.status)
  res.setHeader('content-type', r.headers.get('content-type') || 'application/json')
  res.end(text)
}
