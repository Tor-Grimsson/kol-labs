import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Button from '../../components/atoms/Button.jsx'
import Input from '../../components/atoms/Input.jsx'
import Slider from '../../components/atoms/Slider.jsx'
import Textarea from '../../components/atoms/Textarea.jsx'
import Tag from '../../components/molecules/Tag.jsx'
import Divider from '../../components/atoms/Divider.jsx'
import Section from '../../components/molecules/Section.jsx'
import EditorRail, { RailHeader } from '../../components/framework/EditorRail.jsx'
import { PRESETS, SCALES } from './data/presets.js'
import { cropFor, fits } from './lib/cropMath.js'

const api = {
  assets: () => fetch('/api/poster/assets').then((r) => r.json()),
  upload: (file) => fetch(`/api/poster/upload?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file }).then((r) => r.json()),
  convert: (payload) => fetch('/api/poster/convert', { method: 'POST', body: JSON.stringify(payload) }).then((r) => r.json()),
  jobs: () => fetch('/api/poster/jobs').then((r) => r.json()),
  thumbnail: (sourceId, time) => fetch('/api/poster/thumbnail', { method: 'POST', body: JSON.stringify({ sourceId, time }) }).then((r) => r.json()),
  plans: () => fetch('/api/poster/plans').then((r) => r.json()),
  savePlan: (plan) => fetch('/api/poster/plans', { method: 'POST', body: JSON.stringify(plan) }).then((r) => r.json()),
  deletePlan: (id) => fetch(`/api/poster/plans/${id}`, { method: 'DELETE' }).then((r) => r.json()),
}

const srcUrl = (s) => `/workspace/sources/${s}`
const outUrl = (f) => `/workspace/outputs/${f}`
const thumbUrl = (f) => `/workspace/thumbs/${f}`

export default function PosterPage() {
  const [sources, setSources] = useState([])
  const [selected, setSelected] = useState(null) // source object
  const [focal, setFocal] = useState({ x: 0.5, y: 0.5 })
  const [picked, setPicked] = useState({}) // presetId -> scale set, e.g. {'ig-square': [1,2]}
  const [jobs, setJobs] = useState([])
  const [scrub, setScrub] = useState(0)
  const [thumbs, setThumbs] = useState([])
  const [plan, setPlan] = useState({ title: '', caption: '', tags: [], assets: [], thumb: null })
  const [tagDraft, setTagDraft] = useState('')
  const [plans, setPlans] = useState([])
  const [copied, setCopied] = useState(null)
  const fileRef = useRef(null)
  const previewRef = useRef(null)

  const refresh = useCallback(() => { api.assets().then(setSources); api.plans().then(setPlans) }, [])
  useEffect(() => { refresh() }, [refresh])

  const activeJobs = jobs.some((j) => j.status === 'queued' || j.status === 'running')

  // poll only while jobs are active; interval stops automatically when all finish
  useEffect(() => {
    if (!activeJobs) return
    const t = setInterval(() => api.jobs().then(setJobs), 1500)
    return () => clearInterval(t)
  }, [activeJobs])

  const onUpload = async (files) => {
    for (const f of files) await api.upload(f)
    refresh()
  }

  const onPickFocal = (e) => {
    const rect = previewRef.current.getBoundingClientRect()
    setFocal({
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    })
  }

  const togglePick = (presetId, scale) => {
    setPicked((p) => {
      const cur = new Set(p[presetId] || [])
      cur.has(scale) ? cur.delete(scale) : cur.add(scale)
      return { ...p, [presetId]: [...cur] }
    })
  }

  const enqueueAll = async () => {
    if (!selected) return
    for (const preset of PRESETS) {
      for (const scale of picked[preset.id] || []) {
        const out = { w: preset.w * scale, h: preset.h * scale }
        const crop = cropFor(selected.width, selected.height, out.w, out.h, focal.x, focal.y)
        await api.convert({
          sourceId: selected.id,
          label: `${preset.id}-${scale}x`,
          crop, out,
          format: 'jpg',
        })
      }
    }
    setPicked({})
    api.jobs().then(setJobs)
  }

  const grabThumb = async () => {
    const { thumb } = await api.thumbnail(selected.id, scrub)
    setThumbs((t) => [...t, thumb])
  }

  const doneOutputs = useMemo(() => jobs.filter((j) => j.status === 'done').map((j) => j.output), [jobs])

  // True when at least one preset×scale can be produced without upscaling —
  // when false the whole pick matrix is disabled and needs a visible notice
  // (the per-button gating is otherwise hover-tooltip-only).
  const anyFit = useMemo(
    () => !!selected && PRESETS.some((p) => SCALES.some((s) => fits(selected.width, selected.height, p.w * s, p.h * s))),
    [selected],
  )

  const toggleAsset = (f) => setPlan((p) => ({
    ...p,
    assets: p.assets.includes(f) ? p.assets.filter((a) => a !== f) : [...p.assets, f],
  }))

  const addTag = () => {
    const t = tagDraft.trim().replace(/^#/, '')
    if (t) setPlan((p) => ({ ...p, tags: [...new Set([...p.tags, t])] }))
    setTagDraft('')
  }

  const copy = async (key, text) => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1200)
  }

  const save = async () => {
    const saved = await api.savePlan({ ...plan, source: selected?.id ?? plan.source })
    setPlan(saved)
    api.plans().then(setPlans)
    return saved
  }

  // Save first so the download matches what's on screen, then pull the file.
  const download = async (kind) => {
    const saved = await save()
    const a = document.createElement('a')
    a.href = `/api/poster/plans/${saved.id}/${kind}` // 'doc' (md) | 'images' (zip)
    a.click()
  }

  const loadPlan = (p) => {
    setPlan(p)
    const src = sources.find((s) => s.id === p.source)
    if (src) setSelected(src)
  }

  const deletePlan = async (id) => {
    await api.deletePlan(id)
    api.plans().then(setPlans)
    // deleting the plan currently in the editor resets it to a fresh one
    if (plan.id === id) setPlan({ title: '', caption: '', tags: [], assets: [], thumb: null })
  }

  /* preview crop overlay for the first picked preset (visual aid) */
  const previewCrop = useMemo(() => {
    if (!selected) return null
    const firstPicked = PRESETS.find((pr) => (picked[pr.id] || []).length)
    if (!firstPicked) return null
    const c = cropFor(selected.width, selected.height, firstPicked.w, firstPicked.h, focal.x, focal.y)
    return {
      left: `${(c.x / selected.width) * 100}%`,
      top: `${(c.y / selected.height) * 100}%`,
      width: `${(c.w / selected.width) * 100}%`,
      height: `${(c.h / selected.height) * 100}%`,
      label: firstPicked.label,
    }
  }, [selected, picked, focal])

  return (
    <div className="min-h-dvh bg-surface-primary text-emphasis flex">
      {/* ── workbench ── */}
      <main className="flex-1 p-6 flex flex-col gap-6 min-w-0 bg-surface-secondary">
          {selected && (
            <>
              {/* focal picker */}
              <section>
                <div className="kol-mono-10 text-meta mb-2">Framing — click to set the focal point{previewCrop ? ` · showing ${previewCrop.label} crop` : ''}</div>
                <div ref={previewRef} data-vcap="stage" className="relative inline-block max-w-full cursor-crosshair select-none" onClick={onPickFocal}>
                  {selected.isVideo
                    ? <video src={srcUrl(selected.id)} className="max-h-[340px] max-w-full block rounded" muted playsInline />
                    : <img src={srcUrl(selected.id)} className="max-h-[340px] max-w-full block rounded" alt="" />}
                  {previewCrop && (
                    <div className="absolute border-2 border-[var(--kol-accent-primary)] pointer-events-none" style={previewCrop} />
                  )}
                  <div
                    className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white mix-blend-difference pointer-events-none"
                    style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }}
                  />
                </div>
              </section>

              {/* preset matrix */}
              <section>
                <div className="kol-helper-10 text-meta mb-2">Outputs</div>
                {!anyFit && (
                  <div className="kol-mono-10 text-meta mb-2">
                    source is {selected.width}×{selected.height} — too small for every output size · upload a larger master
                  </div>
                )}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2">
                  {PRESETS.map((p) => (
                    <div key={p.id} className="border border-fg-08 rounded p-3 flex flex-col gap-2 bg-surface-secondary">
                      <div className="flex items-center gap-2">
                        <div className="border border-fg-24" style={{ width: 28, height: Math.max(10, Math.min(28, 28 * (p.h / p.w))) }} />
                        <div className="min-w-0">
                          <div className="kol-helper-10 truncate">{p.platform} · {p.label}</div>
                          <div className="kol-helper-10 text-meta">{p.ratio} · {p.w}×{p.h}</div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {SCALES.map((s) => {
                          const ok = fits(selected.width, selected.height, p.w * s, p.h * s)
                          const on = (picked[p.id] || []).includes(s)
                          return (
                            <button
                              key={s} type="button" disabled={!ok}
                              onClick={() => togglePick(p.id, s)}
                              className={`px-2 py-0.5 rounded kol-helper-10 border transition-colors ${on ? 'bg-fg-16 border-fg-48 text-emphasis' : 'border-fg-08 text-meta hover:text-emphasis'} disabled:opacity-30 disabled:cursor-not-allowed`}
                              title={ok ? '' : 'source too small'}
                            >{s}x</button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <Button variant="primary" size="sm" onClick={enqueueAll} disabled={!Object.values(picked).some((v) => v.length)}>
                    Convert selected
                  </Button>
                </div>
              </section>

              {/* video thumbnails */}
              {selected.isVideo && (
                <section>
                  <div className="kol-helper-10 text-meta mb-2">Thumbnail — scrub + grab</div>
                  <div className="flex items-center gap-3 max-w-[520px]">
                    <div className="flex-1">
                      <Slider labeled min={0} max={Math.max(0.1, selected.duration - 0.05)} step={0.1} value={scrub} onChange={setScrub} label="time" />
                    </div>
                    <span className="kol-helper-10 text-meta w-12">{scrub.toFixed(1)}s</span>
                    <Button variant="primary" size="sm" onClick={grabThumb}>Grab frame</Button>
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {thumbs.map((t) => (
                      <button key={t} type="button" onClick={() => setPlan((p) => ({ ...p, thumb: t }))} className={`border-2 rounded overflow-hidden ${plan.thumb === t ? 'border-[var(--kol-accent-primary)]' : 'border-transparent'}`}>
                        <img src={thumbUrl(t)} className="h-20 block" alt="" />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* job queue + outputs */}
              <section>
                <div className="kol-mono-10 text-meta mb-2">Queue & outputs — click an output to add it to the plan</div>
                <ul className="flex flex-col gap-1 max-w-[640px]">
                  {jobs.map((j) => (
                    <li key={j.id} className="flex items-center gap-3 kol-helper-10">
                      <span className="w-40 truncate">{j.label}</span>
                      {j.status === 'done' ? (
                        <button type="button" onClick={() => toggleAsset(j.output)} className={`flex items-center gap-2 px-2 py-0.5 rounded border transition-colors ${plan.assets.includes(j.output) ? 'border-fg-48 bg-fg-08 text-emphasis' : 'border-fg-08 text-body hover:text-emphasis'}`}>
                          {/\.(jpg|png)$/.test(j.output) && <img src={outUrl(j.output)} className="h-8 rounded-sm" alt="" />}
                          <span className="truncate max-w-[260px]">{j.output}</span>
                          {plan.assets.includes(j.output) && <span className="text-meta">in plan</span>}
                        </button>
                      ) : j.status === 'error' ? (
                        <span className="text-meta" title={j.error}>failed</span>
                      ) : (
                        <span className="flex-1 max-w-[200px] h-1.5 bg-fg-08 rounded overflow-hidden"><span className="block h-full bg-fg-48 transition-all" style={{ width: `${j.progress}%` }} /></span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </main>

        {/* ── the rail: sources/plans library + plan editor ── */}
        <EditorRail>
          <RailHeader>Poster</RailHeader>

          <Section label="Sources">
            <Button variant="primary" size="sm" iconLeft="upload" className="w-full" onClick={() => fileRef.current?.click()}>Upload image / video</Button>
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => onUpload([...e.target.files])} />
            <ul className="flex flex-col gap-1">
              {sources.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => { setSelected(s); setThumbs([]); setFocal({ x: 0.5, y: 0.5 }) }}
                    className={`w-full text-left px-2 py-1 rounded kol-helper-10 truncate transition-colors text-emphasis ${selected?.id === s.id ? 'bg-fg-12' : 'hover:bg-fg-04'}`}
                  >
                    {s.name.replace(/^[a-z0-9]+-/, '')} <span className="text-meta">{s.width}×{s.height}{s.isVideo ? ` · ${Math.round(s.duration)}s` : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>

          <Section label="Plans">
            <ul className="flex flex-col gap-1">
              {plans.map((p) => (
                <li key={p.id} className="flex items-center gap-1">
                  <button type="button" onClick={() => loadPlan(p)} className={`flex-1 min-w-0 text-left px-2 py-1 rounded kol-helper-10 truncate transition-colors text-emphasis ${plan.id === p.id ? 'bg-fg-12' : 'hover:bg-fg-04'}`}>
                    {p.title || '(Untitled)'} <span className="text-meta">· {p.assets.length} assets</span>
                  </button>
                  <Button variant="ghost" size="sm" quiet iconOnly="cross" iconSize={12} className="shrink-0" aria-label="Delete plan" onClick={() => deletePlan(p.id)} />
                </li>
              ))}
            </ul>
          </Section>

          <Divider />

          <Section label="The post">
          <Input value={plan.title} onChange={(e) => setPlan((p) => ({ ...p, title: e.target.value }))} placeholder="Working title" />
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="kol-helper-10 text-meta">Caption</span>
              <button type="button" onClick={() => copy('caption', plan.caption)} className="kol-helper-10 text-meta hover:text-emphasis">{copied === 'caption' ? 'Copied ✓' : 'Copy'}</button>
            </div>
            <Textarea rows={6} value={plan.caption} onChange={(e) => setPlan((p) => ({ ...p, caption: e.target.value }))} placeholder="Write the caption here…" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="kol-helper-10 text-meta">Tags</span>
              <button type="button" onClick={() => copy('tags', plan.tags.map((t) => `#${t}`).join(' '))} className="kol-helper-10 text-meta hover:text-emphasis">{copied === 'tags' ? 'Copied ✓' : 'Copy all'}</button>
            </div>
            <div className="flex gap-1">
              <Input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder="Add tag + enter" onKeyDown={(e) => e.key === 'Enter' && addTag()} />
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {plan.tags.map((t) => (
                <Tag key={t} onRemove={() => setPlan((p) => ({ ...p, tags: p.tags.filter((x) => x !== t) }))}>#{t}</Tag>
              ))}
            </div>
          </div>
          </Section>
          <div className="flex-1 min-h-0">
            <div className="kol-helper-10 text-meta mb-1">Asset set ({plan.assets.length})</div>
            <div className="grid grid-cols-3 gap-1">
              {plan.assets.map((f) => (
                <button key={f} type="button" onClick={() => toggleAsset(f)} title={f} className="relative group">
                  {/\.(jpg|png)$/.test(f)
                    ? <img src={outUrl(f)} className="w-full aspect-square object-cover rounded" alt="" />
                    : <video src={outUrl(f)} className="w-full aspect-square object-cover rounded" muted />}
                  <span className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-surface-primary/60 kol-helper-10">Remove</span>
                </button>
              ))}
            </div>
            {plan.thumb && (
              <div className="mt-2">
                <div className="kol-helper-10 text-meta mb-1">Cover</div>
                <img src={thumbUrl(plan.thumb)} className="h-16 rounded" alt="" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <Button variant="primary" size="sm" onClick={() => download('doc')} iconLeft="download" className="w-full">Download plan md</Button>
              <Button variant="primary" size="sm" onClick={() => download('images')} iconLeft="download" className="w-full">Download images</Button>
            </div>
            <Button variant="primary" size="sm" onClick={save} className="w-full">Save plan</Button>
          </div>
        </EditorRail>
    </div>
  )
}
