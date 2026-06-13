import Button from '../../../components/atoms/Button.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import Textarea from '../../../components/atoms/Textarea.jsx'
import Section from '../../../components/molecules/Section.jsx'

function ControlsPanel({
  svgInput,
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
  previewMode,
  onToggleMode,
  onExport,
  onRefine,
}) {
  return (
    <section className="w-full">
      <Section label="Controls">
        <div className="grid gap-4">
          <Section label="Upload SVG">
            <input
              type="file"
              accept=".svg"
              onChange={onUpload}
              className="kol-mono-12 w-full rounded border border-fg-08 px-3 py-2 file:mr-3 file:rounded file:border-0 file:bg-[var(--kol-fg-08)] file:px-3 file:py-2 file:text-[10px] file:uppercase file:tracking-[0.1em] file:text-[var(--kol-fg-88)]"
            />
          </Section>
          <Section label="Paste SVG code">
            <Textarea
              rows={6}
              size="sm"
              placeholder="<svg>...</svg>"
              value={svgInput}
              onChange={onPasteChange}
            />
          </Section>
          <Slider
            label="Amount"
            min={0}
            max={50}
            step={1}
            value={amount}
            onChange={setAmount}
            className="w-full"
          />
          <Slider
            label="Frequency"
            min={1}
            max={50}
            step={1}
            value={frequency}
            onChange={setFrequency}
            className="w-full"
          />
          <Slider
            label="Smoothness"
            min={0}
            max={300}
            step={1}
            value={smoothness}
            onChange={setSmoothness}
            className="w-full"
          />
          <Slider
            label="Seed"
            min={0}
            max={1000}
            step={1}
            value={seed}
            onChange={setSeed}
            className="w-full"
          />
          {typeof zoom === 'number' && typeof setZoom === 'function' ? (
            <Slider
              label="Zoom"
              min={0.2}
              max={3}
              step={0.05}
              value={zoom}
              onChange={setZoom}
              formatValue={(value) => `${value.toFixed(2)}×`}
              className="w-full"
            />
          ) : null}
          {typeof objectScale === 'number' &&
          typeof setObjectScale === 'function' ? (
            <Slider
              label="Scale"
              min={0.2}
              max={3}
              step={0.05}
              value={objectScale}
              onChange={setObjectScale}
              formatValue={(value) => `${value.toFixed(2)}×`}
              className="w-full"
            />
          ) : null}
        </div>
      </Section>
      <div className="mt-6 flex flex-wrap gap-3 border-t border-fg-08 pt-4">
        {onRefine ? (
          <Button variant="outline" size="sm" onClick={onRefine} className="bg-surface-primary border-fg-08">
            Refine SVG
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onClick={onToggleMode} className="bg-surface-primary border-fg-08">
          {previewMode === 'bake' ? 'Mode: Bake' : 'Mode: Filter'}
        </Button>
        <Button variant="outline" size="sm" className="bg-surface-primary border-fg-08">
          Toggle Original
        </Button>
        <Button variant="outline" size="sm" onClick={onExport} className="bg-surface-primary border-fg-08">
          Export SVG
        </Button>
      </div>
    </section>
  )
}

export default ControlsPanel
