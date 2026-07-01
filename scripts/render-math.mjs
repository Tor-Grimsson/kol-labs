#!/usr/bin/env node
// Deterministic render for the math pages whose engines are React components
// (CurvePlayer: parametric/waveforms/uzumaki/animate; Viewport3D: surfaces/surface/
// attractor). Those can't be instantiated standalone, so we mount the real page with
// ?__render=1 — which exposes window.__kolPlayer (setTime + exportBlobAt) — and drive
// the engine's OWN frame export (rock-solid, unlike captureStream). The page stays
// PAUSED (autoplay off) so setTime controls the playhead exactly.
//
// RUN: node scripts/render-math.mjs [--out dir] [--fps 30] [--seconds 6]

import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, copyFileSync, existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d }
const pad = (n) => String(n).padStart(4, '0')

const ROUTES = [
  '/math/parametric', '/math/waveforms', '/math/uzumaki', '/math/animate',
  '/math/surfaces', '/math/surface', '/math/attractor',
]

async function main() {
  const outRoot = resolve(arg('--out', join(ROOT, '_tmp/renders')))
  const fps = Number(arg('--fps', 30))
  const seconds = Number(arg('--seconds', 6))
  const W = 1080, H = 1080
  const port = existsSync(join(ROOT, '_tmp/renders/_viteport.txt')) ? readFileSync(join(ROOT, '_tmp/renders/_viteport.txt'), 'utf8').trim() : '5223'
  const devUrl = arg('--dev-url', `http://localhost:${port}`)
  mkdirSync(outRoot, { recursive: true })

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: W, height: H } })
  // WebGL (Viewport3D) export needs preserveDrawingBuffer so toBlob reads real pixels.
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, attrs) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') attrs = Object.assign({}, attrs, { preserveDrawingBuffer: true })
      return orig.call(this, type, attrs)
    }
  })
  console.log(`▶ math: ${ROUTES.length} route(s) → ${outRoot}  [${await browser.version()}]`)

  let ok = 0
  for (const route of ROUTES) {
    const t0 = Date.now()
    const name = `math-${route.split('/').pop()}`
    const folder = join(outRoot, name)
    const framesDir = join(folder, '.frames')
    try {
      await page.goto(`${devUrl}${route}?__render=1`, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => !!window.__kolPlayer, { timeout: 15000 })
      await page.waitForTimeout(800) // let the clip/scene settle
      // seamless loop if the engine reports a duration, else a fixed window
      const d = await page.evaluate(() => window.__kolPlayer.dur ? window.__kolPlayer.dur() : 0)
      const clipSecs = d > 0.1 ? d : seconds
      const N = Math.max(2, Math.round(clipSecs * fps))
      mkdirSync(framesDir, { recursive: true })
      for (let i = 0; i < N; i++) {
        const t = d > 0.1 ? (i / N) * d : (i / fps)
        const b64 = await page.evaluate(async ({ t, W, H }) => {
          window.__kolPlayer.setTime(t)
          const blob = await window.__kolPlayer.exportBlobAt(W, H)
          return await new Promise((r) => { const fr = new FileReader(); fr.onloadend = () => r(fr.result.split(',')[1]); fr.readAsDataURL(blob) })
        }, { t, W, H })
        writeFileSync(join(framesDir, `f${pad(i)}.png`), Buffer.from(b64, 'base64'))
      }
      const captured = readdirSync(framesDir).filter((f) => f.endsWith('.png')).length
      const mp4 = join(folder, `${name}.mp4`)
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(framesDir, 'f%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', mp4])
      copyFileSync(join(framesDir, `f${pad(Math.floor(N / 2))}.png`), join(folder, 'poster.png'))
      rmSync(framesDir, { recursive: true, force: true })
      ok++
      console.log(`  ✓ ${name}  ${captured}/${N}f  ${(clipSecs).toFixed(1)}s  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
    } catch (e) {
      rmSync(framesDir, { recursive: true, force: true })
      console.log(`  ✗ ${name} (${route}): ${e.message}`)
    }
  }
  await browser.close()
  console.log(`done. ${ok}/${ROUTES.length} clips.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
