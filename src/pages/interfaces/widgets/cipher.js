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
const LEET = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7', l: '1', g: '9', b: '8' }
const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..',
  J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
  S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
}

export const CIPHER_MODES = ['hex', 'binary', 'base64', 'morse', 'katakana', 'rot13', 'leet']

export function encode(text, mode) {
  const t = String(text ?? '')
  switch (mode) {
    case 'binary': return [...t].map((c) => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ')
    case 'hex': return [...t].map((c) => c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')).join(' ')
    case 'base64': try { return btoa(unescape(encodeURIComponent(t))) } catch { return '' }
    case 'morse': return t.toUpperCase().split('').map((c) => (c === ' ' ? '/' : (MORSE[c] ?? c))).join(' ')
    case 'rot13': return t.replace(/[a-z]/gi, (c) => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode(((c.charCodeAt(0) - b + 13) % 26) + b) })
    case 'katakana': return t.toLowerCase().split('').map((c) => KATA[c] ?? c).join('')
    case 'leet': return t.toLowerCase().split('').map((c) => LEET[c] ?? c).join('')
    default: return t
  }
}

export function cipher(opts) {
  const node = document.createElement('div')
  node.className = 'cipher'
  node.style.fontSize = `${opts.fontSize ?? 11}px`
  node.textContent = encode(opts.text ?? 'KOLKRABBI', opts.mode ?? 'hex')
  opts.host.appendChild(node)
}
