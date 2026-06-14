import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SegmentedToggle from '../../../components/molecules/SegmentedToggle.jsx'
import EditorRail, { RailHeader } from '../../../components/framework/EditorRail.jsx'
import ModesPanel from '../components/ModesPanel.jsx'
import PreviewPanel from '../components/PreviewPanel.jsx'
import ControlsPanel from '../components/ControlsPanel.jsx'
import useSvgDistortion from '../hooks/useSvgDistortion.js'
import GridOverlay from '../components/GridOverlay.jsx'

function MainPage() {
  const navigate = useNavigate()
  const [railTab, setRailTab] = useState('modes')
  const modes = useMemo(
    () => [
      {
        id: 'print-press',
        name: 'Print press distress',
        blurb:
          'Ragged edge erosion with small paper tears, ink starvation, and uneven pressure.',
        tags: ['edge-erosion', 'ink-break', 'paper-tear'],
      },
      {
        id: 'noise',
        name: 'Noise distortion',
        blurb: 'Organic micro jitter with a randomized edge crawl.',
        tags: ['random-jitter', 'micro-variation'],
      },
      {
        id: 'jitter',
        name: 'Jitter',
        blurb: 'Harder, chunkier wobble with short step offsets.',
        tags: ['step-offsets', 'hard-wobble'],
      },
      {
        id: 'hand',
        name: 'Hand-drawn',
        blurb: 'Loose, sketchy contour with uneven line cadence.',
        tags: ['sketch', 'humanized'],
      },
      {
        id: 'roughen',
        name: 'Roughen',
        blurb: 'Blocky noise breakups that flatten corners and bite edges.',
        tags: ['block-noise', 'corner-bite'],
      },
      {
        id: 'tear',
        name: 'Torn edge',
        blurb: 'Longer irregular notches with a grainy sawtooth.',
        tags: ['notches', 'fiber-grain'],
      },
      {
        id: 'ink-spread',
        name: 'Ink spread',
        blurb: 'Soft bleed and bloom around the outline.',
        tags: ['bleed', 'soft-edge'],
      },
      {
        id: 'offset',
        name: 'Misregister',
        blurb: 'Slight duplicate offset to mimic print plate misalignment.',
        tags: ['double-edge', 'offset'],
      },
    ],
    [],
  )
  const [activeMode, setActiveMode] = useState(modes[0])
  const [svgSource, setSvgSource] = useState('')
  const [svgFileName, setSvgFileName] = useState('')
  const [svgInput, setSvgInput] = useState('')
  const [amount, setAmount] = useState(0)
  const [frequency, setFrequency] = useState(16)
  const [smoothness, setSmoothness] = useState(120)
  const [seed, setSeed] = useState(8)
  const [previewMode, setPreviewMode] = useState('bake')
  const [zoom, setZoom] = useState(1)
  const [objectScale, setObjectScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [showGrid, setShowGrid] = useState(true)

  const preview = useSvgDistortion({
    svgSource,
    activeMode,
    amount,
    frequency,
    smoothness,
    seed,
    previewMode,
  })

  const handleUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (loadEvent) => {
      const text = String(loadEvent.target?.result || '')
      setSvgSource(text)
      setSvgInput(text)
      setSvgFileName(file.name)
    }
    reader.readAsText(file)
  }

  const handlePasteChange = (event) => {
    const text = event.target.value
    setSvgInput(text)
    setSvgSource(text)
    setSvgFileName('')
  }

  const exportRaster = async (svgMarkup) => {
    if (!svgMarkup) return
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgMarkup, 'image/svg+xml')
    const svg = doc.documentElement
    const viewBox = svg.getAttribute('viewBox')
    const widthAttr = svg.getAttribute('width')
    const heightAttr = svg.getAttribute('height')
    let width = widthAttr ? Number(widthAttr) : 0
    let height = heightAttr ? Number(heightAttr) : 0
    if (viewBox) {
      const parts = viewBox.split(/\s+/).map(Number)
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        width = width || parts[2]
        height = height || parts[3]
      }
    }
    if (!width || !height) {
      width = 800
      height = 800
    }
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#121215'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(image, 0, 0, width, height)
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return
        const pngUrl = URL.createObjectURL(pngBlob)
        const link = document.createElement('a')
        link.href = pngUrl
        link.download = svgFileName
          ? svgFileName.replace(/\.svg$/i, '') + '-distorted.png'
          : 'distorted.png'
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(pngUrl)
      })
      URL.revokeObjectURL(url)
    }
    image.src = url
  }

  const handleExport = () => {
    if (previewMode === 'filter') {
      exportRaster(preview.html)
      return
    }
    const exportSvg = preview.exportHtml || preview.html
    if (!exportSvg) return
    const blob = new Blob([exportSvg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = svgFileName
      ? svgFileName.replace(/\.svg$/i, '') + '-distorted.svg'
      : 'distorted.svg'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const handleRefine = () => {
    if (!preview.exportData || previewMode !== 'bake') return
    navigate('/distress/refine', {
      state: {
        bakeData: preview.exportData,
        fileName: svgFileName,
      },
    })
  }

  return (
    <div className="h-dvh bg-surface-primary flex">
      <div className="relative flex-1 min-w-0 overflow-hidden">
        {showGrid && <GridOverlay zoom={zoom} pan={pan} gridSpacing={64} />}
        <div className="relative z-10 flex h-full w-full items-center justify-center">
          <PreviewPanel
            svgSource={svgSource}
            preview={preview}
            allowPan
            zoom={zoom}
            objectScale={objectScale}
            pan={pan}
            setPan={setPan}
          />
        </div>
      </div>

      <EditorRail>
        <RailHeader>Distress</RailHeader>
        <SegmentedToggle
          value={railTab}
          onChange={setRailTab}
          options={[
            { value: 'modes', label: 'Modes' },
            { value: 'controls', label: 'Controls' },
          ]}
        />

        {railTab === 'modes' && (
          <ModesPanel
            modes={modes}
            activeMode={activeMode}
            onSelectMode={setActiveMode}
          />
        )}

        {railTab === 'controls' && (
        <ControlsPanel
          svgInput={svgInput}
          svgFileName={svgFileName}
          onUpload={handleUpload}
          onPasteChange={handlePasteChange}
          amount={amount}
          setAmount={setAmount}
          frequency={frequency}
          setFrequency={setFrequency}
          smoothness={smoothness}
          setSmoothness={setSmoothness}
          seed={seed}
          setSeed={setSeed}
          zoom={zoom}
          setZoom={setZoom}
          objectScale={objectScale}
          setObjectScale={setObjectScale}
          showGrid={showGrid}
          setShowGrid={setShowGrid}
          previewMode={previewMode}
          onToggleMode={() =>
            setPreviewMode((mode) => (mode === 'bake' ? 'filter' : 'bake'))
          }
          onExport={handleExport}
          onRefine={previewMode === 'bake' ? handleRefine : null}
        />
        )}
      </EditorRail>
    </div>
  )
}

export default MainPage
