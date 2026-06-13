/* SVG filter <defs> + registry.
 *
 * Each filter is identified by an `id` matching the registry key, e.g.
 * `fx-gooey`, `fx-neon`. Apply with `filter="url(#fx-gooey)"` on a <g>.
 *
 * Pure visual chain — no JS state. Animate inputs by toggling the filter
 * `id` reference, or by binding sliders to filter attributes when present
 * (we expose key knobs through props). */

export const FX_PRESETS = [
  { id: 'none',     label: 'none',     filterId: null },
  { id: 'weight',   label: 'weight',   filterId: 'fx-weight' },
  { id: 'roughen',  label: 'roughen',  filterId: 'fx-roughen' },
  { id: 'gooey',    label: 'gooey',    filterId: 'fx-gooey' },
  { id: 'neon',     label: 'neon',     filterId: 'fx-neon' },
  { id: 'glow',     label: 'glow',     filterId: 'fx-glow' },
  { id: 'shadow',   label: 'shadow',   filterId: 'fx-shadow' },
  { id: 'emboss',   label: 'emboss',   filterId: 'fx-emboss' },
  { id: 'squiggle', label: 'squiggle', filterId: 'fx-squiggle' },
  { id: 'distress', label: 'distress', filterId: 'fx-distress' },
  { id: 'rgb',      label: 'rgb-split',filterId: 'fx-rgb' },
  { id: 'sketch',   label: 'sketch',   filterId: 'fx-sketch' },
]

export function FilterDefs({
  weightFx = 0,         /* feMorphology radius (negative = erode) */
  roughenAmount = 0,    /* feDisplacementMap scale for roughen */
  roughenFreq = 0.05,   /* feTurbulence baseFrequency for roughen */
  roughenSeed = 1,      /* feTurbulence seed */
  glowColor = 'currentColor',
}) {
  return (
    <defs>
      {/* ── universal weight via feMorphology ── */}
      <filter id="fx-weight" x="-20%" y="-20%" width="140%" height="140%">
        <feMorphology
          in="SourceGraphic"
          operator={weightFx >= 0 ? 'dilate' : 'erode'}
          radius={Math.abs(weightFx)}
        />
      </filter>

      {/* ── roughen ── displaces glyph with turbulence noise ── */}
      <filter id="fx-roughen" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency={roughenFreq} numOctaves="2" seed={roughenSeed} result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale={roughenAmount * 20} xChannelSelector="R" yChannelSelector="G" />
      </filter>

      {/* ── gooey ── */}
      <filter id="fx-gooey" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
        <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
        <feComposite in="SourceGraphic" in2="goo" operator="atop" />
      </filter>

      {/* ── neon ── stacked blurs tinted then merged ── */}
      <filter id="fx-neon" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2"  result="b1" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="6"  result="b2" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="b3" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="24" result="b4" />
        <feMerge>
          <feMergeNode in="b4" />
          <feMergeNode in="b3" />
          <feMergeNode in="b2" />
          <feMergeNode in="b1" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* ── glow ── softer version ── */}
      <filter id="fx-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* ── shadow stack ── soft + sharp ── */}
      <filter id="fx-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="sharp" />
        <feOffset in="sharp" dx="1" dy="2" result="sharpOff" />
        <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="soft" />
        <feOffset in="soft" dx="3" dy="6" result="softOff" />
        <feMerge>
          <feMergeNode in="softOff" />
          <feMergeNode in="sharpOff" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* ── emboss via convolve ── */}
      <filter id="fx-emboss" x="-20%" y="-20%" width="140%" height="140%">
        <feConvolveMatrix order="3 3" kernelMatrix="1 0 0  0 1 0  0 0 -1" preserveAlpha="true" />
      </filter>

      {/* ── squiggle ── low-freq turbulence + medium displacement ── */}
      <filter id="fx-squiggle" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="1" result="t" />
        <feDisplacementMap in="SourceGraphic" in2="t" scale="6" xChannelSelector="R" yChannelSelector="G" />
      </filter>

      {/* ── distress ── high-freq fine grain ── */}
      <filter id="fx-distress" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="t" />
        <feDisplacementMap in="SourceGraphic" in2="t" scale="2" xChannelSelector="R" yChannelSelector="G" />
      </filter>

      {/* ── chromatic / rgb-split ── three channel-isolated copies offset ── */}
      <filter id="fx-rgb" x="-20%" y="-20%" width="140%" height="140%">
        <feColorMatrix in="SourceGraphic" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
        <feColorMatrix in="SourceGraphic" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
        <feColorMatrix in="SourceGraphic" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
        <feOffset in="r" dx="-3" dy="0" result="rOff" />
        <feOffset in="b" dx="3"  dy="0" result="bOff" />
        <feBlend in="rOff" in2="g"    mode="screen" result="rg" />
        <feBlend in="rg"   in2="bOff" mode="screen" />
      </filter>

      {/* ── sketch ── edge-only via convolve high-pass, lighter ink ── */}
      <filter id="fx-sketch" x="-20%" y="-20%" width="140%" height="140%">
        <feConvolveMatrix order="3 3" kernelMatrix="-1 -1 -1  -1 8 -1  -1 -1 -1" preserveAlpha="true" />
      </filter>
    </defs>
  )
}
