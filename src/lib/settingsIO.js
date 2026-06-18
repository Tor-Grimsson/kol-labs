// settingsIO — export/import a page's settings as a versioned .json file.
//
// Envelope: { app: 'kol-labs', page: '<id>', version: 1, settings: {...} }
// The `page` id lets import reject a file saved from a different page.
//
// Pure helpers (makeEnvelope/parseEnvelope) are separated from the DOM ones
// (downloadSettings/readSettingsFile) so the format is unit-testable in node.

export const APP_ID = 'kol-labs'
export const SETTINGS_VERSION = 1

/** Wrap a settings object in the versioned envelope. */
export function makeEnvelope(page, settings) {
  return { app: APP_ID, page, version: SETTINGS_VERSION, settings }
}

/**
 * Parse + validate an envelope (string or object). Returns the inner settings.
 * Throws with a clear message if it's not a kol-labs file or the page mismatches
 * (pass `expectPage` to enforce; omit to accept any page).
 */
export function parseEnvelope(input, expectPage) {
  const env = typeof input === 'string' ? JSON.parse(input) : input
  if (!env || env.app !== APP_ID) throw new Error('Not a KOL settings file')
  if (expectPage && env.page !== expectPage) {
    throw new Error(`This file is for "${env.page}", not "${expectPage}"`)
  }
  if (!env.settings || typeof env.settings !== 'object') throw new Error('No settings in file')
  return env.settings
}

/** Trigger a browser download of the settings as `<page>.json`. */
export function downloadSettings(page, settings, filename) {
  const env = makeEnvelope(page, settings)
  const blob = new Blob([JSON.stringify(env, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `${page}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Read + validate a File (from an <input type=file>). Resolves the settings. */
export function readSettingsFile(file, expectPage) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.onload = () => {
      try { resolve(parseEnvelope(String(reader.result), expectPage)) }
      catch (e) { reject(e) }
    }
    reader.readAsText(file)
  })
}
