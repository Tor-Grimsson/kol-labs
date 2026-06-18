import { useRef, useState } from 'react'
import Section from '../molecules/Section.jsx'
import LabeledControl from '../molecules/LabeledControl.jsx'
import Dropdown from '../molecules/Dropdown.jsx'
import ToggleSwitch from '../atoms/ToggleSwitch.jsx'
import Button from '../atoms/Button.jsx'
import Input from '../atoms/Input.jsx'
import { THEME_OPTIONS } from '../../lib/themes.js'
import { downloadSettings, readSettingsFile } from '../../lib/settingsIO.js'

/**
 * Shared rail block: theme picker + invert, optional Randomise (+ editable seed),
 * and settings Export/Import as a .json file. Mirrors the ExportPanel pattern —
 * pages pass callbacks and a get/apply pair; the panel owns the file plumbing.
 *
 * @param {Object} props
 * @param {string}   props.page            - page id (envelope tag + filename)
 * @param {string}   props.theme           - active theme id
 * @param {Function} props.onTheme         - (id) => void
 * @param {boolean}  props.invert          - invert flag
 * @param {Function} props.onInvert        - (bool) => void
 * @param {Function} [props.onRandomize]   - show Randomise when provided
 * @param {number}   [props.seed]          - show an editable seed when provided
 * @param {Function} [props.onSeed]        - (n) => void
 * @param {Function} props.getSettings     - () => JSON-safe settings snapshot
 * @param {Function} props.applySettings   - (settings) => void (restore on import)
 * @param {boolean}  [props.showTheme=true]
 * @param {Array}    [props.themeOptions]  - override the theme list
 * @param {string}   [props.label='Settings']
 */
export default function SettingsPanel({
  page,
  theme,
  onTheme,
  invert = false,
  onInvert,
  onRandomize,
  seed,
  onSeed,
  getSettings,
  applySettings,
  showTheme = true,
  themeOptions = THEME_OPTIONS,
  label = 'Settings',
}) {
  const fileRef = useRef(null)
  const [err, setErr] = useState('')

  const doExport = () => {
    try { downloadSettings(page, getSettings?.() ?? {}, `${page}.json`) }
    catch (e) { setErr(e.message || 'Export failed') }
  }

  const onFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-importing the same file
    if (!file) return
    readSettingsFile(file, page)
      .then((s) => { setErr(''); applySettings?.(s) })
      .catch((ex) => setErr(ex.message || 'Import failed'))
  }

  return (
    <Section label={label}>
      {showTheme && (
        <>
          <LabeledControl inline label="Theme">
            <Dropdown size="sm" variant="subtle" className="w-full" options={themeOptions} value={theme} onChange={onTheme} />
          </LabeledControl>
          <ToggleSwitch variant="plain" label="Invert" checked={invert} onChange={onInvert} />
        </>
      )}

      {onRandomize && (
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" iconLeft="refresh" onClick={onRandomize} className="flex-1">Randomise</Button>
          {onSeed && (
            <Input
              size="sm"
              chars={9}
              value={String(seed ?? '')}
              onChange={(e) => { const n = parseInt(e.target.value, 10); if (Number.isFinite(n)) onSeed(n) }}
              inputClassName="text-center"
              title="seed"
            />
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" iconLeft="download" onClick={doExport} className="flex-1">Export</Button>
        <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} className="flex-1">Import</Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
      </div>

      {err && <div className="kol-helper-10 text-red-500">{err}</div>}
    </Section>
  )
}
