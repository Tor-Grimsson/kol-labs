#!/usr/bin/env node
// Deterministic batch render for the src/loops/ library (shape · field · pattern).
//
// These are class-based, multi-module engines (LoopPlayer2D + a loop graph that
// imports siblings), so the scanlines inject-a-pure-fn trick doesn't fit. Instead
// we point a headless page at a PRIVATE vite dev server (NOT :5173) which resolves
// the module graph, instantiate LoopPlayer2D, and use its own `seek` + `exportBlobAt`
// to render each frame of a seamless loop (u:0→1 over the loop's native duration).
//
// REQUIRES: a vite dev server running (default http://localhost:<_tmp/renders/_viteport.txt|5223>);
//           playwright + ffmpeg (already installed).
// RUN:  node scripts/render-loops.mjs [--out dir] [--fps 30] [--group shape|field|pattern] [--dev-url URL]
//
// OUTPUT per clip: <out>/loops-<group>-<preset>/  { INDEX.md, <name>.mp4, poster.png }
// Seamless loop: seconds = the loop's own duration; one full cycle, no seam frame.

import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, copyFileSync, existsSync, statSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const arg = (flag, fb) => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : fb }
const fmtSize = (b) => (b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)
const pad = (n) => String(n).padStart(4, '0')
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const slug = (s) => String(s).replace(/[^a-z0-9]+/gi, '-').toLowerCase()

function ffprobe(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,codec_name,pix_fmt,nb_frames,duration',
    '-of', 'default=noprint_wrappers=1', file]).toString()
  const o = {}
  for (const l of out.trim().split('\n')) { const [k, v] = l.split('='); o[k] = v }
  return o
}

function indexMd({ preset, group, params, dims, probe, frames, sizeBytes, browser, fps, seconds, when }) {
  const issues = []
  if (frames.requested !== frames.captured) issues.push(`requested ${frames.requested} ≠ captured ${frames.captured}`)
  if (probe.nb_frames && Number(probe.nb_frames) !== frames.captured) issues.push(`captured ${frames.captured} ≠ muxed ${probe.nb_frames}`)
  if (Math.abs(Number(probe.duration) - seconds) > 0.08) issues.push(`duration ${Number(probe.duration).toFixed(2)}s ≠ ${seconds}s`)
  const mismatch = issues.length ? issues.join('; ') : 'none'
  const title = `Loops — ${cap(group)} · ${preset.id}`
  return `---
title: ${title}
type: log
status: active
updated: ${when.slice(0, 10)}
page: loops
group: ${group}
preset: ${preset.id}
loop: ${preset.loop}
fps: ${fps}
duration_s: ${seconds}
dimensions: ${dims.w}x${dims.h}
codec: ${probe.codec_name} / ${probe.pix_fmt}
capture: loop-player
browser: ${browser}
mismatch: ${mismatch === 'none' ? 'none' : `"${mismatch}"`}
---

# ${title}

![[poster.png]]

Seamless ${seconds}s loop of the \`${preset.loop}\` loop (sub: ${preset.sub}), preset \`${preset.id}\`.

## Render log

| field | value |
|---|---|
| page · group · preset | loops · ${group} · ${preset.id} |
| base loop · sub | \`${preset.loop}\` · ${preset.sub} |
| dimensions | ${dims.w} × ${dims.h} |
| framerate | ${fps} fps |
| duration (native loop) | ${Number(probe.duration).toFixed(2)} s |
| frames requested | ${frames.requested} |
| frames captured | ${frames.captured} |
| frames muxed | ${probe.nb_frames || '?'} |
| **mismatch** | ${mismatch} |
| container · codec | mp4 · ${probe.codec_name} / ${probe.pix_fmt} |
| file size | ${fmtSize(sizeBytes)} |
| capture method | private vite dev module import → \`LoopPlayer2D.seek(frac)\` + \`exportBlobAt(w,h)\` per frame (seamless, u:0→1 over dur) |
| browser | ${browser} (Playwright) |
| engine | \`src/loops/LoopPlayer2D.js\` + \`src/loops/${group}/\` |
| rendered | ${when.replace('T', ' ').slice(0, 16)} |

## Params

\`\`\`json
${JSON.stringify(params, null, 2)}
\`\`\`

## Files

- \`loops-${group}-${slug(preset.id)}.mp4\` — the clip
- \`poster.png\` — middle frame
`
}

async function main() {
  const outRoot = resolve(arg('--out', join(ROOT, '_tmp/renders')))
  const fps = Number(arg('--fps', 30))
  const onlyGroup = arg('--group', null)
  const limit = Number(arg('--limit', 0))
  const portFile = join(ROOT, '_tmp/renders/_viteport.txt')
  const port = existsSync(portFile) ? readFileSync(portFile, 'utf8').trim() : '5223'
  const devUrl = arg('--dev-url', `http://localhost:${port}`)
  mkdirSync(outRoot, { recursive: true })

  const browser = await chromium.launch()
  const browserLabel = `Chromium ${await browser.version()}`
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } })
  await page.goto(devUrl, { waitUntil: 'domcontentloaded' })

  // Enumerate presets in-browser (the registry graph only resolves via the dev server).
  const presets = await page.evaluate(async ({ onlyGroup }) => {
    const reg = await import('/src/loops/registry.js')
    const out = []
    for (const g of reg.GROUPS) {
      if (onlyGroup && g.id !== onlyGroup) continue
      for (const p of reg.presetsInGroup(g.id)) {
        const loop = reg.loopById(p.loop)
        out.push({ id: p.id, loop: p.loop, sub: p.sub, group: g.id, dur: loop?.duration || 6, params: reg.presetParams(p) })
      }
    }
    return out
  }, { onlyGroup })

  const todo = limit ? presets.slice(0, limit) : presets
  console.log(`▶ loops: ${todo.length}/${presets.length} clip(s) → ${outRoot}  [${browserLabel}, dev ${devUrl}]`)

  let ok = 0
  for (const pre of todo) {
    const t0 = Date.now()
    const seconds = pre.dur
    const W = 1080, H = 1080, N = Math.max(2, Math.round(seconds * fps))
    const name = `loops-${pre.group}-${slug(pre.id)}`
    const folder = join(outRoot, name)
    const framesDir = join(folder, '.frames')
    try {
      mkdirSync(framesDir, { recursive: true })
      // build the player once for this preset
      await page.evaluate(async ({ id, W, H }) => {
        const reg = await import('/src/loops/registry.js')
        const M = await import('/src/loops/LoopPlayer2D.js')
        const preset = reg.presetById(id)
        const player = new M.default(document.createElement('canvas'), reg.loopById(preset.loop), reg.presetParams(preset))
        player.setTransport({ paused: true })
        window.__player = player; window.__W = W; window.__H = H
      }, { id: pre.id, W, H })

      for (let i = 0; i < N; i++) {
        const b64 = await page.evaluate(async (frac) => {
          window.__player.seek(frac)
          const blob = await window.__player.exportBlobAt(window.__W, window.__H)
          return await new Promise((res) => { const fr = new FileReader(); fr.onloadend = () => res(fr.result.split(',')[1]); fr.readAsDataURL(blob) })
        }, i / N)
        writeFileSync(join(framesDir, `f${pad(i)}.png`), Buffer.from(b64, 'base64'))
      }

      const captured = readdirSync(framesDir).filter((f) => f.endsWith('.png')).length
      const mp4 = join(folder, `${name}.mp4`)
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(framesDir, 'f%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', mp4])
      copyFileSync(join(framesDir, `f${pad(Math.floor(N / 2))}.png`), join(folder, 'poster.png'))
      const probe = ffprobe(mp4)
      writeFileSync(join(folder, 'INDEX.md'), indexMd({
        preset: pre, group: pre.group, params: pre.params,
        dims: { w: W, h: H }, probe, frames: { requested: N, captured },
        sizeBytes: statSync(mp4).size, browser: browserLabel, fps, seconds, when: new Date().toISOString(),
      }))
      rmSync(framesDir, { recursive: true, force: true })
      ok++
      console.log(`  ✓ ${name}  ${captured}/${N}f @${fps}  ${seconds}s  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
    } catch (e) {
      console.log(`  ✗ ${name}: ${e.message}`)
    }
  }
  await browser.close()
  console.log(`done. ${ok}/${todo.length} clips.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
