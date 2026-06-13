import { useEffect, useMemo, useRef, useState } from 'react'
import Button from '../../components/atoms/Button.jsx'
import Divider from '../../components/atoms/Divider.jsx'
import Input from '../../components/atoms/Input.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import Textarea from '../../components/atoms/Textarea.jsx'
import Dropdown from '../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import Section from '../../components/molecules/Section.jsx'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import { RATIOS, FACES, BODY_FACE, ensureFace } from './data/registry.js'
import { compose } from './engine/composer.js'
import { renderLayout, serializeSvg } from './engine/renderer.js'

const VARIATIONS = 12
const TILE_W = 240

const download = (url, name) => {
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
}

/* One canvas per layout spec; redraws every render (cheap, deterministic). */
function Tile({ layout, drawOpts, w }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    const scale = w / layout.W
    const h = Math.round(layout.H * scale)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = Math.round(w * dpr)
    c.height = Math.round(h * dpr)
    c.style.width = `${w}px`
    c.style.height = `${h}px`
    renderLayout(c.getContext('2d'), layout, { ...drawOpts, pixelScale: scale * dpr })
  })
  return <canvas ref={ref} className="block" />
}

export default function LayoutPage() {
  const [ready, setReady] = useState(false)
  const [view, setView] = useState('grid')
  const [idx, setIdx] = useState(0)
  const [seedBase, setSeedBase] = useState(42)

  const [ratioId, setRatioId] = useState('4:5')
  const [faceId, setFaceId] = useState('rg-wide-black')
  const [scale, setScale] = useState(1)
  const [columns, setColumns] = useState(4)
  const [gutter, setGutter] = useState(0.02)
  const [margin, setMargin] = useState(0.06)

  const [headline, setHeadline] = useState('Headline')
  const [body, setBody] = useState('Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.')
  const [images, setImages] = useState([])
  const [, setFontTick] = useState(0)
  const fileRef = useRef(null)

  const ratio = RATIOS.find((r) => r.id === ratioId)
  const headFace = FACES.find((f) => f.id === faceId)

  // Body face gates first paint; headline faces load on demand and retrigger a draw.
  useEffect(() => {
    let alive = true
    void ensureFace(BODY_FACE).then(() => alive && setReady(true))
    return () => { alive = false }
  }, [])
  useEffect(() => {
    let alive = true
    void ensureFace(headFace).then(() => alive && setFontTick((t) => t + 1))
    return () => { alive = false }
  }, [headFace])

  const seeds = useMemo(() => Array.from({ length: VARIATIONS }, (_, i) => seedBase + i * 7919), [seedBase])
  const params = useMemo(() => ({ columns, gutter, margin, scale }), [columns, gutter, margin, scale])
  const layouts = useMemo(
    () => seeds.map((seed) => compose({ ratio, seed, params, imageCount: images.length })),
    [seeds, ratio, params, images.length],
  )

  const content = { headline, body }
  const drawOpts = { content, images, headFace, bodyFace: BODY_FACE }

  const go = (d) => {
    setIdx((i) => (i + d + VARIATIONS) % VARIATIONS)
    setView('single')
  }
  const toggleView = () => setView((v) => (v === 'grid' ? 'single' : 'grid'))
  const randomize = () => setSeedBase(Math.floor(Math.random() * 1_000_000))

  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'g' || e.key === 'G') toggleView()
      else if (e.key === 'r' || e.key === 'R') randomize()
      else if (e.key === 'Escape') setView('grid')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const addImages = (files) => {
    for (const file of files) {
      const url = URL.createObjectURL(file)
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => setImages((prev) => [...prev, { name: file.name, url, dataUrl: reader.result, img, w: img.naturalWidth, h: img.naturalHeight }])
        img.src = url
      }
      reader.readAsDataURL(file)
    }
  }
  const removeImage = (i) => setImages((prev) => prev.filter((_, k) => k !== i))

  const exportLayout = layouts[idx]
  const exportPng = () => {
    const c = document.createElement('canvas')
    const pixelScale = 2000 / exportLayout.W
    c.width = 2000
    c.height = Math.round(exportLayout.H * pixelScale)
    renderLayout(c.getContext('2d'), exportLayout, { ...drawOpts, pixelScale })
    c.toBlob((blob) => {
      const url = URL.createObjectURL(blob)
      download(url, `kol-layout-${seeds[idx]}.png`)
      URL.revokeObjectURL(url)
    })
  }
  const exportSvg = () => {
    const svg = serializeSvg(exportLayout, drawOpts)
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    download(url, `kol-layout-${seeds[idx]}.svg`)
    URL.revokeObjectURL(url)
  }

  if (!ready) return null

  const single = layouts[idx]
  const singleW = single.H >= single.W ? Math.round(620 * (single.W / single.H)) : 620

  return (
    <div className="flex min-h-dvh">
      <div className="flex-1 min-w-0 bg-surface-primary p-8 flex">
        {view === 'grid' ? (
          <div className="grid grid-cols-[repeat(auto-fill,240px)] gap-5 w-full content-start justify-center">
            {layouts.map((ly, i) => (
              <button key={seeds[i]} type="button" className="block text-left cursor-pointer" onClick={() => { setIdx(i); setView('single') }}>
                <Tile layout={ly} drawOpts={drawOpts} w={TILE_W} />
                <div className="kol-helper-10 text-meta mt-1">{String(i + 1).padStart(2, '0')} · {ly.arch} · {seeds[i]}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="m-auto">
            <Tile layout={single} drawOpts={drawOpts} w={singleW} />
            <div className="kol-helper-10 text-meta mt-2">{String(idx + 1).padStart(2, '0')} / {String(VARIATIONS).padStart(2, '0')} · {single.arch} · seed {seeds[idx]}</div>
          </div>
        )}
      </div>

      <EditorRail>
        <RailHeader>Layout</RailHeader>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={toggleView}>{view === 'grid' ? 'single' : 'grid'}</Button>
          <Button variant="outline" size="sm" onClick={() => go(-1)}>← prev</Button>
          <Button variant="outline" size="sm" onClick={() => go(1)}>next →</Button>
          <Button variant="ghost" size="sm" onClick={randomize}>randomize</Button>
        </div>

        <Divider />

        <Section label="Artboard">
          <Dropdown size="sm" variant="subtle" className="w-full" options={RATIOS.map((r) => ({ value: r.id, label: r.label }))} value={ratioId} onChange={setRatioId} />
        </Section>

        <Section label="Typography">
          <LabeledControl inline label="face">
            <Dropdown size="sm" variant="subtle" className="w-full" options={FACES.map((f) => ({ value: f.id, label: f.label }))} value={faceId} onChange={setFaceId} />
          </LabeledControl>
          <Slider label="Scale" min={0.6} max={1.6} step={0.05} value={scale} onChange={setScale} className="w-full" />
        </Section>

        <Section label="Grid">
          <Slider label="Columns" min={2} max={6} step={1} value={columns} onChange={(v) => setColumns(Math.round(v))} className="w-full" />
          <Slider label="Gutter" min={0.01} max={0.05} step={0.002} value={gutter} onChange={setGutter} className="w-full" />
          <Slider label="Margin" min={0.02} max={0.12} step={0.005} value={margin} onChange={setMargin} className="w-full" />
        </Section>

        <Section label="Content">
          <Input size="sm" width="100%" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Headline" />
          <Textarea rows={4} size="sm" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Body text" />
        </Section>

        <Section label="Images">
          <Button variant="outline" size="sm" className="w-full" iconLeft="upload" onClick={() => fileRef.current?.click()}>
            Upload Images
          </Button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addImages([...e.target.files]); e.target.value = '' }} />
          {images.length > 0 && (
            <ul className="flex flex-col gap-1">
              {images.map((im, i) => (
                <li key={`${im.name}-${i}`} className="flex items-center gap-2 kol-helper-10">
                  <span className="truncate text-body">{im.name}</span>
                  <span className="text-meta">{im.w}×{im.h}</span>
                  <button type="button" className="ml-auto text-meta hover:text-emphasis" onClick={() => removeImage(i)}>x</button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Divider />

        <Button variant="outline" size="sm" className="w-full" onClick={exportSvg}>Export SVG</Button>
        <Button variant="primary" size="sm" className="w-full" iconLeft="download" onClick={exportPng}>Export PNG</Button>

        <div className="kol-helper-10 text-body flex flex-col gap-1">
          <div>← / →</div>
          <div>G grid</div>
          <div>R randomize</div>
        </div>
      </EditorRail>
    </div>
  )
}
