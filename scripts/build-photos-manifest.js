#!/usr/bin/env node
/**
 * Build-time generator for public/__photos.json — scans the photo library under
 * public/images/* (one level deep) and emits the manifest the Gallery page reads
 * at runtime. Ported from apps/brand so kol-labs' Gallery shows the same set.
 *
 * Output shape: { groups: [{ name, count, files: ['/images/<group>/<file>', ...] }] }
 *
 * Run manually after adding/removing images: `node scripts/build-photos-manifest.js`
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')
const IMAGES_DIR = path.join(PROJECT_ROOT, 'public', 'images')
const OUT_FILE = path.join(PROJECT_ROOT, 'public', '__photos.json')

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|svg)$/i

const groups = []

if (!fs.existsSync(IMAGES_DIR)) {
  console.warn(`[photos-manifest] Images dir missing — writing empty manifest: ${IMAGES_DIR}`)
  fs.writeFileSync(OUT_FILE, JSON.stringify({ groups }, null, 2) + '\n', 'utf8')
  process.exit(0)
}

for (const entry of fs.readdirSync(IMAGES_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const dir = path.join(IMAGES_DIR, entry.name)
  const files = fs
    .readdirSync(dir)
    .filter((f) => IMAGE_EXT.test(f))
    .map((f) => `/images/${entry.name}/${f}`)
    .sort()
  if (files.length > 0) groups.push({ name: entry.name, count: files.length, files })
}

fs.writeFileSync(OUT_FILE, JSON.stringify({ groups }, null, 2) + '\n', 'utf8')

const total = groups.reduce((n, g) => n + g.count, 0)
console.log(`[photos-manifest] Wrote ${OUT_FILE} — ${groups.length} groups, ${total} files`)
