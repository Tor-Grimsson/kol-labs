/**
 * Character pools for text-stream elements (codeScroll), echoing radar's ascii
 * charsets. Widgets pick random glyphs from the pool; 'custom' uses a
 * user-supplied string. These keys drive the registry's `mode` enum, so adding
 * one here surfaces it in the Library + inspector automatically.
 */
export const CHARSETS = {
  alphanum: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  hex: '0123456789ABCDEF',
  binary: '01',
  dna: 'ACGT',
  katakana: 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜ',
  blocks: '░▒▓█',
  shades: '.:-=+*#%@',
  strokes: '─│┌┐└┘├┤┬┴┼╱╲╳',
}

export const CHARSET_KEYS = Object.keys(CHARSETS)

/* Resolve the glyph pool for a mode; 'custom' falls back to the supplied string. */
export const poolFor = (mode, custom) =>
  mode === 'custom' ? (custom && custom.length ? custom : '··') : (CHARSETS[mode] || CHARSETS.alphanum)
