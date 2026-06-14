/**
 * Cipher — encodes English text into a chosen charset/scheme, the way radar's
 * ASCII tab offers Classic/Hex/Binary/Katakana/… A DOM text element (no p5):
 * deterministic, static, themed via --fg.
 */
const KATA = {
  a: 'ア', b: 'バ', c: 'カ', d: 'ダ', e: 'エ', f: 'フ', g: 'ガ', h: 'ハ', i: 'イ', j: 'ジ',
  k: 'カ', l: 'ラ', m: 'マ', n: 'ン', o: 'オ', p: 'パ', q: 'ク', r: 'ラ', s: 'サ', t: 'タ',
  u: 'ウ', v: 'ヴ', w: 'ワ', x: 'クス', y: 'ヤ', z: 'ザ',
}
// Every glyph in the kana repertoire — the fallback so digits, %, :, ., ! and
// any other character ALSO map into the charset instead of leaking through.
const KANA_POOL = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポ'.split('')
const leetTable = { a: '4', b: '8', c: '<', d: 'ð', e: '3', f: 'ƒ', g: '9', h: '#', i: '1', j: 'ʝ', k: 'κ', l: '1', m: 'м', n: 'и', o: '0', p: 'þ', q: 'ʠ', r: 'я', s: '5', t: '7', u: 'µ', v: 'ʌ', w: 'ω', x: '×', y: 'γ', z: '2', 0: 'Ø', 1: '|', 2: 'ƻ', 3: 'ε', 4: 'Ч', 5: '§', 6: 'б', 7: '⁷', 8: 'ß', 9: '९' }
const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..',
  J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
  S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', ':': '---...', ';': '-.-.-.', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.',
  '(': '-.--.', ')': '-.--.-', '&': '.-...', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.', '@': '.--.-.', '%': '----.-', '#': '...-.-',
}

// Preserve layout whitespace; everything else gets encoded.
const isWhite = (c) => c === ' ' || c === '\n' || c === '\t'

export const CIPHER_MODES = ['hex', 'binary', 'base64', 'morse', 'katakana', 'rot13', 'leet']

// Shared "current" mode so live updaters (interval-driven hex strip / dual
// numbers) encode every re-roll, not just the one-shot encodeDom pass.
let _live = 'off'
export function setLiveEncode(mode) { _live = mode || 'off' }
export function liveEncode(text) { return encode(text, _live) }

export function encode(text, mode) {
  const t = String(text ?? '')
  switch (mode) {
    case 'binary': return [...t].map((c) => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ')
    case 'hex': return [...t].map((c) => c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')).join(' ')
    case 'base64': try { return btoa(unescape(encodeURIComponent(t))) } catch { return '' }
    case 'morse': return [...t].map((c) => (isWhite(c) ? '/' : (MORSE[c.toUpperCase()] ?? MORSE['#']))).join(' ')
    case 'rot13': return [...t].map((c) => {
      if (/[a-z]/i.test(c)) { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode(((c.charCodeAt(0) - b + 13) % 26) + b) }
      if (/[0-9]/.test(c)) return String((Number(c) + 5) % 10) // rot5 for digits
      return c
    }).join('')
    // every character → kana: letters mapped, everything else (digits, %, :, ., !)
    // falls into the kana pool so NOTHING leaks through as plain ASCII
    case 'katakana': return [...t].map((c) => (isWhite(c) ? c : (KATA[c.toLowerCase()] ?? KANA_POOL[c.charCodeAt(0) % KANA_POOL.length]))).join('')
    // leet covers a–z AND 0–9; unmapped symbols stay (it's the readable scheme)
    case 'leet': return [...t].map((c) => (isWhite(c) ? c : (leetTable[c.toLowerCase()] ?? c))).join('')
    default: return t
  }
}

/**
 * Encode every readable text node under `root` in place, so a whole rendered
 * screen looks encoded (not just one cipher block). mode 'off' / falsy is a
 * no-op. Skips already-cryptic subtrees (.cipher, .numeric-strip).
 */
export function encodeDom(root, mode) {
  if (!root || !mode || mode === 'off') return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT
      if (n.parentElement?.closest('.cipher, .numeric-strip, .dualnum')) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  for (const n of nodes) n.nodeValue = encode(n.nodeValue, mode)
}

export function cipher(opts) {
  const node = document.createElement('div')
  node.className = 'cipher'
  node.style.fontSize = `${opts.fontSize ?? 11}px`
  node.textContent = encode(opts.text ?? 'KOLKRABBI', opts.mode ?? 'hex')
  opts.host.appendChild(node)
}
