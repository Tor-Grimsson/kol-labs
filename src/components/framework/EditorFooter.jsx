import { useRef, useState } from 'react'
import RailFooterTabs from './RailFooterTabs.jsx'
import TransportBar from './TransportBar.jsx'
import ExportPanel from '../../pages/_shared/ExportPanel.jsx'
import Button from '../atoms/Button.jsx'
import ButtonGroup from '../molecules/ButtonGroup.jsx'
import { downloadSettings, readSettingsFile } from '../../lib/settingsIO.js'

/**
 * EditorFooter — THE standard rail footer, used by every editor page so the
 * three tabs are byte-identical everywhere (no per-page copy to drift).
 *
 *   Transport · Output · File
 *     Transport — the playback TransportBar (props passed via `transport`)
 *     Output    — the /export-specs cluster (ExportPanel) + page export actions
 *     File      — whole-page settings save/load (.json envelope) by default,
 *                 or a custom node via `file` (source-in pages: upload/library)
 *
 * Drop it into EditorRail's `footer` with `footerBare` so the rail doesn't add a
 * second divider/padding (RailFooterTabs owns the divider + 16/20/24/20 padding):
 *
 *   <EditorRail
 *     footerBare
 *     footer={
 *       <EditorFooter
 *         tab={footTab} onTab={setFootTab}
 *         transport={{ playing, onPlay, onPause, onStop, onRewind, tempo, onTempo, tempoMax }}
 *         exportProps={{ aspect, onAspect, aspects: VIEW_ASPECTS, scale, onScale }}
 *         exportActions={<Button … onClick={exportPng}>Export PNG</Button>}
 *         settingsPage="math-attractor" getSettings={getSettings} applySettings={applySettings}
 *       />
 *     }
 *   >
 *
 * Tab state is optional — omit `tab`/`onTab` and the footer self-manages it.
 */
const TABS = [
  { value: 'transport', label: 'Transport' },
  { value: 'output', label: 'Output' },
  { value: 'file', label: 'File' },
]

// Default File panel — save/load the whole page's settings as a versioned .json
// (the settingsIO envelope). `page` scopes the file so import rejects a foreign one.
function SettingsFile({ page, getSettings, applySettings }) {
  const fileRef = useRef(null)
  const [err, setErr] = useState('')
  const save = () => {
    try { downloadSettings(page, getSettings(), `${page}.json`) }
    catch (e) { setErr(e.message || 'Export failed') }
  }
  const load = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-importing the same file
    if (!file) return
    readSettingsFile(file, page)
      .then((s) => { setErr(''); applySettings(s) })
      .catch((ex) => setErr(ex.message || 'Import failed'))
  }
  return (
    <>
      <ButtonGroup orientation="vertical" className="w-full">
        <Button variant="primary" size="sm" iconLeft="download" onClick={save} className="w-full">Save settings</Button>
        <Button variant="primary" size="sm" iconLeft="upload" onClick={() => fileRef.current?.click()} className="w-full">Load settings</Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={load} />
      </ButtonGroup>
      {err && <div className="kol-helper-10 text-red-500">{err}</div>}
    </>
  )
}

export default function EditorFooter({
  tab, onTab,
  transport, transportExtras,
  exportProps, exportActions, output,
  file,
  settingsPage, getSettings, applySettings,
}) {
  const [internal, setInternal] = useState('transport')
  const active = tab ?? internal
  const setActive = onTab ?? setInternal

  // Output defaults to the /export-specs ExportPanel; `output` overrides it for
  // pages whose export doesn't fit the aspect×scale model (canvas-res capture, etc).
  const outputContent = output ?? <ExportPanel {...exportProps}>{exportActions}</ExportPanel>

  const fileContent = file
    ?? (settingsPage
      ? <SettingsFile page={settingsPage} getSettings={getSettings} applySettings={applySettings} />
      : null)

  return (
    <RailFooterTabs value={active} onChange={setActive} tabs={TABS}>
      {/* Transport stays mounted (hidden) so playback chrome never re-inits on tab switch.
          transportExtras renders under the bar (e.g. audio controls). */}
      <div className={active === 'transport' ? undefined : 'hidden'}>
        <TransportBar {...transport} />
        {transportExtras}
      </div>
      {active === 'output' && outputContent}
      {active === 'file' && fileContent}
    </RailFooterTabs>
  )
}
