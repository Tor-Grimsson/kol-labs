#!/usr/bin/env node
// Deterministic render for the /pattern studio sub-pages. patternLoop is a pure
// draw(ctx, u, w, h, params) (like a loop), so we render it offscreen frame-by-frame
// via the private vite dev server — 100% reliable, unlike live captureStream.
//
// Pattern presets load PAUSED ("the engine only moves when camera/spin/sweep run"),
// so a still preset would render a frozen clip. We inject camFlow:1 (a seamless
// integer pan) on any preset that carries no motion, so every clip actually moves.
//
// RUN:  node scripts/render-pattern.mjs [--out dir] [--fps 30] [--limit N]
// (needs a private vite dev server — port from _tmp/renders/_viteport.txt, default 5223)

import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, copyFileSync, existsSync, statSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d }
const pad = (n) => String(n).padStart(4, '0')
const slug = (s) => String(s).replace(/[^a-z0-9]+/gi, '-').toLowerCase()

async function main() {
  const outRoot = resolve(arg('--out', join(ROOT, '_tmp/renders')))
  const fps = Number(arg('--fps', 30))
  const limit = Number(arg('--limit', 0))
  const W = 1080, H = 1080
  const port = existsSync(join(ROOT, '_tmp/renders/_viteport.txt')) ? readFileSync(join(ROOT, '_tmp/renders/_viteport.txt'), 'utf8').trim() : '5223'
  const devUrl = arg('--dev-url', `http://localhost:${port}`)
  mkdirSync(outRoot, { recursive: true })

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: W, height: H } })
  await page.goto(devUrl, { waitUntil: 'domcontentloaded' })

  const subs = await page.evaluate(async () => {
    const reg = await import('/src/pages/pattern/registry.js')
    return reg.ALL_SUBPAGES.map((s) => ({ id: s.id, cat: s.cat, label: s.label }))
  })
  const todo = limit ? subs.slice(0, limit) : subs
  console.log(`▶ pattern: ${todo.length}/${subs.length} clip(s) → ${outRoot}  [${await browser.version()}]`)

  let ok = 0
  for (const sub of todo) {
    const t0 = Date.now()
    const name = `pattern-${sub.cat}-${slug(sub.id)}`
    const folder = join(outRoot, name)
    const framesDir = join(folder, '.frames')
    try {
      mkdirSync(framesDir, { recursive: true })
      const dur = await page.evaluate(async ({ id, W, H }) => {
        const pat = await import('/src/loops/pattern/patternLoop.js')
        const reg = await import('/src/pages/pattern/registry.js')
        const { resolveParams } = await import('/src/lib/exprParam.js')
        const patternLoop = pat.default
        const sub = reg.ALL_SUBPAGES.find((s) => s.id === id) || reg.ALL_SUBPAGES[0]
        const v = { ...patternLoop.defaults, ...(sub.params || {}) }
        if (!v.camFlow && !v.spin && !v.animCycles) v.camFlow = 1 // inject seamless pan if static
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H
        window.__draw = (u) => patternLoop.draw(cv.getContext('2d'), u, W, H, resolveParams(v, u * (patternLoop.duration || 8)))
        window.__cv = cv
        return patternLoop.duration || 8
      }, { id: sub.id, W, H })

      const N = Math.max(2, Math.round(dur * fps))
      for (let i = 0; i < N; i++) {
        const b64 = await page.evaluate((u) => {
          window.__draw(u)
          return window.__cv.toDataURL('image/png').split(',')[1]
        }, i / N)
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
  console.log(`done. ${ok}/${todo.length} clips.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
