import { useRef } from 'react'
import Button from '../../../components/atoms/Button.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import Textarea from '../../../components/atoms/Textarea.jsx'
import ToggleCheckbox from '../../../components/atoms/ToggleCheckbox.jsx'
import Section from '../../../components/molecules/Section.jsx'

function ControlsPanel({
  svgInput,
  svgFileName,
  onUpload,
  onPasteChange,
  amount,
  setAmount,
  frequency,
  setFrequency,
  smoothness,
  setSmoothness,
  seed,
  setSeed,
  zoom,
  setZoom,
  objectScale,
  setObjectScale,
  showGrid,
  setShowGrid,
  previewMode,
  onToggleMode,
  onExport,
  onRefine,
}) {
  const fileRef = useRef(null)

  return (
    <>
      <Section label="Source">
        <input
          ref={fileRef}
          type="file"
          accept=".svg"
          onChange={onUpload}
          className="hidden"
        />
        <Button variant="primary" size="sm" className="w-full" onClick={() => fileRef.current?.click()}>
          Browse SVG…
        </Button>
        {svgFileName ? <p className="kol-mono-10 text-meta">{svgFileName}</p> : null}
        <Textarea
          rows={6}
          size="sm"
          placeholder="<svg>…</svg>"
          value={svgInput}
          onChange={onPasteChange}
        />
      </Section>

      <Section label="Distortion">
        <Slider labeled label="Amount" min={0} max={50} step={1} value={amount} onChange={setAmount} className="w-full" />
        <Slider labeled label="Frequency" min={1} max={50} step={1} value={frequency} onChange={setFrequency} className="w-full" />
        <Slider labeled label="Smoothness" min={0} max={300} step={1} value={smoothness} onChange={setSmoothness} className="w-full" />
        <Slider labeled label="Seed" min={0} max={1000} step={1} value={seed} onChange={setSeed} className="w-full" />
      </Section>

      <Section label="View">
        {typeof zoom === 'number' && typeof setZoom === 'function' ? (
          <Slider labeled label="Zoom" min={0.2} max={3} step={0.05} value={zoom} onChange={setZoom} formatValue={(v) => `${v.toFixed(2)}×`} className="w-full" />
        ) : null}
        {typeof objectScale === 'number' && typeof setObjectScale === 'function' ? (
          <Slider labeled label="Scale" min={0.2} max={3} step={0.05} value={objectScale} onChange={setObjectScale} formatValue={(v) => `${v.toFixed(2)}×`} className="w-full" />
        ) : null}
        <ToggleCheckbox label="grid overlay" checked={showGrid} onChange={setShowGrid} />
      </Section>

      <div className="flex flex-col gap-2">
        {onRefine ? (
          <Button variant="primary" size="sm" className="w-full" onClick={onRefine}>Refine SVG</Button>
        ) : null}
        <Button variant="primary" size="sm" className="w-full" onClick={onToggleMode}>
          {previewMode === 'bake' ? 'Mode: Bake' : 'Mode: Filter'}
        </Button>
        <Button variant="primary" size="sm" className="w-full" onClick={onExport}>Export SVG</Button>
      </div>
    </>
  )
}

export default ControlsPanel
