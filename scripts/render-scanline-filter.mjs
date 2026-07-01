#!/usr/bin/env node
// Deterministic render for /scanlines/filter — the FILTER twin of the scanline
// generator. Reuses the proven pure engine renderScanlines(canvas, params, t); the
// only difference from the generator is params.sample, a luma sampler built from a
// source image (makeLuma + coverDraw, exactly as ScanlineEditor.loadImageFile does).
// A still source ⇒ no field motion, so we inject `sweep`+`pulse` (per-mark breathing)
// to make the clip move.
//
// RUN: node scripts/render-scanline-filter.mjs --source img.png [--out dir] [--fps 30] [--seconds 6]
// (needs a private vite dev server for the module graph — port from _tmp/renders/_viteport.txt)

import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, copyFileSync, existsSync } from 'node:fs'
import { dirname, resolve, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d }
const pad = (n) => String(n).padStart(4, '0')

const FALLBACK = { geometry: 'rows', mark: 'dots', field: 'noise', source: 'none', rows: 90, rayCount: 200, ringCount: 60, turns: 6, arms: 1, minGap: 5, maxGap: 24, freq: 1, contrast: 1, displace: 0, swirl: 0, lens: 1.6, weave: false, markSize: 1, dashLen: 1.2, charset: 'ascii', fontScale: 1, palette: 'mono', invert: false, flow: 1, drift: 0, spin: 0, pulse: 0, sweep: 0 }

async function main() {
  const outRoot = resolve(arg('--out', join(ROOT, '_tmp/renders')))
  const fps = Number(arg('--fps', 30))
  const seconds = Number(arg('--seconds', 6))
  const sourcePath = resolve(arg('--source', join(ROOT, 'clip_20260619_045346.png')))
  const W = 1080, H = 1080, N = Math.max(2, Math.round(seconds * fps))
  const port = existsSync(join(ROOT, '_tmp/renders/_viteport.txt')) ? readFileSync(join(ROOT, '_tmp/renders/_viteport.txt'), 'utf8').trim() : '5223'
  const devUrl = arg('--dev-url', `http://localhost:${port}`)
  const mime = extname(sourcePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg'
  const srcDataUrl = `data:${mime};base64,${readFileSync(sourcePath).toString('base64')}`
  mkdirSync(outRoot, { recursive: true })

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: W, height: H } })
  await page.goto(devUrl, { waitUntil: 'domcontentloaded' })

  const presets = await page.evaluate(async () => {
    const reg = await import('/src/pages/scanlines/registry.js')
    return reg.FILTER_PRESETS.filter((p) => (p.defaults.source || 'image') !== 'webcam').map((p) => ({ id: p.id, defaults: p.defaults }))
  })
  console.log(`▶ scanline-filter: ${presets.length} clip(s) → ${outRoot}  [${await browser.version()}]`)

  // load source + build the luma sampler once
  await page.evaluate(async ({ srcDataUrl, W, H }) => {
    const cam = await import('/src/pages/scanlines/camera.js')
    const img = new Image(); img.src = srcDataUrl; await img.decode()
    const sw = 240, sh = 240 // square render → square sampler
    const sc = document.createElement('canvas'); sc.width = sw; sc.height = sh
    cam.coverDraw(sc.getContext('2d'), img, sw, sh, false)
    window.__sample = cam.makeLuma(sc.getContext('2d').getImageData(0, 0, sw, sh))
    const eng = await import('/src/pages/scanlines/engine.js')
    window.__render = eng.renderScanlines
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H
    window.__cv = cv
  }, { srcDataUrl, W, H })

  let ok = 0
  for (const pre of presets) {
    const t0 = Date.now()
    const name = `scanline-filter-${pre.id}`
    const folder = join(outRoot, name)
    const framesDir = join(folder, '.frames')
    try {
      mkdirSync(framesDir, { recursive: true })
      await page.evaluate((merged) => {
        // sample replaces the source field; inject sweep+pulse so a still source moves
        window.__p = { ...merged, sample: window.__sample, sweep: 0.6, pulse: 0.3 }
      }, { ...FALLBACK, ...pre.defaults })
      for (let i = 0; i < N; i++) {
        const b64 = await page.evaluate((t) => { window.__render(window.__cv, window.__p, t); return window.__cv.toDataURL('image/png').split(',')[1] }, (i / fps))
        writeFileSync(join(framesDir, `f${pad(i)}.png`), Buffer.from(b64, 'base64'))
      }
      const captured = readdirSync(framesDir).filter((f) => f.endsWith('.png')).length
      const mp4 = join(folder, `${name}.mp4`)
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(framesDir, 'f%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', mp4])
      copyFileSync(join(framesDir, `f${pad(Math.floor(N / 2))}.png`), join(folder, 'poster.png'))
      rmSync(framesDir, { recursive: true, force: true })
      ok++
      console.log(`  ✓ ${name}  ${captured}/${N}f  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
    } catch (e) {
      console.log(`  ✗ ${name}: ${e.message}`)
    }
  }
  await browser.close()
  console.log(`done. ${ok}/${presets.length} clips.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
