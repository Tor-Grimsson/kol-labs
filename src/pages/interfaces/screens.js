
import { hero, sequencer, eqBars, knob, tape, matrix, vu, helix, reel, hBars, sevenSeg, bitmap, codeScroll, creature3d } from './widgets'










function el(tag        , cls         , text         )              {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

const HEX = '0123456789ABCDEF'
function hex(n        )         {
  let s = ''
  for (let i = 0; i < n; i++) s += HEX[(Math.random() * 16) | 0]
  return s
}

function numericStrip(host             , groups        , perGroup        ) {
  const strip = el('div', 'numeric-strip')
  const paint = () => {
    const rows           = []
    for (let g = 0; g < groups; g++) {
      const parts           = []
      for (let i = 0; i < perGroup; i++) parts.push(hex(4))
      rows.push(parts.join(' '))
    }
    strip.textContent = rows.join('  ')
  }
  paint()
  const id = setInterval(paint, 140)
  ;(strip                                           )._cleanup = () => clearInterval(id)
  host.appendChild(strip)
}

function statusbar(host             , right = '··· ⟐ 100%') {
  const s = el('div', 'statusbar')
  s.innerHTML = `<span class="js-clock">9:41</span><span>${right}</span>`
  host.appendChild(s)
}

function label(host             , left        , right         ) {
  const l = el('div', 'section-label')
  l.innerHTML = `<span>${left}</span>${right ? `<span>${right}</span>` : ''}`
  host.appendChild(l)
}

function readouts(host             , items                         ) {
  const r = el('div', 'numeric-block')
  for (const [k, v] of items) {
    const row = el('div', 'r')
    row.innerHTML = `<span class="k">${k}</span><span class="v">${v}</span>`
    r.appendChild(row)
  }
  host.appendChild(r)
}

function transport(host             , label_        , active        ) {
  const t = el('div', 'transport')
  const btns = ['◀◀', '▶', '■', '●']
  t.innerHTML =
    `<span class="label">${label_}</span>` +
    `<span class="btns">${btns
      .map((b) => `<span class="${b === active ? 'active' : ''}">${b}</span>`)
      .join('')}</span>`
  host.appendChild(t)
}

function widgetHost(cls = '')              {
  return el('div', `widget ${cls}`.trim())
}

// ---------- SCREENS ----------

const S01_OSC         = {
  id: '01',
  title: 'OSC-A SYNTH',
  subtitle: 'OUTPUT · OSC-A · STBL 128BPM',
  build(s) {
    const out       = []
    statusbar(s)
    label(s, 'OUTPUT · OSC-A', 'LIVE')
    const hHost = widgetHost('naked'); s.appendChild(hHost)
    out.push(hero({ host: hHost, w: 160, h: 68 }))
    const tp = widgetHost('naked'); s.appendChild(tp)
    out.push(tape({ host: tp, w: 160, h: 8, bpm: 128 }))
    label(s, 'SEQUENCE · 16/4', 'SHUFFLE 12')
    const sq = widgetHost('naked'); s.appendChild(sq)
    out.push(sequencer({ host: sq, cols: 16, rows: 4, cellW: 8, cellH: 5, bpm: 128, seed: 13 }))
    label(s, 'SPECTRUM · MATRIX', 'FFT 512')
    const row = el('div', 'row'); s.appendChild(row)
    const eq = widgetHost(); eq.style.flex = '1'; row.appendChild(eq)
    out.push(eqBars({ host: eq, bars: 22, barW: 3, gap: 1, h: 30, seed: 4 }))
    const mx = widgetHost(); mx.style.width = '68px'; row.appendChild(mx)
    out.push(matrix({ host: mx, cols: 8, rows: 7, cell: 4, seed: 23, speed: 1.2 }))
    const vus = el('div', 'row'); s.appendChild(vus)
    const vL = widgetHost(); vus.appendChild(vL); out.push(vu({ host: vL, w: 80, h: 5, segs: 20, seed: 1 }))
    const vR = widgetHost(); vus.appendChild(vR); out.push(vu({ host: vR, w: 80, h: 5, segs: 20, seed: 2 }))
    readouts(s, [['FRQ','440.00 HZ'],['Q','0.71'],['CUT','0.42'],['GAIN','0.84'],['LFO','0.18'],['RATE','2.7 HZ']])
    numericStrip(s, 1, 12)
    label(s, 'FILTER · ADSR', 'BANK 03')
    const kn = el('div', 'grid-knobs'); s.appendChild(kn)
    const names = ['CUT','RES','ENV','LFO','MIX']
    for (let i = 0; i < 5; i++) {
      const c = el('div', 'knob-cell')
      const w = widgetHost(); c.appendChild(w)
      c.appendChild(el('div','lbl', names[i]))
      kn.appendChild(c)
      out.push(knob({ host: w, size: 30, seed: i*1.37, lfoHz: 0.08 + i*0.04 }))
    }
    transport(s, 'STEREO · 24BIT · 48K', '▶')
    return out
  },
}

const S02_DIAG         = {
  id: '02',
  title: 'SYN / DIAGNOSTIC',
  subtitle: 'CELL STABILITY · PHASE LOCK',
  theme: 'blood',
  build(s) {
    const out       = []
    statusbar(s, 'SCAN·A ⟐ 92%')
    label(s, 'CELL STABILITY LAB', 'SH 24:36')
    numericStrip(s, 3, 6)
    label(s, 'VERTICAL PHAS//', 'NORMAL')
    const h1 = widgetHost('naked'); s.appendChild(h1)
    out.push(hero({ host: h1, w: 160, h: 28 }))
    label(s, 'PULSE BURS//', 'NORMAL')
    const h2 = widgetHost('naked'); s.appendChild(h2)
    out.push(hero({ host: h2, w: 160, h: 28 }))
    label(s, 'ONE PULS//', 'NORMAL')
    const h3 = widgetHost('naked'); s.appendChild(h3)
    out.push(hero({ host: h3, w: 160, h: 28 }))
    readouts(s, [['STRESS','56%'],['OFFSET','21%'],['ANCHOR','79%'],['MEMORY','44%']])
    return out
  },
}

const S03_EYE         = {
  id: '03',
  title: 'REPLICANT RISK',
  subtitle: 'CELLS 1.03M · BASELINE',
  theme: 'cream',
  build(s) {
    const out       = []
    statusbar(s, 'OK 100%')
    label(s, 'DEVIATION · BASELINE', 'EP. 742')
    const row1 = el('div', 'row'); s.appendChild(row1)
    const m = widgetHost(); m.style.width = '120px'; row1.appendChild(m)
    out.push(matrix({ host: m, cols: 14, rows: 9, cell: 4, seed: 77, speed: 0.8 }))
    const eq = widgetHost(); row1.appendChild(eq)
    out.push(eqBars({ host: eq, bars: 10, barW: 3, gap: 1, h: 40, seed: 31 }))
    const tp = widgetHost('naked'); s.appendChild(tp)
    out.push(tape({ host: tp, w: 160, h: 6, bpm: 96 }))
    const row2 = el('div', 'row'); s.appendChild(row2)
    const eq2 = widgetHost(); row2.appendChild(eq2)
    out.push(eqBars({ host: eq2, bars: 14, barW: 3, gap: 1, h: 24, seed: 12 }))
    const eq3 = widgetHost(); row2.appendChild(eq3)
    out.push(eqBars({ host: eq3, bars: 14, barW: 3, gap: 1, h: 24, seed: 45 }))
    numericStrip(s, 3, 5)
    readouts(s, [['ALPHA','47.71'],['BETA','74.17'],['GAMMA','87.57'],['THETA','57.15']])
    return out
  },
}

const S04_CORE         = {
  id: '04',
  title: 'CORE STABILITY',
  subtitle: 'PHASE 02 · LOCKED',
  theme: 'blood',
  build(s) {
    const out       = []
    statusbar(s, 'NOISE 06dB')
    label(s, 'STATUS // NOMINAL', 'PH 02')
    const mx = widgetHost(); mx.style.height = '140px'; s.appendChild(mx)
    out.push(matrix({ host: mx, cols: 18, rows: 14, cell: 4, seed: 41, speed: 2.2 }))
    numericStrip(s, 4, 4)
    const row = el('div', 'row'); s.appendChild(row)
    const eq = widgetHost(); row.appendChild(eq)
    out.push(eqBars({ host: eq, bars: 22, barW: 2, gap: 1, h: 24, seed: 9 }))
    readouts(s, [['INT','0.874'],['DRFT','0.129'],['SNR','46.2dB'],['PH','02']])
    return out
  },
}

const S05_STEPS         = {
  id: '05',
  title: 'DRUM BASS LEAD',
  subtitle: 'PAT 01 · TUE · QLB',
  theme: 'mono',
  build(s) {
    const out       = []
    statusbar(s, '128 BPM')
    label(s, 'STEREO · DRUM BASS LEAD', 'BANK 03')
    const row1 = el('div', 'row'); s.appendChild(row1)
    for (let i = 0; i < 3; i++) {
      const c = el('div', 'knob-cell big'); row1.appendChild(c)
      const w = widgetHost(); c.appendChild(w)
      c.appendChild(el('div','lbl', ['KICK','BASS','LEAD'][i]))
      out.push(knob({ host: w, size: 44, seed: i * 2.1, lfoHz: 0.12 + i * 0.05 }))
    }
    label(s, 'PATTERN · 16×5', 'SHUFFLE 0')
    for (let i = 0; i < 1; i++) {
      const sq = widgetHost('naked'); s.appendChild(sq)
      out.push(sequencer({ host: sq, cols: 16, rows: 5, cellW: 8, cellH: 5, bpm: 128, seed: 30 + i }))
    }
    label(s, 'VOICE 6 · BANDCLIP 12', 'HITS 6 · TOOLS 2')
    const row2 = el('div', 'row'); s.appendChild(row2)
    const eq1 = widgetHost(); row2.appendChild(eq1)
    out.push(eqBars({ host: eq1, bars: 12, barW: 3, gap: 1, h: 18, seed: 7 }))
    const eq2 = widgetHost(); row2.appendChild(eq2)
    out.push(eqBars({ host: eq2, bars: 12, barW: 3, gap: 1, h: 18, seed: 17 }))
    transport(s, 'PAT · TUE · QLB · MIX · SNG', '▶')
    return out
  },
}

const S06_DECK         = {
  id: '06',
  title: 'CONTROL DECK',
  subtitle: '9 AXIS · MANUAL',
  theme: 'default',
  build(s) {
    const out       = []
    statusbar(s, 'MAN')
    label(s, 'FILTER · ADSR · FM · LFO', 'BANK 09')
    const g = el('div', 'grid-knobs-3x3'); s.appendChild(g)
    const names = ['CUT','RES','ENV','ATK','DEC','SUS','LFO','FM','MIX']
    for (let i = 0; i < 9; i++) {
      const c = el('div', 'knob-cell big'); g.appendChild(c)
      const w = widgetHost(); c.appendChild(w)
      c.appendChild(el('div','lbl', names[i]))
      out.push(knob({ host: w, size: 52, seed: i * 0.8, lfoHz: 0.06 + i * 0.03 }))
    }
    const tp = widgetHost('naked'); s.appendChild(tp)
    out.push(tape({ host: tp, w: 160, h: 6, bpm: 108 }))
    readouts(s, [['PATCH','03'],['MODE','FM'],['VOICES','08'],['OUTPUT','–6dB']])
    return out
  },
}

const S07_WAVES         = {
  id: '07',
  title: 'WAVEFORMS',
  subtitle: '3 OSC · STACKED',
  theme: 'ice',
  build(s) {
    const out       = []
    statusbar(s, 'OSC×3')
    label(s, 'OSC-A // SINE', '440Hz')
    const a = widgetHost('naked'); s.appendChild(a); out.push(hero({ host: a, w: 160, h: 44 }))
    label(s, 'OSC-B // SAW', '660Hz')
    const b = widgetHost('naked'); s.appendChild(b); out.push(hero({ host: b, w: 160, h: 44 }))
    label(s, 'OSC-C // NOISE', '—')
    const c = widgetHost('naked'); s.appendChild(c); out.push(hero({ host: c, w: 160, h: 44 }))
    const tp = widgetHost('naked'); s.appendChild(tp); out.push(tape({ host: tp, w: 160, h: 6, bpm: 110 }))
    readouts(s, [['DET','0.007'],['MIX','0.62'],['PHA','0.00'],['DRFT','0.014']])
    return out
  },
}

const S08_BIO         = {
  id: '08',
  title: 'CORE DNA',
  subtitle: 'STRAND ENTRY · 7·LAT·9×06',
  theme: 'mono',
  build(s) {
    const out       = []
    statusbar(s, 'INT 78%')
    label(s, 'STRAND ENTRY · T·LAT·9×06', 'PH 7.39')
    const row = el('div', 'row'); s.appendChild(row)
    const m = widgetHost(); m.style.width = '100px'; m.style.height = '220px'; row.appendChild(m)
    out.push(matrix({ host: m, cols: 5, rows: 24, cell: 4, seed: 88, speed: 1.8 }))
    const rightCol = el('div'); rightCol.style.display = 'flex'; rightCol.style.flexDirection = 'column'; rightCol.style.flex = '1'; rightCol.style.gap = '6px'
    row.appendChild(rightCol)
    const e1 = widgetHost(); rightCol.appendChild(e1); out.push(eqBars({ host: e1, bars: 10, barW: 3, gap: 1, h: 34, seed: 55 }))
    const e2 = widgetHost(); rightCol.appendChild(e2); out.push(eqBars({ host: e2, bars: 10, barW: 3, gap: 1, h: 34, seed: 66 }))
    const mini = widgetHost(); rightCol.appendChild(mini)
    out.push(matrix({ host: mini, cols: 10, rows: 5, cell: 3, seed: 99, speed: 1.0 }))
    readouts(s, [['INTEGRITY','98%'],['PASS','DC·RCM'],['STRAND','10.25'],['GLU','5.4']])
    return out
  },
}

const S09_DENSE         = {
  id: '09',
  title: 'STACK DRIFT',
  subtitle: 'MIN LOAD · SAVE',
  theme: 'blood',
  build(s) {
    const out       = []
    statusbar(s, 'MIN')
    label(s, 'ZONE STABILITY', 'RAN 02')
    const mx = widgetHost(); mx.style.height = '68px'; s.appendChild(mx)
    out.push(matrix({ host: mx, cols: 22, rows: 9, cell: 4, seed: 200, speed: 0.5 }))
    const row = el('div','row'); s.appendChild(row)
    const eL = widgetHost(); row.appendChild(eL); out.push(eqBars({ host: eL, bars: 14, barW: 3, gap: 1, h: 16, seed: 1 }))
    const eR = widgetHost(); row.appendChild(eR); out.push(eqBars({ host: eR, bars: 14, barW: 3, gap: 1, h: 16, seed: 2 }))
    numericStrip(s, 4, 4)
    label(s, 'HEX SEQ · TAPE', 'BUF 07')
    const tp = widgetHost('naked'); s.appendChild(tp); out.push(tape({ host: tp, w: 160, h: 8, bpm: 96 }))
    const sq = widgetHost('naked'); s.appendChild(sq)
    out.push(sequencer({ host: sq, cols: 22, rows: 2, cellW: 6, cellH: 4, bpm: 96, seed: 300 }))
    readouts(s, [['STK','DRFT'],['MIN','ON'],['BPM','96'],['SYS','OK']])
    return out
  },
}

const S10_MIN         = {
  id: '10',
  title: 'MINIMAL',
  subtitle: 'ONE WAVE',
  theme: 'cream',
  build(s) {
    const out       = []
    statusbar(s, 'MIN')
    label(s, 'ONE · OSCILLATOR', '—')
    const h = widgetHost('naked'); s.appendChild(h)
    out.push(hero({ host: h, w: 160, h: 120 }))
    numericStrip(s, 1, 4)
    readouts(s, [['F','220.00 HZ'],['A','0.72']])
    return out
  },
}

// ---------- SCREENS 11–20: drift toward helix + tape ----------

const S11_STATS         = {
  id: '11',
  title: 'STAT PANEL',
  subtitle: 'CHANNEL BARS · 6',
  theme: 'default',
  build(s) {
    const out       = []
    statusbar(s, 'STAT')
    label(s, 'CHANNEL LEVELS', '6/6')
    const hb = widgetHost(); hb.style.padding = '6px'; s.appendChild(hb)
    out.push(hBars({ host: hb, w: 160, rows: 6, seed: 11 }))
    label(s, 'SPECTRUM', '512')
    const eq = widgetHost(); s.appendChild(eq)
    out.push(eqBars({ host: eq, bars: 22, barW: 3, gap: 1, h: 28, seed: 18 }))
    readouts(s, [['A','+0.24'],['B','−0.11'],['C','+0.62'],['D','+0.04']])
    numericStrip(s, 2, 6)
    return out
  },
}

const S12_DUAL         = {
  id: '12',
  title: 'DUAL STRAND',
  subtitle: 'PRE-ALIGN · HELIX 01',
  theme: 'blood',
  build(s) {
    const out       = []
    statusbar(s, 'PRE-ALIGN')
    label(s, 'STRAND GUIDE', 'LOCK PEND')
    const row = el('div', 'row'); s.appendChild(row)
    const hx = widgetHost(); hx.style.width = '80px'; row.appendChild(hx)
    out.push(helix({ host: hx, w: 60, h: 150, turns: 1.8, dotsPerStrand: 22, radius: 14, speed: 0.18 }))
    const right = el('div'); right.style.display='flex'; right.style.flexDirection='column'; right.style.flex='1'; right.style.gap='6px'; row.appendChild(right)
    const hb = widgetHost(); hb.style.padding='6px'; right.appendChild(hb)
    out.push(hBars({ host: hb, w: 180, rows: 4, seed: 21 }))
    const eq = widgetHost(); right.appendChild(eq)
    out.push(eqBars({ host: eq, bars: 14, barW: 3, gap: 1, h: 30, seed: 22 }))
    readouts(s, [['PH','7.38'],['PR','102'],['O2','96%'],['CO2','4.3']])
    return out
  },
}

const S13_LAB         = {
  id: '13',
  title: 'LAB BENCH',
  subtitle: 'SAMPLE B-07 · READ',
  theme: 'cream',
  build(s) {
    const out       = []
    statusbar(s, 'READ')
    label(s, 'GEL ELECTROPHORESIS', 'RUN 2:14')
    const mx = widgetHost(); mx.style.height = '60px'; s.appendChild(mx)
    out.push(matrix({ host: mx, cols: 24, rows: 8, cell: 4, seed: 130, speed: 0.6 }))
    label(s, 'MARKER BARS', 'KBP')
    const hb = widgetHost(); hb.style.padding='6px'; s.appendChild(hb)
    out.push(hBars({ host: hb, w: 160, rows: 5, seed: 13 }))
    numericStrip(s, 2, 5)
    readouts(s, [['NG/uL','124'],['A260','1.92'],['A280','0.98'],['A260/280','1.95']])
    return out
  },
}

const S14_SPIN         = {
  id: '14',
  title: 'CENTRIFUGE',
  subtitle: 'SPIN 7400 RPM',
  theme: 'mono',
  build(s) {
    const out       = []
    statusbar(s, '7400 RPM')
    label(s, 'ROTOR · SR-21', 'CYCLE 02/06')
    const row = el('div', 'row'); row.style.justifyContent='center'; row.style.padding='8px'; s.appendChild(row)
    const r1 = widgetHost('naked'); r1.style.flex='0 0 auto'; row.appendChild(r1)
    out.push(reel({ host: r1, size: 96, speed: 1.2, spokes: 6 }))
    const hb = widgetHost(); hb.style.padding='6px'; s.appendChild(hb)
    out.push(hBars({ host: hb, w: 160, rows: 4, seed: 14 }))
    const tp = widgetHost('naked'); s.appendChild(tp)
    out.push(tape({ host: tp, w: 160, h: 8, bpm: 140 }))
    readouts(s, [['RPM','7400'],['G','4210'],['T','04°C'],['ETA','03:22']])
    return out
  },
}

const S15_ALIGN         = {
  id: '15',
  title: 'HELIX ALIGN',
  subtitle: 'DUAL STRAND · LOCKED',
  theme: 'blood',
  build(s) {
    const out       = []
    statusbar(s, 'LOCK')
    label(s, 'STRAND · DUAL', 'PHASE 02')
    const row = el('div', 'row'); s.appendChild(row)
    const left = widgetHost(); left.style.width = '120px'; left.style.padding = '4px'; row.appendChild(left)
    out.push(helix({ host: left, w: 100, h: 200, turns: 3, dotsPerStrand: 32, radius: 22, speed: 0.22 }))
    const right = el('div'); right.style.flex='1'; right.style.display='flex'; right.style.flexDirection='column'; right.style.gap='6px'; row.appendChild(right)
    const hb = widgetHost(); hb.style.padding='6px'; right.appendChild(hb)
    out.push(hBars({ host: hb, w: 180, rows: 4, seed: 28 }))
    const eq = widgetHost(); right.appendChild(eq)
    out.push(eqBars({ host: eq, bars: 12, barW: 3, gap: 1, h: 26, seed: 29 }))
    const mx = widgetHost(); right.appendChild(mx)
    out.push(matrix({ host: mx, cols: 10, rows: 5, cell: 3, seed: 31, speed: 1.5 }))
    readouts(s, [['BP','2148'],['GC','48%'],['TM','74°C'],['ΔG','−1.2']])
    return out
  },
}

const S16_DECK         = {
  id: '16',
  title: 'TAPE DECK',
  subtitle: 'SPOOL · PLAY',
  theme: 'mono',
  build(s) {
    const out       = []
    statusbar(s, 'PLAY')
    label(s, 'SPOOLS · PLAY', 'SIDE A')
    const row = el('div', 'row'); row.style.padding = '8px'; row.style.justifyContent='space-between'; row.style.alignItems = 'center'; s.appendChild(row)
    const rL = widgetHost('naked'); rL.style.flex='0 0 auto'; row.appendChild(rL)
    out.push(reel({ host: rL, size: 72, speed: 0.9, spokes: 6 }))
    const mid = widgetHost(); mid.style.flex='1'; mid.style.margin='0 8px'
    row.appendChild(mid)
    out.push(tape({ host: mid, w: 120, h: 10, bpm: 100 }))
    const rR = widgetHost('naked'); rR.style.flex='0 0 auto'; row.appendChild(rR)
    out.push(reel({ host: rR, size: 72, speed: 0.6, spokes: 6 }))
    label(s, 'TAPE METERS', 'dB')
    const vL = widgetHost(); s.appendChild(vL); out.push(vu({ host: vL, w: 160, h: 5, segs: 28, seed: 1 }))
    const vR = widgetHost(); s.appendChild(vR); out.push(vu({ host: vR, w: 160, h: 5, segs: 28, seed: 2 }))
    const hb = widgetHost(); hb.style.padding='6px'; s.appendChild(hb)
    out.push(hBars({ host: hb, w: 160, rows: 3, seed: 16 }))
    readouts(s, [['ELAP','12:44'],['REM','22:16'],['SIDE','A'],['NR','DBX']])
    transport(s, '¼" · 7.5 IPS · NR DBX', '▶')
    return out
  },
}

const S17_LAB2         = {
  id: '17',
  title: 'SEQ · HELIX',
  subtitle: 'READ · LOCK · TWIRL',
  theme: 'ice',
  build(s) {
    const out       = []
    statusbar(s, 'READ')
    label(s, 'ROTATING STRAND', 'RATE 0.34')
    const row = el('div','row'); row.style.gap='6px'; s.appendChild(row)
    const rL = widgetHost('naked'); rL.style.flex='0 0 auto'; row.appendChild(rL)
    out.push(reel({ host: rL, size: 48, speed: 0.5, spokes: 5 }))
    const hx = widgetHost(); hx.style.flex='1'; hx.style.padding='2px'; row.appendChild(hx)
    out.push(helix({ host: hx, w: 140, h: 140, turns: 2.2, dotsPerStrand: 26, radius: 26, speed: 0.34 }))
    const rR = widgetHost('naked'); rR.style.flex='0 0 auto'; row.appendChild(rR)
    out.push(reel({ host: rR, size: 48, speed: 0.35, spokes: 5 }))
    const hb = widgetHost(); hb.style.padding='6px'; s.appendChild(hb)
    out.push(hBars({ host: hb, w: 160, rows: 4, seed: 17 }))
    numericStrip(s, 2, 6)
    readouts(s, [['STR','3.42 KBP'],['COV','128×'],['Q20','96%'],['Q30','88%']])
    return out
  },
}

const S18_FULL         = {
  id: '18',
  title: 'GENOME DESK',
  subtitle: 'FULL STACK · BIO',
  theme: 'blood',
  build(s) {
    const out       = []
    statusbar(s, 'BIO 04')
    label(s, 'GENOME DESK', 'STACK 04')
    const top = el('div','row'); s.appendChild(top)
    const hx = widgetHost(); hx.style.flex='1'; hx.style.padding='2px'; top.appendChild(hx)
    out.push(helix({ host: hx, w: 150, h: 120, turns: 2.6, dotsPerStrand: 28, radius: 20, speed: 0.3 }))
    const rightCol = el('div'); rightCol.style.display='flex'; rightCol.style.flexDirection='column'; rightCol.style.gap='4px'; rightCol.style.width='90px'; top.appendChild(rightCol)
    const r1 = widgetHost('naked'); r1.style.display='flex'; r1.style.justifyContent='center'; rightCol.appendChild(r1)
    out.push(reel({ host: r1, size: 44, speed: 0.8, spokes: 6 }))
    const mx = widgetHost(); rightCol.appendChild(mx)
    out.push(matrix({ host: mx, cols: 8, rows: 6, cell: 4, seed: 44, speed: 1.2 }))
    const hb = widgetHost(); hb.style.padding='6px'; s.appendChild(hb)
    out.push(hBars({ host: hb, w: 160, rows: 5, seed: 18 }))
    const tp = widgetHost('naked'); s.appendChild(tp)
    out.push(tape({ host: tp, w: 160, h: 6, bpm: 90 }))
    readouts(s, [['BP','12.8K'],['GC','52%'],['N50','840'],['L50','22']])
    return out
  },
}

const S19_STUDIO         = {
  id: '19',
  title: 'STUDIO DECK',
  subtitle: 'TAPE + HELIX + MIX',
  theme: 'mono',
  build(s) {
    const out       = []
    statusbar(s, 'STUDIO')
    label(s, 'DECK · A/B', 'IPS 15')
    const deck = el('div','row'); deck.style.justifyContent='space-between'; deck.style.alignItems='center'; deck.style.padding='4px'; s.appendChild(deck)
    const rL = widgetHost('naked'); deck.appendChild(rL)
    out.push(reel({ host: rL, size: 68, speed: 1.1, spokes: 6 }))
    const mid = el('div'); mid.style.flex='1'; mid.style.margin='0 8px'; mid.style.display='flex'; mid.style.flexDirection='column'; mid.style.gap='4px'; deck.appendChild(mid)
    const tp = widgetHost('naked'); mid.appendChild(tp)
    out.push(tape({ host: tp, w: 120, h: 8, bpm: 120 }))
    const he = widgetHost(); mid.appendChild(he)
    out.push(hero({ host: he, w: 140, h: 26 }))
    const rR = widgetHost('naked'); deck.appendChild(rR)
    out.push(reel({ host: rR, size: 68, speed: 0.7, spokes: 6 }))
    label(s, 'HELIX MON', 'PHASE')
    const hx = widgetHost(); hx.style.padding='2px'; s.appendChild(hx)
    out.push(helix({ host: hx, w: 120, h: 100, turns: 2, dotsPerStrand: 22, radius: 24, speed: 0.4 }))
    const vL = widgetHost(); s.appendChild(vL); out.push(vu({ host: vL, w: 160, h: 5, segs: 24, seed: 11 }))
    const vR = widgetHost(); s.appendChild(vR); out.push(vu({ host: vR, w: 160, h: 5, segs: 24, seed: 12 }))
    transport(s, '¼" · 15 IPS · A', '▶')
    return out
  },
}

const S20_HELIX         = {
  id: '20',
  title: 'HELIX HERO',
  subtitle: 'SINGLE STRAND · BIG',
  theme: 'blood',
  build(s) {
    const out       = []
    statusbar(s, 'SOLO')
    label(s, 'ROTATING STRAND · 3×', 'RATE 0.22')
    const hx = widgetHost(); hx.style.padding='4px'; hx.style.height = '280px'; s.appendChild(hx)
    out.push(helix({ host: hx, w: 160, h: 260, turns: 3.4, dotsPerStrand: 40, radius: 34, speed: 0.22, rungStride: 2 }))
    const hb = widgetHost(); hb.style.padding='6px'; s.appendChild(hb)
    out.push(hBars({ host: hb, w: 160, rows: 3, seed: 20 }))
    readouts(s, [['RATE','0.22 HZ'],['R','34 PX'],['N','40']])
    return out
  },
}

// ---------- SCREENS 21–40: counter / bitmap icon / code scroller ----------

const S21_CNT         = {
  id: '21', title: 'BIG COUNT', subtitle: 'DROP · 0', theme: 'mono',
  build(s) {
    const out       = []
    statusbar(s, 'DROP')
    const wrap = widgetHost('naked'); wrap.style.display='flex'; wrap.style.justifyContent='center'; wrap.style.padding='10px 0'; s.appendChild(wrap)
    out.push(sevenSeg({ host: wrap, digits: 6, scale: 6, interval: 600, delta: 1 }))
    const eq = widgetHost(); s.appendChild(eq)
    out.push(eqBars({ host: eq, bars: 22, barW: 3, gap: 1, h: 26, seed: 21 }))
    const hb = widgetHost(); hb.style.padding='6px'; s.appendChild(hb)
    out.push(hBars({ host: hb, w: 180, rows: 3, seed: 21 }))
    readouts(s, [['TOTAL','84301'],['RATE','+3.2/s']])
    return out
  },
}

const S22_ICON         = {
  id: '22', title: 'CORE ICON', subtitle: 'BITMAP · RADIAL', theme: 'blood',
  build(s) {
    const out       = []
    statusbar(s, 'CORE 22')
    label(s, 'CORE STABILITY', 'PH 02')
    const wrap = widgetHost('naked'); wrap.style.display='flex'; wrap.style.justifyContent='center'; wrap.style.padding='6px'; s.appendChild(wrap)
    out.push(bitmap({ host: wrap, w: 120, h: 120, style: 'radial', arms: 6, rings: 4, speed: 0.18 }))
    codeScroll({ host: s, rows: 4, groupsPerRow: 4, charsPerGroup: 3, interval: 160, mode: 'alphanum' })
    readouts(s, [['SYNC','99%'],['TEMP','37C'],['DRIFT','06ms'],['STAT','CALM']])
    return out
  },
}

const S23_CODES         = {
  id: '23', title: 'CODE STREAM', subtitle: 'DENSE · ALPHA', theme: 'mono',
  build(s) {
    const out       = []
    statusbar(s, 'STREAM')
    label(s, 'LIVE STREAM', 'ALPHA+NUM')
    codeScroll({ host: s, rows: 8, groupsPerRow: 5, charsPerGroup: 3, interval: 140, mode: 'alphanum', fontSize: 12 })
    const tp = widgetHost('naked'); s.appendChild(tp)
    out.push(tape({ host: tp, w: 200, h: 6, bpm: 110 }))
    readouts(s, [['RATE','41 KB/s'],['PKT','0x1A4F'],['CRC','OK'],['LOSS','0.02%']])
    return out
  },
}

const S24_MAND         = {
  id: '24', title: 'MANDALA', subtitle: 'DUAL MANDALA ROT',
  build(s) {
    const out       = []
    statusbar(s, 'ROT')
    const row = el('div','row'); row.style.gap='10px'; row.style.padding='8px 0'; s.appendChild(row)
    const b1 = widgetHost('naked'); b1.style.display='flex'; b1.style.justifyContent='center'; row.appendChild(b1)
    out.push(bitmap({ host: b1, w: 90, h: 90, style: 'radial', arms: 8, speed: 0.12, seed: 1 }))
    const b2 = widgetHost('naked'); b2.style.display='flex'; b2.style.justifyContent='center'; row.appendChild(b2)
    out.push(bitmap({ host: b2, w: 90, h: 90, style: 'spiral', arms: 5, speed: -0.18, seed: 3 }))
    const hb = widgetHost(); hb.style.padding='6px'; s.appendChild(hb)
    out.push(hBars({ host: hb, w: 180, rows: 4, seed: 24 }))
    numericStrip(s, 2, 6)
    return out
  },
}

const S25_TIMERS         = {
  id: '25', title: 'TWIN TIMERS', subtitle: '00:01:07 · 00:05:30', theme: 'mono',
  build(s) {
    const out       = []
    statusbar(s, 'TIMERS')
    const r = el('div','row'); r.style.justifyContent='center'; r.style.gap='24px'; r.style.padding='8px 0'; s.appendChild(r)
    const w1 = widgetHost('naked'); r.appendChild(w1)
    out.push(sevenSeg({ host: w1, digits: 5, scale: 3, interval: 1000, delta: 1, seed: 67 }))
    const w2 = widgetHost('naked'); r.appendChild(w2)
    out.push(sevenSeg({ host: w2, digits: 5, scale: 3, interval: 500, delta: 1, seed: 330 }))
    label(s, 'ELAPSED · REMAINING', 'SIDE A')
    const he = widgetHost('naked'); s.appendChild(he)
    out.push(hero({ host: he, w: 180, h: 40 }))
    codeScroll({ host: s, rows: 3, groupsPerRow: 4, charsPerGroup: 3, interval: 200, mode: 'hex', fontSize: 11 })
    return out
  },
}

const S26_FULL         = {
  id: '26', title: 'ICON + CODE', subtitle: 'EYE · CODES · BARS', theme: 'blood',
  build(s) {
    const out       = []
    statusbar(s, 'READ 82%')
    const row = el('div','row'); s.appendChild(row)
    const b = widgetHost('naked'); b.style.flex='0 0 auto'; row.appendChild(b)
    out.push(bitmap({ host: b, w: 84, h: 84, style: 'eye', speed: 0.22, seed: 5 }))
    const right = el('div'); right.style.flex='1'; right.style.display='flex'; right.style.flexDirection='column'; right.style.gap='4px'; row.appendChild(right)
    codeScroll({ host: right, rows: 3, groupsPerRow: 4, charsPerGroup: 3, interval: 200, mode: 'alphanum' })
    const hb = widgetHost(); hb.style.padding='4px'; right.appendChild(hb)
    out.push(hBars({ host: hb, w: 120, rows: 3, seed: 26 }))
    label(s, 'SPECTRUM', '512')
    const eq = widgetHost(); s.appendChild(eq)
    out.push(eqBars({ host: eq, bars: 20, barW: 3, gap: 1, h: 28, seed: 26 }))
    readouts(s, [['IRIS','+0.34'],['FOC','0.88'],['DEP','1.02'],['NOI','06dB']])
    return out
  },
}

const S27_MIXED         = {
  id: '27', title: 'MIXED DECK', subtitle: 'ALL PRIMITIVES',
  build(s) {
    const out       = []
    statusbar(s, 'ALL')
    const row = el('div','row'); s.appendChild(row)
    const cnt = widgetHost('naked'); cnt.style.flex='1'; row.appendChild(cnt)
    out.push(sevenSeg({ host: cnt, digits: 5, scale: 3, interval: 420, delta: 1, seed: 12034 }))
    const b = widgetHost('naked'); row.appendChild(b)
    out.push(bitmap({ host: b, w: 60, h: 60, style: 'burst', speed: 0.25 }))
    const sq = widgetHost('naked'); s.appendChild(sq)
    out.push(sequencer({ host: sq, cols: 22, rows: 3, cellW: 6, cellH: 4, bpm: 120, seed: 27 }))
    const eq = widgetHost(); s.appendChild(eq)
    out.push(eqBars({ host: eq, bars: 20, barW: 3, gap: 1, h: 22, seed: 27 }))
    codeScroll({ host: s, rows: 2, groupsPerRow: 5, charsPerGroup: 3, interval: 180, mode: 'alpha' })
    return out
  },
}

const S28_PULSE         = {
  id: '28', title: 'PULSE LOG', subtitle: 'COUNTER · TAPE · BARS', theme: 'ice',
  build(s) {
    const out       = []
    statusbar(s, 'LOG')
    const c = widgetHost('naked'); c.style.display='flex'; c.style.justifyContent='center'; c.style.padding='6px 0'; s.appendChild(c)
    out.push(sevenSeg({ host: c, digits: 8, scale: 4, interval: 200, delta: 7, seed: 51070804 }))
    const tp = widgetHost('naked'); s.appendChild(tp)
    out.push(tape({ host: tp, w: 200, h: 8, bpm: 90 }))
    const hb = widgetHost(); hb.style.padding='6px'; s.appendChild(hb)
    out.push(hBars({ host: hb, w: 200, rows: 5, seed: 28 }))
    readouts(s, [['PK','−5.3'],['DA','0.7'],['FRQ','40K5'],['HPF','0.8']])
    return out
  },
}

const S29_TWINS         = {
  id: '29', title: 'DUAL SPIN', subtitle: 'TWO MANDALAS · LOCK', theme: 'blood',
  build(s) {
    const out       = []
    statusbar(s, 'LOCK')
    const r = el('div','row'); r.style.padding='6px 0'; s.appendChild(r)
    const r1 = widgetHost('naked'); r1.style.flex='1'; r1.style.display='flex'; r1.style.justifyContent='center'; r.appendChild(r1)
    out.push(reel({ host: r1, size: 80, speed: 1.1, spokes: 7 }))
    const r2 = widgetHost('naked'); r2.style.flex='1'; r2.style.display='flex'; r2.style.justifyContent='center'; r.appendChild(r2)
    out.push(reel({ host: r2, size: 80, speed: -0.7, spokes: 5 }))
    const sq = widgetHost('naked'); s.appendChild(sq)
    out.push(sequencer({ host: sq, cols: 24, rows: 2, cellW: 6, cellH: 4, bpm: 140, seed: 29 }))
    codeScroll({ host: s, rows: 3, groupsPerRow: 4, charsPerGroup: 3, interval: 220, mode: 'dna' })
    readouts(s, [['L·RPM','2240'],['R·RPM','1410'],['Δ','+0.02']])
    return out
  },
}

const S30_BIG         = {
  id: '30', title: 'CLOCK', subtitle: 'BIG TIME', theme: 'mono',
  build(s) {
    const out       = []
    statusbar(s, 'TIME')
    const c = widgetHost('naked'); c.style.display='flex'; c.style.justifyContent='center'; c.style.padding='20px 0'; s.appendChild(c)
    out.push(sevenSeg({ host: c, digits: 5, scale: 7, interval: 1000, delta: 1 }))
    const he = widgetHost('naked'); s.appendChild(he)
    out.push(hero({ host: he, w: 200, h: 34 }))
    readouts(s, [['BPM','120'],['ALIGN','OK'],['SRC','INT'],['QTZ','1/16']])
    return out
  },
}

const S31_BIOSCROLL         = {
  id: '31', title: 'BIO STREAM', subtitle: 'DNA · HELIX · CODE', theme: 'blood',
  build(s) {
    const out       = []
    statusbar(s, 'BIO')
    const row = el('div','row'); s.appendChild(row)
    const hx = widgetHost(); hx.style.flex='0 0 auto'; hx.style.width='100px'; hx.style.padding='2px'; row.appendChild(hx)
    out.push(helix({ host: hx, w: 90, h: 180, turns: 2.5, dotsPerStrand: 28, radius: 18, speed: 0.26 }))
    const right = el('div'); right.style.flex='1'; right.style.display='flex'; right.style.flexDirection='column'; right.style.gap='4px'; row.appendChild(right)
    codeScroll({ host: right, rows: 5, groupsPerRow: 3, charsPerGroup: 3, interval: 160, mode: 'dna', fontSize: 12 })
    const eq = widgetHost(); right.appendChild(eq)
    out.push(eqBars({ host: eq, bars: 10, barW: 3, gap: 1, h: 28, seed: 31 }))
    readouts(s, [['BP','2.14K'],['GC','48%'],['Q20','96%'],['N50','840']])
    return out
  },
}

const S32_HELIX_REEL         = {
  id: '32', title: 'HELIX REELS', subtitle: 'TAPE FLANKS',
  build(s) {
    const out       = []
    statusbar(s, 'SPIN')
    const row = el('div','row'); row.style.alignItems='center'; row.style.padding='6px 0'; s.appendChild(row)
    const rL = widgetHost('naked'); rL.style.flex='0 0 auto'; row.appendChild(rL)
    out.push(reel({ host: rL, size: 62, speed: 0.9, spokes: 6 }))
    const hx = widgetHost(); hx.style.flex='1'; hx.style.padding='0 6px'; row.appendChild(hx)
    out.push(helix({ host: hx, w: 110, h: 160, turns: 2.2, dotsPerStrand: 26, radius: 22, speed: 0.26 }))
    const rR = widgetHost('naked'); rR.style.flex='0 0 auto'; row.appendChild(rR)
    out.push(reel({ host: rR, size: 62, speed: -0.5, spokes: 6 }))
    const tp = widgetHost('naked'); s.appendChild(tp)
    out.push(tape({ host: tp, w: 200, h: 8, bpm: 120 }))
    const hb = widgetHost(); hb.style.padding='6px'; s.appendChild(hb)
    out.push(hBars({ host: hb, w: 200, rows: 3, seed: 32 }))
    return out
  },
}

const S33_FLIP         = {
  id: '33', title: 'FLIP BOOK', subtitle: 'ICON CYCLE', theme: 'cream',
  build(s) {
    const out       = []
    statusbar(s, 'FLIP')
    const grid = el('div'); grid.style.display='grid'; grid.style.gridTemplateColumns='repeat(3, 1fr)'; grid.style.gap='6px'; grid.style.padding='4px'; s.appendChild(grid)
    const styles                                         = ['radial','spiral','eye','burst','radial','spiral']
    for (let i = 0; i < 6; i++) {
      const w = widgetHost('naked'); w.style.display='flex'; w.style.justifyContent='center'; grid.appendChild(w)
      out.push(bitmap({ host: w, w: 60, h: 60, style: styles[i], arms: 4 + i, speed: 0.15 + i*0.04, seed: i*1.3 }))
    }
    codeScroll({ host: s, rows: 3, groupsPerRow: 4, charsPerGroup: 3, interval: 220, mode: 'alpha' })
    return out
  },
}

const S34_STACK         = {
  id: '34', title: 'WAVE STACK', subtitle: 'FOUR OSC',
  build(s) {
    const out       = []
    statusbar(s, '4·OSC')
    for (let i = 0; i < 4; i++) {
      label(s, `OSC · ${i+1}`, `${(220 * (i+1))}Hz`)
      const he = widgetHost('naked'); s.appendChild(he)
      out.push(hero({ host: he, w: 200, h: 26 }))
    }
    codeScroll({ host: s, rows: 2, groupsPerRow: 5, charsPerGroup: 3, interval: 160, mode: 'hex' })
    return out
  },
}

const S35_COUNTSEQ         = {
  id: '35', title: 'COUNT + SEQ', subtitle: 'DROP · PATTERN', theme: 'mono',
  build(s) {
    const out       = []
    statusbar(s, 'CNT')
    const c = widgetHost('naked'); c.style.display='flex'; c.style.justifyContent='center'; c.style.padding='8px 0'; s.appendChild(c)
    out.push(sevenSeg({ host: c, digits: 4, scale: 6, interval: 300, delta: 1 }))
    const sq = widgetHost('naked'); s.appendChild(sq)
    out.push(sequencer({ host: sq, cols: 24, rows: 5, cellW: 6, cellH: 4, bpm: 128, seed: 35 }))
    const vL = widgetHost(); s.appendChild(vL); out.push(vu({ host: vL, w: 200, h: 5, segs: 30, seed: 11 }))
    const vR = widgetHost(); s.appendChild(vR); out.push(vu({ host: vR, w: 200, h: 5, segs: 30, seed: 12 }))
    return out
  },
}

const S36_MIN         = {
  id: '36', title: 'DROP 0', subtitle: 'MIN', theme: 'mono',
  build(s) {
    const out       = []
    statusbar(s, '0')
    const c = widgetHost('naked'); c.style.display='flex'; c.style.justifyContent='center'; c.style.padding='60px 0 40px'; s.appendChild(c)
    out.push(sevenSeg({ host: c, digits: 1, scale: 14, interval: 2000, delta: 1 }))
    readouts(s, [['TOT','1']])
    return out
  },
}

const S37_ALPHA         = {
  id: '37', title: 'ALPHA ONLY', subtitle: 'CODE DUMP', theme: 'cream',
  build(s) {
    const out       = []
    statusbar(s, 'A–Z')
    codeScroll({ host: s, rows: 10, groupsPerRow: 4, charsPerGroup: 4, interval: 140, mode: 'alpha', fontSize: 13 })
    const tp = widgetHost('naked'); s.appendChild(tp)
    out.push(tape({ host: tp, w: 200, h: 6, bpm: 96 }))
    return out
  },
}

const S38_ICON_TAPE         = {
  id: '38', title: 'ICON + TAPE', subtitle: 'BURST · REELS',
  build(s) {
    const out       = []
    statusbar(s, 'BRST')
    const b = widgetHost('naked'); b.style.display='flex'; b.style.justifyContent='center'; b.style.padding='6px 0'; s.appendChild(b)
    out.push(bitmap({ host: b, w: 110, h: 110, style: 'burst', arms: 10, speed: 0.3 }))
    const row = el('div','row'); row.style.alignItems='center'; row.style.padding='6px 0'; s.appendChild(row)
    const rL = widgetHost('naked'); rL.style.flex='0 0 auto'; row.appendChild(rL)
    out.push(reel({ host: rL, size: 56, speed: 0.8 }))
    const tp = widgetHost('naked'); tp.style.flex='1'; tp.style.margin='0 8px'; row.appendChild(tp)
    out.push(tape({ host: tp, w: 120, h: 8, bpm: 110 }))
    const rR = widgetHost('naked'); rR.style.flex='0 0 auto'; row.appendChild(rR)
    out.push(reel({ host: rR, size: 56, speed: -0.55 }))
    codeScroll({ host: s, rows: 3, groupsPerRow: 4, charsPerGroup: 3, interval: 180, mode: 'alphanum' })
    return out
  },
}

const S39_INSTRU         = {
  id: '39', title: 'INSTRUMENT', subtitle: 'DEEP PANEL', theme: 'blood',
  build(s) {
    const out       = []
    statusbar(s, 'INS')
    const top = el('div','row'); s.appendChild(top)
    const c = widgetHost('naked'); c.style.flex='1'; c.style.display='flex'; c.style.justifyContent='center'; top.appendChild(c)
    out.push(sevenSeg({ host: c, digits: 4, scale: 4, interval: 300, delta: 1, seed: 128 }))
    const b = widgetHost('naked'); top.appendChild(b)
    out.push(bitmap({ host: b, w: 56, h: 56, style: 'radial', arms: 6, speed: 0.2 }))
    const sq = widgetHost('naked'); s.appendChild(sq)
    out.push(sequencer({ host: sq, cols: 16, rows: 5, cellW: 8, cellH: 5, bpm: 128, seed: 39 }))
    const row = el('div','row'); s.appendChild(row)
    const eq = widgetHost(); row.appendChild(eq)
    out.push(eqBars({ host: eq, bars: 14, barW: 3, gap: 1, h: 22, seed: 39 }))
    const mx = widgetHost(); row.appendChild(mx)
    out.push(matrix({ host: mx, cols: 10, rows: 5, cell: 4, seed: 139, speed: 1.2 }))
    const kn = el('div','grid-knobs'); s.appendChild(kn)
    for (let i = 0; i < 5; i++) {
      const cell = el('div','knob-cell')
      const w = widgetHost(); cell.appendChild(w)
      cell.appendChild(el('div','lbl', ['CUT','RES','ENV','LFO','MIX'][i]))
      kn.appendChild(cell)
      out.push(knob({ host: w, size: 30, seed: i*0.8, lfoHz: 0.07 + i*0.03 }))
    }
    return out
  },
}

const S40_ALL         = {
  id: '40', title: 'STUDIO ALL', subtitle: 'EVERYTHING · ONE', theme: 'mono',
  build(s) {
    const out       = []
    statusbar(s, 'ALL')
    const c = widgetHost('naked'); c.style.display='flex'; c.style.justifyContent='center'; c.style.padding='4px 0'; s.appendChild(c)
    out.push(sevenSeg({ host: c, digits: 6, scale: 3, interval: 200, delta: 1, seed: 9 }))
    const row1 = el('div','row'); row1.style.alignItems='center'; s.appendChild(row1)
    const rL = widgetHost('naked'); row1.appendChild(rL)
    out.push(reel({ host: rL, size: 46, speed: 0.9 }))
    const b = widgetHost('naked'); b.style.flex='1'; b.style.display='flex'; b.style.justifyContent='center'; row1.appendChild(b)
    out.push(bitmap({ host: b, w: 72, h: 72, style: 'eye', speed: 0.2 }))
    const rR = widgetHost('naked'); row1.appendChild(rR)
    out.push(reel({ host: rR, size: 46, speed: -0.6 }))
    const hx = widgetHost(); hx.style.padding='2px'; s.appendChild(hx)
    out.push(helix({ host: hx, w: 160, h: 90, turns: 2.6, dotsPerStrand: 24, radius: 20, speed: 0.28 }))
    const sq = widgetHost('naked'); s.appendChild(sq)
    out.push(sequencer({ host: sq, cols: 20, rows: 3, cellW: 7, cellH: 5, bpm: 128, seed: 40 }))
    codeScroll({ host: s, rows: 3, groupsPerRow: 5, charsPerGroup: 3, interval: 160, mode: 'alphanum' })
    const vL = widgetHost(); s.appendChild(vL); out.push(vu({ host: vL, w: 200, h: 5, segs: 32, seed: 41 }))
    transport(s, 'ALL CHAN · MIX', '▶')
    return out
  },
}

// ---------- SCREENS 41–50: 3D creature / organic motion ----------

function coreFrame(
  host             ,
  title        ,
  status        ,
  build                              ,
)       {
  const frame = el('div', 'frame')
  const t = el('div', 'frame-title'); t.textContent = title
  const st = el('div', 'frame-status'); st.textContent = status
  const badge = el('div', 'frame-badge')
  const corners = el('div', 'fc-br')
  frame.append(t, st, badge, corners)
  const inner = el('div')
  inner.style.display = 'flex'
  inner.style.justifyContent = 'center'
  inner.style.alignItems = 'center'
  inner.style.padding = '10px 4px 6px'
  frame.appendChild(inner)
  build(inner)
  host.appendChild(frame)
}

function dualNum(host             , rows        )       {
  const box = el('div', 'dualnum')
  const colA = el('div', 'col'); const colB = el('div', 'col')
  const genRow = () => {
    const parts           = []
    for (let i = 0; i < 4; i++) {
      parts.push(String(((Math.random() * 10000) | 0)).padStart(4, '0'))
    }
    return parts.join('.')
  }
  const paint = () => {
    const a           = []; const b           = []
    for (let i = 0; i < rows; i++) { a.push(genRow()); b.push(genRow()) }
    colA.textContent = a.join('\n')
    colB.textContent = b.join('\n')
  }
  paint()
  const id = setInterval(paint, 260)
  ;(box                                           )._cleanup = () => clearInterval(id)
  box.appendChild(colA); box.appendChild(colB)
  host.appendChild(box)
}

const makeCoreScreen = (
  id        , title        , subtitle        , frameTitle        , frameStatus        ,
  shape               , extra



    ,
)         => ({
  id, title, subtitle, theme: extra.theme ?? 'blood',
  build(s) {
    const out       = []
    statusbar(s, frameStatus)
    coreFrame(s, frameTitle, `ACCESS LV-K // MK · CORE ${(36 + (Math.random() * 3) | 0)}.${(Math.random() * 9) | 0}C`, (inner) => {
      const w = widgetHost('naked'); w.style.display = 'flex'; w.style.justifyContent = 'center'
      inner.appendChild(w)
      out.push(creature3d({
        host: w,
        w: 200, h: 180,
        shape,
        samples: extra.samples ?? 30,
        flapFreq: extra.flapFreq ?? 0.8,
        flapAmp: extra.flapAmp ?? 0.4,
        spinSpeed: extra.spinSpeed ?? 0.2,
        tumble: extra.tumble ?? false,
        scale: extra.scale ?? 36,
        withCore: extra.withCore ?? false,
      }))
    })
    dualNum(s, extra.rows ?? 6)
    return out
  },
})

const S41_CORE         = makeCoreScreen(
  '41', 'CORE STABILITY', 'CUSHION WITH CENTER', 'CORE STABILITY', 'NOISE 06DB QUIET',
  'core', { withCore: true, tumble: true, spinSpeed: 0.14, flapAmp: 0.3, samples: 32, rows: 8, theme: 'blood' },
)

const S42_MANTA         = makeCoreScreen(
  '42', 'MANTA SCAN', 'WING FLAP 0.6HZ', 'MANTA · SCAN', 'OCEAN SIM // PRESSURE 3.2',
  'manta', { flapFreq: 0.6, flapAmp: 0.55, spinSpeed: 0.14, scale: 40, samples: 34, rows: 6, theme: 'ice' },
)

const S43_WHALE         = makeCoreScreen(
  '43', 'WHALE PROBE', 'FLUKE OSC', 'WHALE · PROBE', 'DEPTH 2140M // DARK',
  'whale', { flapFreq: 0.4, flapAmp: 0.6, spinSpeed: 0.1, tumble: true, scale: 30, samples: 30, rows: 6, theme: 'ice' },
)

const S44_WING         = makeCoreScreen(
  '44', 'WING TEST', 'ISO · SINGLE FOIL', 'WING · ISO', 'MACH 0.37 // ANGLE 06°',
  'wing', { flapFreq: 0.9, flapAmp: 0.5, spinSpeed: 0.22, scale: 38, samples: 32, rows: 5, theme: 'mono' },
)

const S45_BLOB         = makeCoreScreen(
  '45', 'ALIEN BLOB', 'UNKNOWN SPECIMEN', 'SUBJ · BLOB-07', 'SIG 0.83 // DRIFT 12MS',
  'blob', { flapFreq: 0.7, flapAmp: 0.6, spinSpeed: 0.16, tumble: true, scale: 36, samples: 30, rows: 7, theme: 'blood' },
)

const S46_TORUS         = makeCoreScreen(
  '46', 'TORUS LOCK', 'RING GEOMETRY', 'RING · GEO',  'LOCK // PH 04',
  'torus', { spinSpeed: 0.28, tumble: true, scale: 44, samples: 30, rows: 6, theme: 'mono' },
)

const S47_SQUID         = makeCoreScreen(
  '47', 'SQUID IDX', 'TENTACLE CURL', 'SQUID · IDX', 'DEEP // 3820M',
  'squid', { flapFreq: 0.9, flapAmp: 0.7, spinSpeed: 0.15, scale: 34, samples: 32, rows: 6, theme: 'ice' },
)

const S48_TWIN         = {
  id: '48', title: 'TWIN MANTAS', subtitle: 'PAIR DRIFT', theme: 'ice',
  build(s) {
    const out       = []
    statusbar(s, 'PAIR')
    const frame = el('div','frame')
    const t = el('div','frame-title'); t.textContent = 'TWIN · MANTAS'
    const st = el('div','frame-status'); st.textContent = 'MID COLUMN · DRIFT'
    const bd = el('div','frame-badge'); const cr = el('div','fc-br')
    frame.append(t, st, bd, cr)
    const row = el('div'); row.style.display='flex'; row.style.alignItems='center'; row.style.justifyContent='center'; row.style.padding='14px 4px 6px'; row.style.gap='6px'
    frame.appendChild(row)
    const w1 = widgetHost('naked'); row.appendChild(w1)
    out.push(creature3d({ host: w1, w: 110, h: 100, shape: 'manta', flapFreq: 0.55, flapAmp: 0.5, spinSpeed: 0.14, scale: 22, samples: 24 }))
    const w2 = widgetHost('naked'); row.appendChild(w2)
    out.push(creature3d({ host: w2, w: 110, h: 100, shape: 'manta', flapFreq: 0.7, flapAmp: 0.55, spinSpeed: -0.18, scale: 22, samples: 24, seed: 3 }))
    s.appendChild(frame)
    dualNum(s, 5)
    return out
  },
}

const S49_CHORUS         = {
  id: '49', title: 'WING CHORUS', subtitle: 'FOUR FOILS', theme: 'mono',
  build(s) {
    const out       = []
    statusbar(s, 'CHORUS')
    const frame = el('div','frame')
    const t = el('div','frame-title'); t.textContent = 'WING · CHORUS · 4×'
    const st = el('div','frame-status'); st.textContent = 'PHASE OFFSET 90°'
    const bd = el('div','frame-badge'); const cr = el('div','fc-br')
    frame.append(t, st, bd, cr)
    const grid = el('div'); grid.style.display='grid'; grid.style.gridTemplateColumns='1fr 1fr'; grid.style.gap='4px'; grid.style.padding='14px 6px 6px'
    frame.appendChild(grid)
    for (let i = 0; i < 4; i++) {
      const w = widgetHost('naked'); w.style.display='flex'; w.style.justifyContent='center'; grid.appendChild(w)
      out.push(creature3d({
        host: w, w: 120, h: 80,
        shape: 'wing',
        flapFreq: 0.7 + i * 0.1,
        flapAmp: 0.45,
        spinSpeed: 0.18,
        scale: 22,
        samples: 22,
        seed: i * 0.9,
      }))
    }
    s.appendChild(frame)
    dualNum(s, 4)
    return out
  },
}

const S50_CORE_FULL         = {
  id: '50', title: 'CORE · FULL STACK', subtitle: 'GRAND DECK', theme: 'blood',
  build(s) {
    const out       = []
    statusbar(s, 'CORE MAX')
    coreFrame(s, 'CORE · STABILITY · 50', 'NOISE 06DB // SYNC 99%', (inner) => {
      const w = widgetHost('naked'); w.style.display='flex'; w.style.justifyContent='center'
      inner.appendChild(w)
      out.push(creature3d({ host: w, w: 240, h: 200, shape: 'core', withCore: true, tumble: true, spinSpeed: 0.12, flapAmp: 0.4, samples: 36, scale: 48 }))
    })
    const row = el('div','row'); s.appendChild(row)
    const hb = widgetHost(); hb.style.flex='1'; hb.style.padding='4px'; row.appendChild(hb)
    out.push(hBars({ host: hb, w: 180, rows: 3, seed: 50 }))
    const eq = widgetHost(); row.appendChild(eq)
    out.push(eqBars({ host: eq, bars: 12, barW: 3, gap: 1, h: 26, seed: 50 }))
    dualNum(s, 5)
    return out
  },
}

export const SCREENS           = [
  S01_OSC, S02_DIAG, S03_EYE, S04_CORE, S05_STEPS,
  S06_DECK, S07_WAVES, S08_BIO, S09_DENSE, S10_MIN,
  S11_STATS, S12_DUAL, S13_LAB, S14_SPIN, S15_ALIGN,
  S16_DECK, S17_LAB2, S18_FULL, S19_STUDIO, S20_HELIX,
  S21_CNT, S22_ICON, S23_CODES, S24_MAND, S25_TIMERS,
  S26_FULL, S27_MIXED, S28_PULSE, S29_TWINS, S30_BIG,
  S31_BIOSCROLL, S32_HELIX_REEL, S33_FLIP, S34_STACK, S35_COUNTSEQ,
  S36_MIN, S37_ALPHA, S38_ICON_TAPE, S39_INSTRU, S40_ALL,
  S41_CORE, S42_MANTA, S43_WHALE, S44_WING, S45_BLOB,
  S46_TORUS, S47_SQUID, S48_TWIN, S49_CHORUS, S50_CORE_FULL,
]
