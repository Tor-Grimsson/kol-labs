#!/usr/bin/env node
// Live real-time canvas capture for ANY kol-labs page — including the GPU/three.js
// ones that can't be rendered by a pure call. Drive the real built app on a private
// vite dev server, start playback (Space), then record the stage canvas with
// captureStream + MediaRecorder (works on WebGL too), webm → mp4. Not deterministic;
// it records exactly what plays. That's fine — we want videos.
//
// RUN:  node scripts/render-live.mjs --jobs scripts/live-jobs.json [--out dir] [--seconds 8] [--fps 30]
// Jobs: [{ "route": "/drift", "name": "drift" }, ...]  (seconds/fps optional per job)

import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync, existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d }
const pad = (n) => String(n).padStart(4, '0')

// captureStream is unreliable on WebGL canvases (preserveDrawingBuffer:false), so we
// screenshot the live stage as fast as we can over the clip window — the page is
// animating in real time (autoplay forced on) so consecutive shots are time-distinct
// — then assemble at the measured capture rate so playback is ~realtime.
async function recordOne(page, devUrl, job, outRoot, defSeconds) {
  const seconds = job.seconds || defSeconds
  await page.goto(devUrl + job.route, { waitUntil: 'domcontentloaded' })
  if (job.source) {
    // filter pages render nothing until a source image is loaded — inject one via the
    // hidden file input (no per-page UI clicking needed).
    try {
      await page.locator('input[type=file]').first().waitFor({ state: 'attached', timeout: 10000 })
      await page.setInputFiles('input[type=file]', job.source)
      await page.waitForTimeout(1800)
    } catch { /* page isn't source-driven — carry on */ }
  }
  await page.waitForFunction(() => !!(window.__pickCanvas && window.__pickCanvas()), { timeout: 20000 })
  await page.waitForTimeout(1200) // warm-up / motion build

  // Ensure playing: some pages ignore the autoplay setting and mount paused. If the
  // canvas isn't changing, nudge the transport (Space). WebGL toDataURL is unreliable
  // → treat a read failure as "animating" so we don't pause a working WebGL page.
  const animating = async () => page.evaluate(async () => {
    const c = window.__pickCanvas()
    if (!c) return false
    let a; try { a = c.toDataURL().length } catch { return true }
    await new Promise((r) => setTimeout(r, 400))
    let b; try { b = c.toDataURL().length } catch { return true }
    return a !== b
  })
  if (!(await animating())) { await page.keyboard.press('Space'); await page.waitForTimeout(700) }

  // Record the live canvas in real time. In headed mode the compositor runs at full
  // rate, and with preserveDrawingBuffer forced on (addInitScript) captureStream gets
  // real WebGL frames. timeslice keeps dataavailable firing.
  const fps = job.fps || 30
  const res = await page.evaluate(async ({ seconds, fps }) => {
    const canvas = window.__pickCanvas()
    if (!canvas) return { error: 'no canvas' }
    const stream = canvas.captureStream(fps)
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m))
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 16_000_000 })
    const chunks = []
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
    const stopped = new Promise((r) => { rec.onstop = r })
    rec.start(100)
    await new Promise((r) => setTimeout(r, seconds * 1000))
    rec.stop(); await stopped
    const blob = new Blob(chunks, { type: 'video/webm' })
    const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onloadend = () => r(fr.result.split(',')[1]); fr.readAsDataURL(blob) })
    return { b64, w: canvas.width, h: canvas.height, bytes: blob.size }
  }, { seconds, fps })
  if (res.error || !res.b64) throw new Error(res.error || 'empty recording')

  mkdirSync(outRoot, { recursive: true })
  const webm = join(outRoot, `.${job.name}.webm`)
  const mp4 = join(outRoot, `${job.name}.mp4`)
  writeFileSync(webm, Buffer.from(res.b64, 'base64'))
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4])
  rmSync(webm, { force: true })
  const nb = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=nb_read_frames', '-of', 'default=nk=1:noprint_wrappers=1', mp4]).toString().trim()
  if (Number(nb) < 4) throw new Error(`only ${nb} frames captured`)
  return { mp4, frames: Number(nb), w: res.w, h: res.h, size: statSync(mp4).size }
}

async function main() {
  const outRoot = resolve(arg('--out', join(ROOT, '_tmp/renders-live')))
  const defSeconds = Number(arg('--seconds', 8))
  const defFps = Number(arg('--fps', 30))
  const jobsFile = arg('--jobs', join(ROOT, 'scripts/live-jobs.json'))
  const port = existsSync(join(ROOT, '_tmp/renders/_viteport.txt')) ? readFileSync(join(ROOT, '_tmp/renders/_viteport.txt'), 'utf8').trim() : '5223'
  const devUrl = arg('--dev-url', `http://localhost:${port}`)
  const jobs = JSON.parse(readFileSync(resolve(jobsFile), 'utf8'))

  // Headless throttles rAF/compositor for "hidden" pages, which starves captureStream
  // (→ ~2fps). These flags keep the render loop + compositor running at full rate.
  // HEADED: captureStream of a WebGL canvas needs a real compositor; headless throttles
  // and starves it. The flags keep the loop full-rate; the window is fine overnight.
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required'],
  })
  const page = await browser.newPage({ viewport: { width: 1280, height: 1280 } })
  // Before any app JS: (1) force autoplay so pages mount playing; (2) force
  // preserveDrawingBuffer so WebGL canvases are capturable by captureStream.
  await page.addInitScript(() => {
    try {
      const KEY = 'kol-labs:settings'
      const cur = JSON.parse(localStorage.getItem(KEY) || '{}')
      localStorage.setItem(KEY, JSON.stringify({ ...cur, autoplay: true }))
    } catch { /* ignore */ }
    const orig = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, attrs) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
        attrs = Object.assign({}, attrs, { preserveDrawingBuffer: true })
      }
      return orig.call(this, type, attrs)
    }
    // pick the largest live canvas — multi-canvas pages (math axes overlay + art, etc.)
    // were capturing a small overlay; the art is the biggest one.
    window.__pickCanvas = () => {
      const stage = document.querySelector('[data-vcap=stage]')
      const set = new Set()
      if (stage && stage.tagName === 'CANVAS') set.add(stage)
      ;(stage || document).querySelectorAll('canvas').forEach((c) => set.add(c))
      const cs = [...set].filter((c) => c.width > 0 && c.height > 0)
      return cs.sort((a, b) => b.width * b.height - a.width * a.height)[0] || null
    }
  })
  console.log(`▶ live: ${jobs.length} clip(s) → ${outRoot}  [${await browser.version()}, dev ${devUrl}]`)
  let ok = 0
  for (const job of jobs) {
    const t0 = Date.now()
    try {
      const r = await recordOne(page, devUrl, job, outRoot, defSeconds)
      ok++
      console.log(`  ✓ ${job.name}  ${r.w}x${r.h}  ${r.frames}f  ${(r.size / 1024 / 1024).toFixed(1)}MB  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
    } catch (e) {
      console.log(`  ✗ ${job.name} (${job.route}): ${e.message}`)
    }
  }
  await browser.close()
  console.log(`done. ${ok}/${jobs.length} clips.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
