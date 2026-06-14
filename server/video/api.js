import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

/**
 * video API — local trim/crop backend (vite middleware).
 *
 * Native ffmpeg / ffprobe on this machine do the work; the browser previews the
 * file locally (blob URL) and only uploads on export, sending trim points +
 * (optional) a pixel-exact crop window computed client-side. Files live under
 * workspace/video/ at the repo root (gitignored): sources/ outputs/.
 *
 * Mirrors the poster backend (server/poster/api.js): same job queue + ffprobe.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url))
const WS = path.join(HERE, '..', '..', 'workspace', 'video')
const DIRS = {
  sources: path.join(WS, 'sources'),
  outputs: path.join(WS, 'outputs'),
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
      })
    } catch (e) { reject(e) }
  })
})

/* ── handlers ─────────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x')
  const route = url.pathname
  const json = (code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)) }
  const body = () => new Promise((r) => { let b = ''; req.on('data', (c) => { b += c }); req.on('end', () => r(b ? JSON.parse(b) : {})) })

  try {
    /* POST /api/video/upload?name=foo.mp4 — raw body streamed to sources/ */
    if (route === '/api/video/upload' && req.method === 'POST') {
      const name = `${Date.now().toString(36)}-${safe(url.searchParams.get('name') || 'clip.mp4')}`
      const dest = path.join(DIRS.sources, name)
      await new Promise((r, j) => { const w = createWriteStream(dest); req.pipe(w); w.on('finish', r); w.on('error', j) })
      return json(200, { id: name, name, ...(await probe(dest)) })
    }

    /* POST /api/video/process {sourceId, in, out, op, mode}
     * op.kind:
     *   'trim'    — no spatial change. mode 'fast' = stream-copy (instant,
     *               lossless, keyframe-aligned cut); 'precise' = re-encode.
     *   'crop'    — {crop:{w,h,x,y}} freeform rectangle. Re-encodes.
     *   'format'  — {crop:{w,h,x,y}, out:{w,h}} crop the output window out of the
     *               (untouched) source, then scale it to the format dims. The
     *               source is never moved/scaled, only cropped. Re-encodes.
     * Any op other than a fast trim re-encodes. */
    if (route === '/api/video/process' && req.method === 'POST') {
      const { sourceId, in: inn, out, op = { kind: 'trim' }, mode } = await body()
      const src = path.join(DIRS.sources, safe(sourceId))
      const t = Math.max(0.05, Number(out) - Number(inn))
      const base = safe(sourceId).replace(/^[a-z0-9]+-/, '').replace(/\.[^.]+$/, '')
      const output = path.join(DIRS.outputs, `${base}-${op.kind}-${id()}.mp4`)
      const fastTrim = op.kind === 'trim' && mode !== 'precise'

      const ENC = ['-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart']
      const trim = ['-ss', String(inn), '-i', src, '-t', String(t)]
      let args

      if (fastTrim) {
        args = ['-y', ...trim, '-c', 'copy', '-movflags', '+faststart', '-progress', 'pipe:1', output]
      } else if (op.kind === 'crop') {
        const c = op.crop
        args = ['-y', ...trim, '-vf', `crop=${c.w}:${c.h}:${c.x}:${c.y}`, ...ENC, '-progress', 'pipe:1', output]
      } else if (op.kind === 'format') {
        const c = op.crop, o = op.out
        args = ['-y', ...trim, '-vf', `crop=${c.w}:${c.h}:${c.x}:${c.y},scale=${o.w}:${o.h}`, ...ENC, '-progress', 'pipe:1', output]
      } else {
        args = ['-y', ...trim, ...ENC, '-progress', 'pipe:1', output] // precise trim
      }

      const jobId = enqueue(`${base} · ${op.kind}${fastTrim ? ' (fast)' : ''}`, 'ffmpeg', args, path.basename(output), t * 1e6)
      return json(200, { jobId })
    }

    if (route === '/api/video/jobs') return json(200, [...jobs.values()].reverse())

    /* DELETE /api/video/output/<name> — remove a produced clip */
    if (route.startsWith('/api/video/output/') && req.method === 'DELETE') {
      const name = safe(decodeURIComponent(route.split('/api/video/output/')[1] || ''))
      await fs.rm(path.join(DIRS.outputs, name), { force: true })
      for (const [k, j] of jobs) if (j.output === name) jobs.delete(k)
      return json(200, { ok: true })
    }

    return json(404, { error: `no route ${route}` })
  } catch (err) {
    return json(500, { error: String(err?.message || err) })
  }
}

export { WS }
