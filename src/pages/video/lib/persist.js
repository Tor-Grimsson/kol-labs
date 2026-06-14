/**
 * Reload-survival for the video tool. The clip File goes in IndexedDB (the only
 * web store that holds binary — localStorage is text-only and the blob URL is
 * void after reload); the lightweight edit state goes in localStorage. On load
 * both are rehydrated, so an accidental refresh restores the session.
 * All calls degrade silently when storage is unavailable (private mode, quota).
 */
const DB = 'kol-video'
const STORE = 'clip'
const KEY = 'current'
const STATE_KEY = 'kol-video:state'

const open = () =>
  new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })

export async function saveClip(file) {
  try {
    const db = await open()
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(file, KEY)
      tx.oncomplete = res
      tx.onerror = () => rej(tx.error)
    })
  } catch { /* persistence unavailable */ }
}

export async function loadClip() {
  try {
    const db = await open()
    return await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly')
      const rq = tx.objectStore(STORE).get(KEY)
      rq.onsuccess = () => res(rq.result || null)
      rq.onerror = () => rej(rq.error)
    })
  } catch { return null }
}

export async function clearClip() {
  try {
    const db = await open()
    await new Promise((res) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(KEY)
      tx.oncomplete = res
    })
  } catch { /* */ }
}

export const saveState = (s) => { try { localStorage.setItem(STATE_KEY, JSON.stringify(s)) } catch { /* */ } }
export const loadState = () => { try { return JSON.parse(localStorage.getItem(STATE_KEY) || 'null') } catch { return null } }
export const clearState = () => { try { localStorage.removeItem(STATE_KEY) } catch { /* */ } }
