#!/usr/bin/env node
// Deterministic render for /glass — the displacement-map glass filter. Pure
// renderGlass(canvas, source, params); motion is resolved against t exactly as
// GlassPage's render loop does (Frame = pan/spin, Form = phase/pulse). Glass loads
// PAUSED with static motion, so we inject Frame 'orbit' + Form 'flow' to make each
// look move over a still source.
//
// RUN: node scripts/render-glass.mjs --source img.png [--out dir] [--fps 30] [--seconds 6]

import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, copyFileSync, existsSync } from 'node:fs'
import { dirname, resolve, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d }
const pad = (n) => String(n).padStart(4, '0')

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
    const reg = await import('/src/pages/glass/registry.js')
    return reg.PRESETS.map((p) => ({ id: p.id, params: p.params }))
  })
  console.log(`▶ glass: ${presets.length} clip(s) → ${outRoot}  [${await browser.version()}]`)

  await page.evaluate(async ({ srcDataUrl, W, H }) => {
    const eng = await import('/src/pages/glass/engine/displace.js')
    window.__renderGlass = eng.renderGlass
    const img = new Image(); img.src = srcDataUrl; await img.decode()
    window.__src = img
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H
    window.__cv = cv
    // Frame 'orbit' (pan + spin) + Form 'flow' (internal phase) — the injected motion.
    window.__motion = { panSpeedX: 0.08, panSpeedY: 0, spin: 14, phase: 1, pulse: 0 }
  }, { srcDataUrl, W, H })

  let ok = 0
  for (const pre of presets) {
    const t0 = Date.now()
    const name = `glass-${pre.id}`
    const folder = join(outRoot, name)
    const framesDir = join(folder, '.frames')
    try {
      mkdirSync(framesDir, { recursive: true })
      await page.evaluate((look) => { window.__look = look }, pre.params)
      for (let i = 0; i < N; i++) {
        const b64 = await page.evaluate((t) => {
          const look = window.__look, m = window.__motion
          const amp = 1 + m.pulse * 0.4 * Math.sin(t * 3)
          window.__renderGlass(window.__cv, window.__src, {
            ...look,
            angle: (look.angle || 0) + m.spin * t,
            panX: m.panSpeedX * t,
            panY: m.panSpeedY * t,
            xShift: look.xShift * amp,
            yShift: look.yShift * amp,
            time: t * m.phase,
            ss: 1,
          })
          return window.__cv.toDataURL('image/png').split(',')[1]
        }, (i / fps))
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
