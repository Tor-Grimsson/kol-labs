import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

/**
 * poster API — local processing backend (vite middleware).
 *
 * Native ffmpeg / ffprobe / magick on this machine do the real work; the
 * browser sends pixel-exact params (crop window + output size) computed
 * client-side from the preset registry + focal point. Files live under
 * workspace/poster/ at the repo root (gitignored): sources/ outputs/ thumbs/ plans/.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url))
const WS = path.join(HERE, '..', '..', 'workspace', 'poster')
const DIRS = {
  sources: path.join(WS, 'sources'),
  outputs: path.join(WS, 'outputs'),
  thumbs: path.join(WS, 'thumbs'),
  plans: path.join(WS, 'plans'),
}
for (const d of Object.values(DIRS)) await fs.mkdir(d, { recursive: true })

const id = () => crypto.randomBytes(5).toString('hex')
const safe = (name) => name.replace(/[^a-zA-Z0-9._-]/g, '_')

/* ── jobs: sequential queue, polled by the UI ─────────────────────────── */
const jobs = new Map() // id -> {id,status,progress,output,error,label}
let running = false
const queue = []

const runNext = () => {
  if (running) return
  const next = queue.shift()
  if (!next) return
  running = true
  const job = jobs.get(next.jobId)
  job.status = 'running'
  const child = spawn(next.cmd, next.args)
  let stderr = ''
  child.stderr.on('data', (b) => { stderr += b.toString() })
  // ffmpeg -progress pipe:1 emits key=value lines; out_time_us tracks position
  child.stdout.on('data', (b) => {
    const m = String(b).match(/out_time_us=(\d+)/g)
    if (m && next.durationUs) {
      const us = Number(m[m.length - 1].split('=')[1])
      job.progress = Math.min(99, Math.round((us / next.durationUs) * 100))
    }
  })
  child.on('close', (code) => {
    if (code === 0) { job.status = 'done'; job.progress = 100 }
    else { job.status = 'error'; job.error = stderr.split('\n').slice(-6).join('\n') }
    running = false
    runNext()
  })
}

const enqueue = (label, cmd, args, output, durationUs) => {
  const jobId = id()
  jobs.set(jobId, { id: jobId, label, status: 'queued', progress: 0, output, error: null })
  queue.push({ jobId, cmd, args, durationUs })
  runNext()
  return jobId
}

/* ── ffprobe ──────────────────────────────────────────────────────────── */
const probe = (file) => new Promise((resolve, reject) => {
  const child = spawn('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', file])
  let out = ''
  child.stdout.on('data', (b) => { out += b })
  child.on('close', (code) => {
    if (code !== 0) return reject(new Error('ffprobe failed'))
    try {
      const data = JSON.parse(out)
      const v = (data.streams || []).find((s) => s.codec_type === 'video')
      resolve({
        width: v?.width ?? null,
        height: v?.height ?? null,
        duration: Number(data.format?.duration ?? 0),
        codec: v?.codec_name ?? null,
        size: Number(data.format?.size ?? 0),
        isVideo: Boolean(v && Number(data.format?.duration ?? 0) > 0 && v.codec_name !== 'png' && v.codec_name !== 'mjpeg' && v.codec_name !== 'webp'),
      })
    } catch (e) { reject(e) }
  })
})

/* ── source registry (workspace scan) ─────────────────────────────────── */
const listSources = async () => {
  const files = await fs.readdir(DIRS.sources)
  const out = []
  for (const f of files.filter((f) => !f.startsWith('.'))) {
    const p = path.join(DIRS.sources, f)
    try { out.push({ id: f, name: f, ...(await probe(p)) }) } catch { /* skip unprobeable */ }
  }
  return out
}

/* ── plan bundle: kol-docs-conformant doc + _assets + _files ──────────── */

const kebab = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/* The plan as a kol-docs doc (type: plan, draft): frontmatter, caption,
 * social tags as code spans (NOT #tags — they'd pollute the vault taxonomy),
 * assets embedded from _assets/, plan.json linked from _files/. */
const buildPlanDoc = (plan, { date, assets, cover }) => {
  const title = (plan.title || 'Untitled post').replace(/"/g, '\\"')
  const social = (plan.tags || []).map((t) => `\`#${t}\``).join(' ')
  const lines = [
    '---',
    `title: "${title}"`,
    'type: plan',
    'status: draft',
    `updated: ${date}`,
    `description: Social post pre-flight — ${assets.length} asset${assets.length === 1 ? '' : 's'}, caption + tags, from poster.`,
    'tags:',
    '  - project/kolkrabbi',
    '  - domain/social',
    '---',
    '',
    `# ${plan.title || 'Untitled post'}`,
    '',
    '## Caption',
    '',
    plan.caption || '—',
    '',
    '## Social tags',
    '',
    social || '—',
    '',
    '## Assets',
    '',
  ]
  for (const f of assets) {
    lines.push(`![[${f}]]`)
    lines.push('')
  }
  if (cover) {
    lines.push('## Cover')
    lines.push('')
    lines.push(`![[${cover}]]`)
    lines.push('')
  }
  lines.push('## Files')
  lines.push('')
  lines.push('[[plan.json]]')
  lines.push('')
  return lines.join('\n')
}

/* ── handlers ─────────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x')
  const route = url.pathname
  const json = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)) }
  const body = () => new Promise((r) => { let b = ''; req.on('data', (c) => { b += c }); req.on('end', () => r(b ? JSON.parse(b) : {})) })

  try {
    /* POST /api/upload?name=foo.mp4 — raw body streamed to sources/ */
    if (route === '/api/poster/upload' && req.method === 'POST') {
      const name = `${Date.now().toString(36)}-${safe(url.searchParams.get('name') || 'asset')}`
      const dest = path.join(DIRS.sources, name)
      await new Promise((r, j) => { const w = createWriteStream(dest); req.pipe(w); w.on('finish', r); w.on('error', j) })
      return json(200, { id: name, name, ...(await probe(dest)) })
    }

    if (route === '/api/poster/assets') return json(200, await listSources())

    /* POST /api/convert {sourceId, label, crop:{w,h,x,y}, out:{w,h}, format} */
    if (route === '/api/poster/convert' && req.method === 'POST') {
      const { sourceId, label, crop, out, format } = await body()
      const src = path.join(DIRS.sources, safe(sourceId))
      const info = await probe(src)
      const base = `${safe(sourceId).replace(/\.[^.]+$/, '')}-${safe(label)}`
      if (info.isVideo) {
        const output = path.join(DIRS.outputs, `${base}.mp4`)
        const vf = `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},scale=${out.w}:${out.h}`
        const jobId = enqueue(label, 'ffmpeg', ['-y', '-i', src, '-vf', vf, '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', '-progress', 'pipe:1', output], path.basename(output), info.duration * 1e6)
        return json(200, { jobId })
      }
      const ext = format === 'png' ? 'png' : 'jpg'
      const output = path.join(DIRS.outputs, `${base}.${ext}`)
      const jobId = enqueue(label, 'magick', [src, '-crop', `${crop.w}x${crop.h}+${crop.x}+${crop.y}`, '+repage', '-resize', `${out.w}x${out.h}!`, '-quality', '92', output], path.basename(output), 0)
      return json(200, { jobId })
    }

    if (route === '/api/poster/jobs') return json(200, [...jobs.values()].reverse())

    /* POST /api/thumbnail {sourceId, time} — extract a frame */
    if (route === '/api/poster/thumbnail' && req.method === 'POST') {
      const { sourceId, time } = await body()
      const src = path.join(DIRS.sources, safe(sourceId))
      const output = path.join(DIRS.thumbs, `${safe(sourceId).replace(/\.[^.]+$/, '')}-t${Math.round(time * 100)}.jpg`)
      await new Promise((r, j) => {
        const c = spawn('ffmpeg', ['-y', '-ss', String(time), '-i', src, '-frames:v', '1', '-q:v', '3', output])
        c.on('close', (code) => (code === 0 ? r() : j(new Error('thumbnail failed'))))
      })
      return json(200, { thumb: path.basename(output) })
    }

    /* GET /api/poster/plans/<id>/bundle — zip: kol-docs doc + _assets + _files */
    if (route.startsWith('/api/poster/plans/') && route.endsWith('/bundle') && req.method === 'GET') {
      const id = safe(route.split('/')[4] || '')
      const plan = JSON.parse(await fs.readFile(path.join(DIRS.plans, `${id}.json`), 'utf8'))
      const date = new Date(plan.updated || Date.now()).toISOString().slice(0, 10)
      const slug = `${date}-${kebab(plan.title) || 'untitled'}`
      const bundles = path.join(WS, 'bundles')
      const stage = path.join(bundles, slug)
      await fs.rm(stage, { recursive: true, force: true })
      await fs.mkdir(path.join(stage, '_assets'), { recursive: true })
      await fs.mkdir(path.join(stage, '_files'), { recursive: true })

      const assets = []
      for (const f of plan.assets || []) {
        try { await fs.copyFile(path.join(DIRS.outputs, safe(f)), path.join(stage, '_assets', safe(f))); assets.push(safe(f)) } catch { /* skip missing */ }
      }
      let cover = null
      if (plan.thumb) {
        try { await fs.copyFile(path.join(DIRS.thumbs, safe(plan.thumb)), path.join(stage, '_assets', safe(plan.thumb))); cover = safe(plan.thumb) } catch { /* skip missing */ }
      }
      await fs.writeFile(path.join(stage, '_files', 'plan.json'), JSON.stringify(plan, null, 2))
      await fs.writeFile(path.join(stage, `${slug}.md`), buildPlanDoc(plan, { date, assets, cover }))

      const zipPath = path.join(bundles, `${slug}.zip`)
      await fs.rm(zipPath, { force: true })
      await new Promise((r, j) => {
        const c = spawn('zip', ['-r', `${slug}.zip`, slug], { cwd: bundles })
        c.on('close', (code) => (code === 0 ? r() : j(new Error('zip failed'))))
      })
      await fs.rm(stage, { recursive: true, force: true })
      const buf = await fs.readFile(zipPath)
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/zip')
      res.setHeader('Content-Disposition', `attachment; filename="${slug}.zip"`)
      return res.end(buf)
    }

    /* GET /api/poster/plans/<id>/doc — the kol-docs markdown only (no zip) */
    if (route.startsWith('/api/poster/plans/') && route.endsWith('/doc') && req.method === 'GET') {
      const id = safe(route.split('/')[4] || '')
      const plan = JSON.parse(await fs.readFile(path.join(DIRS.plans, `${id}.json`), 'utf8'))
      const date = new Date(plan.updated || Date.now()).toISOString().slice(0, 10)
      const slug = `${date}-${kebab(plan.title) || 'untitled'}`
      const assets = (plan.assets || []).map(safe)
      const cover = plan.thumb ? safe(plan.thumb) : null
      const md = buildPlanDoc(plan, { date, assets, cover })
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${slug}.md"`)
      return res.end(md)
    }

    /* GET /api/poster/plans/<id>/images — zip of just the plan's asset images */
    if (route.startsWith('/api/poster/plans/') && route.endsWith('/images') && req.method === 'GET') {
      const id = safe(route.split('/')[4] || '')
      const plan = JSON.parse(await fs.readFile(path.join(DIRS.plans, `${id}.json`), 'utf8'))
      const date = new Date(plan.updated || Date.now()).toISOString().slice(0, 10)
      const slug = `${date}-${kebab(plan.title) || 'untitled'}-images`
      const bundles = path.join(WS, 'bundles')
      const stage = path.join(bundles, slug)
      await fs.rm(stage, { recursive: true, force: true })
      await fs.mkdir(stage, { recursive: true })
      for (const f of plan.assets || []) {
        try { await fs.copyFile(path.join(DIRS.outputs, safe(f)), path.join(stage, safe(f))) } catch { /* skip missing */ }
      }
      if (plan.thumb) {
        try { await fs.copyFile(path.join(DIRS.thumbs, safe(plan.thumb)), path.join(stage, safe(plan.thumb))) } catch { /* skip missing */ }
      }
      const zipPath = path.join(bundles, `${slug}.zip`)
      await fs.rm(zipPath, { force: true })
      await new Promise((r, j) => {
        const c = spawn('zip', ['-r', `${slug}.zip`, slug], { cwd: bundles })
        c.on('close', (code) => (code === 0 ? r() : j(new Error('zip failed'))))
      })
      await fs.rm(stage, { recursive: true, force: true })
      const buf = await fs.readFile(zipPath)
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/zip')
      res.setHeader('Content-Disposition', `attachment; filename="${slug}.zip"`)
      return res.end(buf)
    }

    /* DELETE /api/poster/plans/<id> — remove a saved plan */
    if (route.startsWith('/api/poster/plans/') && req.method === 'DELETE') {
      const id = safe(route.split('/')[4] || '')
      await fs.rm(path.join(DIRS.plans, `${id}.json`), { force: true })
      return json(200, { ok: true })
    }

    /* plans: GET list · POST {id?, ...plan} save */
    if (route === '/api/poster/plans' && req.method === 'GET') {
      const files = (await fs.readdir(DIRS.plans)).filter((f) => f.endsWith('.json'))
      const plans = await Promise.all(files.map(async (f) => JSON.parse(await fs.readFile(path.join(DIRS.plans, f), 'utf8'))))
      return json(200, plans.sort((a, b) => (b.updated || 0) - (a.updated || 0)))
    }
    if (route === '/api/poster/plans' && req.method === 'POST') {
      const plan = await body()
      plan.id = plan.id || id()
      plan.updated = Date.now()
      await fs.writeFile(path.join(DIRS.plans, `${safe(plan.id)}.json`), JSON.stringify(plan, null, 2))
      return json(200, plan)
    }

    return json(404, { error: `no route ${route}` })
  } catch (err) {
    return json(500, { error: String(err?.message || err) })
  }
}

export { WS }
