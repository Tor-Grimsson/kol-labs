import Dropdown from '../../components/molecules/Dropdown.jsx'
import LabeledControl from '../../components/molecules/LabeledControl.jsx'
import Section from '../../components/molecules/Section.jsx'
import { SCALE_OPTIONS, FIT_OPTIONS, ratioFor } from './exportSpecs.js'

/**
 * ExportPanel — the shared "Frame + Export" rail cluster used by every page that
 * exports a framed image/video (math views, 3D/primitive scenes, radar raster).
 * Replaces the ~8 hand-wired copies of the same two Section + Dropdown blocks.
 *
 *   <ExportPanel aspect={aspect} onAspect={setAspect} aspects={VIEW_ASPECTS}
 *                scale={scale} onScale={setScale}
 *                fit={fit} onFit={setFit}>     // fit optional (radar only)
 *     <Button onClick={exportPng}>Export PNG</Button>   // page-specific actions
 *   </ExportPanel>
 *
 * Scale (and fit) are hidden on the native row ("Fill"/"Source", ratio:null)
 * because @Nx is ignored there — only the aspect + the action buttons show.
 */
export default function ExportPanel({
  aspect, onAspect, aspects,
  scale, onScale,
  fit, onFit,
  frameLabel = 'Aspect',
  hideScale = false, // native-res pages (e.g. Penrose) export at canvas size → no @Nx scale
  openUp = true, // the export cluster always sits at the rail bottom → open upward so the menu never clips off-screen
  children,
}) {
  const native = ratioFor(aspect) == null || hideScale
  return (
    <>
      <Section label={frameLabel}>
        <Dropdown
          size="sm"
          variant="subtle"
          className="w-full"
          openUp={openUp}
          options={aspects.map((a) => ({ value: a.value ?? a.id, label: a.label }))}
          value={aspect}
          onChange={onAspect}
        />
      </Section>

      <Section label="Export">
        {!native && (
          <LabeledControl inline label="scale">
            <Dropdown size="sm" variant="subtle" className="w-full" openUp={openUp} options={SCALE_OPTIONS} value={scale} onChange={onScale} />
          </LabeledControl>
        )}
        {!native && onFit && (
          <LabeledControl inline label="fit">
            <Dropdown size="sm" variant="subtle" className="w-full" openUp={openUp} options={FIT_OPTIONS} value={fit} onChange={onFit} />
          </LabeledControl>
        )}
        {children}
      </Section>
    </>
  )
}
