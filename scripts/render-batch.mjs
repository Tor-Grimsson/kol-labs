#!/usr/bin/env node
// Deterministic batch video render for kol-labs pure-canvas generator pages.
//
// WHY this shape: these engines are pure — `render(canvas, params, t)`, no clock,
// no React. So we don't screen-record the live app (gesture-gated prompt, realtime,
// one clip at a time). We inject the engine into a blank headless page, step `t`
// frame-by-frame, screenshot each frame, and ffmpeg them to mp4. No dev server, no
// prompt, no realtime wait — deterministic and unattended. (Proven 2026-06-26 on
// scanlines/spaced/drift; see docs/vid-pipline-exp/.)
//
// REQUIRES (one-time): pnpm add -D playwright && npx playwright install chromium
//                      (ffmpeg/ffprobe must be on PATH — already are.)
// RUN:   node scripts/render-batch.mjs                 # the DEFAULT_JOBS below
//        node scripts/render-batch.mjs --jobs jobs.json
//        node scripts/render-batch.mjs --out ~/Movies/kol
//
// OUTPUT: <out>/<page>-<cat>-<preset>/
//           INDEX.md   ← folder note: fps, dims, format, capture, browser, mismatch…
//           <name>.mp4
//           poster.png ← middle frame
//
// Each job: { page, seconds, fps, width, height, tempo?, cat?, preset? }.
//   SWEEP — omit `preset` to render many clips from one line:
//     { page:'scanlines' }                 → every category × preset on the page
//     { page:'scanlines', cat:'spaced' }   → every preset in that category
//     { page:'scanlines', cat, preset }    → a single clip
//   seconds/fps/width/height/tempo carry over to every expanded clip.
//   See scripts/render-jobs.example.json.

import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, copyFileSync, existsSync, statSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── page registry — add a pure-canvas page here ────────────────────────────
// Each engine exports a pure render(canvas, params, t). `fallback` mirrors the
// editor's defaults (source of truth noted per page — keep in sync); presets are
// imported LIVE from the page's registry so they never drift.
const PAGES = {
  scanlines: {
    enginePath: 'src/pages/scanlines/engine.js',
    registryPath: 'src/pages/scanlines/registry.js',
    globalName: 'renderScanlines',
    capture: 'injected-engine', // pure engine on about:blank, element screenshot
    // mirrors ScanlineEditor.jsx FALLBACK (the const at the top of that file) —
    // if that changes, update here. Presets below are imported, not copied.
    fallback: { geometry: 'rows', mark: 'dots', field: 'noise', source: 'none', rows: 90, rayCount: 200, ringCount: 60, turns: 6, arms: 1, minGap: 5, maxGap: 24, freq: 1, contrast: 1, displace: 0, swirl: 0, lens: 1.6, weave: false, markSize: 1, dashLen: 1.2, charset: 'ascii', fontScale: 1, palette: 'mono', invert: false, flow: 1, drift: 0, spin: 0, pulse: 0, sweep: 0 },
    async pick(cat, preset) {
      const reg = await import(pathToFileURL(resolve(ROOT, this.registryPath)).href)
      const catId = cat || reg.SCANLINE_CATEGORIES[0].id
      const presets = reg.SCANLINE_PRESETS[catId] || reg.SCANLINE_PRESETS[reg.SCANLINE_CATEGORIES[0].id]
      const pre = preset ? presets.find((p) => p.id === preset) : presets[0]
      if (!pre) throw new Error(`scanlines: no preset "${preset}" in category "${catId}"`)
      // route: first category owns /scanlines, the rest are /scanlines/<cat>
      const route = catId === reg.SCANLINE_CATEGORIES[0].id ? '/scanlines' : `/scanlines/${catId}`
      return { catId, preset: pre, route, params: { ...this.fallback, ...pre.defaults, seed: 0 } }
    },
    // Enumerate {cat, preset} pairs for a sweep — one category if `cat` given, else
    // every category × every preset on the page.
    async list(cat) {
      const reg = await import(pathToFileURL(resolve(ROOT, this.registryPath)).href)
      const cats = cat ? [cat] : reg.SCANLINE_CATEGORIES.map((c) => c.id)
      return cats.flatMap((c) => (reg.SCANLINE_PRESETS[c] || []).map((p) => ({ cat: c, preset: p.id })))
    },
  },
}

// Expand sweep jobs into concrete per-clip jobs. A job is a SWEEP unless it names a
// `preset`: no `cat` ⇒ the whole page (every category × preset); `cat` only ⇒ that
// category's presets; both `cat`+`preset` ⇒ a single clip. seconds/fps/dims/tempo
// carry over to every expanded clip.
async function expandJobs(jobs) {
  const out = []
  for (const job of jobs) {
    const desc = PAGES[job.page]
    if (!desc || job.preset) { out.push(job); continue } // unknown page → renderJob throws clearly; fully-specified → as-is
    for (const { cat, preset } of await desc.list(job.cat)) out.push({ ...job, cat, preset })
  }
  return out
}

const DEFAULT_JOBS = [
  { page: 'scanlines', cat: 'spaced', preset: 'drift', seconds: 10, fps: 30, width: 1080, height: 1080 },
]

// ── helpers ─────────────────────────────────────────────────────────────────
// Strip ES `export` so the engine loads as a classic script, expose what we call.
function globalizeEngine(src, globalName) {
  return src.replace(/^export /gm, '') + `\nwindow.${globalName} = ${globalName};\nwindow.PALETTES = PALETTES;\n`
}

const fmtSize = (b) => (b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)
const pad = (n) => String(n).padStart(4, '0')

function ffprobe(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,codec_name,pix_fmt,nb_frames,duration',
    '-of', 'default=noprint_wrappers=1', file]).toString()
  const o = {}
  for (const line of out.trim().split('\n')) { const [k, v] = line.split('='); o[k] = v }
  return o
}

function indexMd({ job, route, catId, preset, params, dims, probe, frames, sizeBytes, browser, when }) {
  const issues = []
  if (frames.requested !== frames.captured) issues.push(`requested ${frames.requested} ≠ captured ${frames.captured}`)
  if (probe.nb_frames && Number(probe.nb_frames) !== frames.captured) issues.push(`captured ${frames.captured} ≠ muxed ${probe.nb_frames}`)
  if (Math.abs(Number(probe.duration) - job.seconds) > 0.05) issues.push(`duration ${Number(probe.duration).toFixed(2)}s ≠ ${job.seconds}s`)
  const mismatch = issues.length ? issues.join('; ') : 'none'
  const ratio = (dims.w / dims.h).toFixed(3)
  const title = `${cap(job.page)} — ${cap(catId)} · ${cap(preset.id)}`
  return `---
title: ${title}
type: log
status: active
updated: ${when.slice(0, 10)}
page: ${job.page}
category: ${catId}
preset: ${preset.id}
fps: ${job.fps}
duration_s: ${job.seconds}
dimensions: ${dims.w}x${dims.h}
codec: ${probe.codec_name} / ${probe.pix_fmt}
capture: ${PAGES[job.page].capture}
browser: ${browser}
mismatch: ${mismatch === 'none' ? 'none' : `"${mismatch}"`}
---

# ${title}

![[poster.png]]

${job.seconds}s deterministic render of \`${route}\` → ${cap(catId)} → ${cap(preset.id)}.

## Render log

| field | value |
|---|---|
| page · category · preset | ${job.page} · ${catId} · ${preset.id} |
| route | \`${route}\` |
| dimensions | ${dims.w} × ${dims.h} (ratio ${ratio}) |
| framerate | ${job.fps} fps |
| duration | ${Number(probe.duration).toFixed(2)} s |
| frames requested | ${frames.requested} |
| frames captured | ${frames.captured} |
| frames muxed | ${probe.nb_frames || '?'} |
| **mismatch** | ${mismatch} |
| container · codec | mp4 · ${probe.codec_name} / ${probe.pix_fmt} |
| file size | ${fmtSize(sizeBytes)} |
| capture method | headless Chromium · injected pure engine (\`${PAGES[job.page].globalName}\`), element screenshot per frame |
| browser | ${browser} (Playwright) |
| time base | t = frame / fps × tempo/120 (tempo ${job.tempo ?? 120}${(job.tempo ?? 120) === 120 ? ' = realtime' : ''}) |
| seed | ${params.seed} |
| engine | \`${PAGES[job.page].enginePath}\` |
| rendered | ${when.replace('T', ' ').slice(0, 16)} |

## Params

\`\`\`json
${JSON.stringify(params, null, 2)}
\`\`\`

## Files

- \`${slug(job, catId, preset)}.mp4\` — the clip
- \`poster.png\` — middle frame
`
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const slug = (job, catId, preset) => `${job.page}-${catId}-${preset.id}`

// ── render one job ────────────────────────────────────────────────────────────
async function renderJob(browser, job, outRoot, browserLabel) {
  const desc = PAGES[job.page]
  if (!desc) throw new Error(`unknown page "${job.page}" (have: ${Object.keys(PAGES).join(', ')})`)
  const { catId, preset, route, params } = await desc.pick(job.cat, job.preset)
  const name = slug(job, catId, preset)
  const folder = join(outRoot, name)
  const framesDir = join(folder, '.frames')
  mkdirSync(framesDir, { recursive: true })

  const engineSrc = globalizeEngine(readFileSync(resolve(ROOT, desc.enginePath), 'utf8'), desc.globalName)
  const page = await browser.newPage({ viewport: { width: job.width, height: job.height } })
  await page.goto('about:blank')
  await page.addScriptTag({ content: engineSrc })
  await page.evaluate(({ params, w, h }) => {
    const pal = window.PALETTES.find((x) => x.value === params.palette) || window.PALETTES[0]
    window.__p = { ...params, bg: pal.bg, fg: pal.fg }
    const cv = document.createElement('canvas')
    cv.id = 'stage'; cv.width = w; cv.height = h
    Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', width: `${w}px`, height: `${h}px`, zIndex: '99999' })
    document.body.appendChild(cv)
    window.__cv = cv
  }, { params, w: job.width, h: job.height })

  const N = job.fps * job.seconds
  const scale = (job.tempo ?? 120) / 120
  const loc = page.locator('#stage')
  for (let i = 0; i < N; i++) {
    await page.evaluate(({ t, fn }) => window[fn](window.__cv, window.__p, t), { t: (i / job.fps) * scale, fn: desc.globalName })
    await loc.screenshot({ path: join(framesDir, `f${pad(i)}.png`) })
  }
  await page.close()

  const captured = readdirSync(framesDir).filter((f) => f.endsWith('.png')).length
  const mp4 = join(folder, `${name}.mp4`)
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(job.fps),
    '-i', join(framesDir, 'f%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', mp4])

  copyFileSync(join(framesDir, `f${pad(Math.floor(N / 2))}.png`), join(folder, 'poster.png'))
  const probe = ffprobe(mp4)
  const when = new Date().toISOString()
  writeFileSync(join(folder, 'INDEX.md'), indexMd({
    job, route, catId, preset, params,
    dims: { w: job.width, h: job.height }, probe,
    frames: { requested: N, captured }, sizeBytes: statSync(mp4).size,
    browser: browserLabel, when,
  }))
  rmSync(framesDir, { recursive: true, force: true })
  return { name, mp4, captured, N, mismatch: captured === N && Number(probe.nb_frames) === N }
}

// ── main ──────────────────────────────────────────────────────────────────────
function arg(flag, fallback) { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : fallback }

async function main() {
  const outRoot = resolve(arg('--out', join(ROOT, '_tmp/renders')))
  const jobsFile = arg('--jobs', null)
  const rawJobs = jobsFile ? JSON.parse(readFileSync(resolve(jobsFile), 'utf8')) : DEFAULT_JOBS
  const jobs = await expandJobs(rawJobs)
  mkdirSync(outRoot, { recursive: true })

  const browser = await chromium.launch()
  const browserLabel = `Chromium ${(await browser.version())}`
  console.log(`▶ ${rawJobs.length} job(s) → ${jobs.length} clip(s) → ${outRoot}  [${browserLabel}]`)
  for (const job of jobs) {
    const t0 = Date.now()
    try {
      const r = await renderJob(browser, job, outRoot, browserLabel)
      console.log(`  ✓ ${r.name}  ${r.captured}/${r.N} frames  ${r.mismatch ? '(no mismatch)' : '⚠ MISMATCH'}  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
    } catch (e) {
      console.log(`  ✗ ${job.page}/${job.cat}/${job.preset}: ${e.message}`)
    }
  }
  await browser.close()
  console.log('done.')
}

main().catch((e) => { console.error(e); process.exit(1) })
