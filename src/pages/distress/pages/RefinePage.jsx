import { useEffect, useMemo, useRef, useState } from 'react'
import paper from 'paper'
import { SketchPicker } from 'react-color'
import { useLocation, useNavigate } from 'react-router-dom'
import Button from '../../../components/atoms/Button.jsx'
import ColorSwatch from '../../../components/atoms/ColorSwatch.jsx'
import Slider from '../../../components/atoms/Slider.jsx'
import ToggleCheckbox from '../../../components/atoms/ToggleCheckbox.jsx'
import Section from '../../../components/molecules/Section.jsx'
import { Tooltip } from '../../../components/molecules/Popover.jsx'
import Icon from '../../../components/loaders/Icon.jsx'
import EditorRail from '../../../components/framework/EditorRail.jsx'
import GridOverlay from '../components/GridOverlay'

const clonePaths = (inputPaths) =>
  (inputPaths || []).map((path) => ({
    ...path,
    segments: (path.segments || []).map((segment) => ({
      ...segment,
      p1: { ...segment.p1 },
      p2: { ...segment.p2 },
      cp1: { ...segment.cp1 },
      cp2: { ...segment.cp2 },
    })),
    attrs: { ...path.attrs },
  }))

const normalizePaths = (inputPaths, offset) =>
  (inputPaths || []).map((path) => ({
    ...path,
    segments: (path.segments || []).map((segment) => ({
      ...segment,
      p1: {
        x: segment.p1.x + offset.x,
        y: segment.p1.y + offset.y,
      },
      p2: {
        x: segment.p2.x + offset.x,
        y: segment.p2.y + offset.y,
      },
      cp1: {
        x: segment.cp1.x + offset.x,
        y: segment.cp1.y + offset.y,
      },
      cp2: {
        x: segment.cp2.x + offset.x,
        y: segment.cp2.y + offset.y,
      },
    })),
    attrs: {
      ...path.attrs,
      fillOpacity: path.attrs?.fillOpacity ?? 0.1,
      strokeOpacity: path.attrs?.strokeOpacity ?? 0.1,
    },
  }))

const toHexColor = (value, fallback) => {
  if (!value) return fallback
  if (value.startsWith('#')) return value
  if (value.startsWith('rgb')) {
    const parts = value.match(/\d+/g)
    if (!parts) return value
    return (
      '#' +
      parts
        .slice(0, 3)
        .map((part) => parseInt(part, 10).toString(16).padStart(2, '0'))
        .join('')
    )
  }
  return value
}

const normalizeHexInput = (value, fallback) => {
  if (!value) return fallback
  if (value.startsWith('#')) return value
  return `#${value}`
}

const applyCurveTension = (segments, tension) =>
  segments.map((segment) => ({
    ...segment,
    cp1: {
      x: segment.p1.x + (segment.cp1.x - segment.p1.x) * tension,
      y: segment.p1.y + (segment.cp1.y - segment.p1.y) * tension,
    },
    cp2: {
      x: segment.p2.x + (segment.cp2.x - segment.p2.x) * tension,
      y: segment.p2.y + (segment.cp2.y - segment.p2.y) * tension,
    },
  }))

const invertTensionPoint = (point, anchor, tension) => ({
  x: anchor.x + (point.x - anchor.x) / tension,
  y: anchor.y + (point.y - anchor.y) / tension,
})

const decimatePaths = (sourcePaths, density) => {
  const normalized = Math.max(1, Math.min(100, density))
  const step = Math.max(1, Math.round(100 / normalized))
  return sourcePaths.map((path) => {
    const segments = path.segments.filter((_, index) => index % step === 0)
    const safeSegments = segments.length >= 4 ? segments : path.segments
    return { ...path, segments: safeSegments }
  })
}

const normalizeStrokeWidth = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 1
}

const pathItemToSegments = (item) => {
  const segments = item.segments || []
  if (!segments.length) return []
  const result = []
  const count = segments.length
  const segmentCount = item.closed ? count : count - 1
  for (let index = 0; index < segmentCount; index += 1) {
    const current = segments[index]
    const next = segments[(index + 1) % count]
    result.push({
      p1: { x: current.point.x, y: current.point.y },
      cp1: {
        x: current.point.x + current.handleOut.x,
        y: current.point.y + current.handleOut.y,
      },
      p2: { x: next.point.x, y: next.point.y },
      cp2: {
        x: next.point.x + next.handleIn.x,
        y: next.point.y + next.handleIn.y,
      },
    })
  }
  return result
}

const createCircleSegments = (cx, cy, radius) => {
  const kappa = 0.5522847498
  const control = radius * kappa
  return [
    {
      p1: { x: cx, y: cy - radius },
      cp1: { x: cx + control, y: cy - radius },
      p2: { x: cx + radius, y: cy },
      cp2: { x: cx + radius, y: cy - control },
    },
    {
      p1: { x: cx + radius, y: cy },
      cp1: { x: cx + radius, y: cy + control },
      p2: { x: cx, y: cy + radius },
      cp2: { x: cx + control, y: cy + radius },
    },
    {
      p1: { x: cx, y: cy + radius },
      cp1: { x: cx - control, y: cy + radius },
      p2: { x: cx - radius, y: cy },
      cp2: { x: cx - radius, y: cy + control },
    },
    {
      p1: { x: cx - radius, y: cy },
      cp1: { x: cx - radius, y: cy - control },
      p2: { x: cx, y: cy - radius },
      cp2: { x: cx - control, y: cy - radius },
    },
  ]
}

function RefinePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const initialData = location.state?.bakeData || null
  const fallbackData = useMemo(
    () => ({
      width: 800,
      height: 800,
      viewBox: '0 0 800 800',
      paths: [
        {
          id: 'fallback-circle',
          segments: createCircleSegments(0, 0, 180),
          closed: true,
          attrs: {
            fill: '#ffffff',
            stroke: '#000000',
            fillOpacity: 0.1,
            strokeOpacity: 0.1,
            strokeWidth: 1,
          },
        },
      ],
    }),
    [],
  )
  const resolvedData = initialData || fallbackData
  const originalPathsRef = useRef([])
  const basePathsRef = useRef([])
  const [paths, setPaths] = useState(() => basePathsRef.current)
  const pathsRef = useRef(paths)
  const [dragState, setDragState] = useState(null)
  const dragChangedRef = useRef(false)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(0.8)
  const [isPanning, setIsPanning] = useState(false)
  const [spaceDown, setSpaceDown] = useState(false)
  const [showNodes, setShowNodes] = useState(true)
  const [showHandles, setShowHandles] = useState(true)
  const [mirrorMode, setMirrorMode] = useState('disconnected')
  const [resolution, setResolution] = useState(100)
  const resolutionRef = useRef(100)
  const [curveTension, setCurveTension] = useState(1)
  const [showFillPicker, setShowFillPicker] = useState(false)
  const [showStrokePicker, setShowStrokePicker] = useState(false)
  const fillPickerRef = useRef(null)
  const strokePickerRef = useRef(null)
  const [fillEnabled, setFillEnabled] = useState(
    resolvedData?.paths?.[0]?.attrs?.fill !== 'none',
  )
  const [strokeEnabled, setStrokeEnabled] = useState(
    resolvedData?.paths?.[0]?.attrs?.stroke &&
      resolvedData?.paths?.[0]?.attrs?.stroke !== 'none' &&
      resolvedData?.paths?.[0]?.attrs?.strokeWidth !== '0',
  )
  const [fillColor, setFillColor] = useState(
    resolvedData?.paths?.[0]?.attrs?.fill || '#ffffff',
  )
  const [strokeColor, setStrokeColor] = useState(
    resolvedData?.paths?.[0]?.attrs?.stroke || '#000000',
  )
  const [fillOpacity, setFillOpacity] = useState(
    Number(resolvedData?.paths?.[0]?.attrs?.fillOpacity ?? 0.1),
  )
  const [strokeOpacity, setStrokeOpacity] = useState(
    Number(resolvedData?.paths?.[0]?.attrs?.strokeOpacity ?? 0.1),
  )
  const [strokeWidth, setStrokeWidth] = useState(() =>
    normalizeStrokeWidth(resolvedData?.paths?.[0]?.attrs?.strokeWidth ?? 1),
  )
  const [nodeSize, setNodeSize] = useState(2.5)
  const [handleSize, setHandleSize] = useState(2)
  const [linkHandles, setLinkHandles] = useState(false)
  const svgRef = useRef(null)
  const historyRef = useRef({ stack: [], index: -1 })
  const [historyMeta, setHistoryMeta] = useState({ index: -1, length: 0 })


  const viewBoxSize = useMemo(() => {
    if (resolvedData.viewBox) {
      const parts = resolvedData.viewBox.split(/\s+/).map(Number)
      if (parts.length === 4 && parts.every((value) => !Number.isNaN(value))) {
        return {
          width: parts[2],
          height: parts[3],
        }
      }
    }
    return {
      width: resolvedData.width || 800,
      height: resolvedData.height || 800,
    }
  }, [resolvedData])

  const viewBox = useMemo(
    () =>
      `${-viewBoxSize.width / 2} ${-viewBoxSize.height / 2} ${viewBoxSize.width} ${viewBoxSize.height}`,
    [viewBoxSize],
  )

  useEffect(() => {
    const offset = {
      x: -(viewBoxSize.width / 2),
      y: -(viewBoxSize.height / 2),
    }
    const normalized = normalizePaths(resolvedData?.paths || [], offset).map(
      (path) => ({
        ...path,
        attrs: {
          ...path.attrs,
          strokeWidth: 1,
        },
      }),
    )
    originalPathsRef.current = clonePaths(normalized)
    basePathsRef.current = normalized
    setPaths(normalized)
    const initialAttrs = normalized[0]?.attrs || {}
    setFillColor(initialAttrs.fill || '#ffffff')
    setStrokeColor(initialAttrs.stroke || '#000000')
    setFillOpacity(Number(initialAttrs.fillOpacity ?? 0.1))
    setStrokeOpacity(Number(initialAttrs.strokeOpacity ?? 0.1))
    setStrokeWidth(1)
    setFillEnabled(true)
    setStrokeEnabled(true)
    historyRef.current = { stack: [clonePaths(normalized)], index: 0 }
    setHistoryMeta({ index: 0, length: 1 })
  }, [resolvedData, viewBoxSize])

  useEffect(() => {
    pathsRef.current = paths
  }, [paths])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'Space') {
        if (
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLButtonElement
        ) {
          return
        }
        event.preventDefault()
        setSpaceDown(true)
      }
    }
    const handleKeyUp = (event) => {
      if (event.code === 'Space') {
        event.preventDefault()
        setSpaceDown(false)
        setIsPanning(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const segmentsToPath = (segments, closed) => {
    if (!segments.length) return ''
    const start = segments[0].p1
    const parts = [
      `M ${start.x.toFixed(3)} ${start.y.toFixed(3)}`,
      ...segments.map(
        (segment) =>
          `C ${segment.cp1.x.toFixed(3)} ${segment.cp1.y.toFixed(3)} ${segment.cp2.x.toFixed(3)} ${segment.cp2.y.toFixed(3)} ${segment.p2.x.toFixed(3)} ${segment.p2.y.toFixed(3)}`,
      ),
    ]
    return `${parts.join(' ')}${closed ? ' Z' : ''}`
  }

  const getSvgPoint = (event) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const inverted = ctm.inverse()
    const local = point.matrixTransform(inverted)
    return { x: local.x, y: local.y }
  }

  const getCanvasPoint = (event) => {
    const local = getSvgPoint(event)
    return {
      x: (local.x - pan.x) / zoom,
      y: (local.y - pan.y) / zoom,
    }
  }

  const updatePaths = (pathIndex, updater) => {
    setPaths((prev) =>
      prev.map((path, idx) => (idx === pathIndex ? updater(path) : path)),
    )
  }

  const pushHistory = (nextPaths) => {
    const cloned = clonePaths(nextPaths)
    const stack = historyRef.current.stack.slice(0, historyRef.current.index + 1)
    stack.push(cloned)
    historyRef.current = { stack, index: stack.length - 1 }
    setHistoryMeta({ index: stack.length - 1, length: stack.length })
  }

  const syncUiFromPaths = (nextPaths) => {
    const nextAttrs = nextPaths[0]?.attrs || {}
    setFillColor(nextAttrs.fill || '#ffffff')
    setStrokeColor(nextAttrs.stroke || '#000000')
    setFillOpacity(Number(nextAttrs.fillOpacity ?? 0.1))
    setStrokeOpacity(Number(nextAttrs.strokeOpacity ?? 0.1))
    setStrokeWidth(normalizeStrokeWidth(nextAttrs.strokeWidth ?? 1))
    setFillEnabled(true)
    setStrokeEnabled(true)
  }

  const handleUndo = () => {
    const { stack, index } = historyRef.current
    if (index <= 0) return
    const nextIndex = index - 1
    const snapshot = clonePaths(stack[nextIndex])
    historyRef.current.index = nextIndex
    setHistoryMeta({ index: nextIndex, length: stack.length })
    setPaths(snapshot)
    basePathsRef.current = clonePaths(snapshot)
    syncUiFromPaths(snapshot)
  }

  const handleRedo = () => {
    const { stack, index } = historyRef.current
    if (index >= stack.length - 1) return
    const nextIndex = index + 1
    const snapshot = clonePaths(stack[nextIndex])
    historyRef.current.index = nextIndex
    setHistoryMeta({ index: nextIndex, length: stack.length })
    setPaths(snapshot)
    basePathsRef.current = clonePaths(snapshot)
    syncUiFromPaths(snapshot)
  }

  const handlePointerMove = (event) => {
    if (!dragState) return
    const { pathIndex, segmentIndex, handle } = dragState
    const current = getCanvasPoint(event)
    const safeTension = Math.max(0.2, curveTension)
    const lastPoint = dragState.last || dragState.start
    const delta = {
      x: current.x - lastPoint.x,
      y: current.y - lastPoint.y,
    }
    updatePaths(pathIndex, (path) => {
      const segments = path.segments.map((segment) => ({
        ...segment,
        p1: { ...segment.p1 },
        p2: { ...segment.p2 },
        cp1: { ...segment.cp1 },
        cp2: { ...segment.cp2 },
      }))
      const segment = segments[segmentIndex]
      if (!segment) return path

      if (handle === 'p1') {
        const dx = current.x - segment.p1.x
        const dy = current.y - segment.p1.y
        segment.p1 = { x: current.x, y: current.y }
        segment.cp1 = { x: segment.cp1.x + dx, y: segment.cp1.y + dy }
        if (path.closed) {
          const prevIndex = (segmentIndex - 1 + segments.length) % segments.length
          const prev = segments[prevIndex]
          prev.p2 = { x: current.x, y: current.y }
          prev.cp2 = { x: prev.cp2.x + dx, y: prev.cp2.y + dy }
        } else if (segmentIndex > 0) {
          const prev = segments[segmentIndex - 1]
          prev.p2 = { x: current.x, y: current.y }
          prev.cp2 = { x: prev.cp2.x + dx, y: prev.cp2.y + dy }
        }
      } else if (handle === 'p2') {
        const dx = current.x - segment.p2.x
        const dy = current.y - segment.p2.y
        segment.p2 = { x: current.x, y: current.y }
        segment.cp2 = { x: segment.cp2.x + dx, y: segment.cp2.y + dy }
        if (path.closed) {
          const nextIndex = (segmentIndex + 1) % segments.length
          const next = segments[nextIndex]
          next.p1 = { x: current.x, y: current.y }
          next.cp1 = { x: next.cp1.x + dx, y: next.cp1.y + dy }
        } else if (segmentIndex < segments.length - 1) {
          const next = segments[segmentIndex + 1]
          next.p1 = { x: current.x, y: current.y }
          next.cp1 = { x: next.cp1.x + dx, y: next.cp1.y + dy }
        }
      } else if (handle === 'cp1') {
        const baseCp1 = invertTensionPoint(current, segment.p1, safeTension)
        segment.cp1 = { x: baseCp1.x, y: baseCp1.y }
        const anchor = segment.p1
        if (mirrorMode !== 'disconnected') {
          const oppositeIndex = path.closed ? (segmentIndex - 1 + segments.length) % segments.length : segmentIndex - 1
          const opposite = segments[oppositeIndex]
          if (opposite) {
            const vector = { x: baseCp1.x - anchor.x, y: baseCp1.y - anchor.y }
            const length = Math.hypot(vector.x, vector.y) || 1
            const unit = { x: vector.x / length, y: vector.y / length }
            const oppositeLength = Math.hypot(
              opposite.cp2.x - anchor.x,
              opposite.cp2.y - anchor.y,
            )
            const mirrorLength = mirrorMode === 'mirror-angle' ? oppositeLength : length
            opposite.cp2 = {
              x: anchor.x - unit.x * mirrorLength,
              y: anchor.y - unit.y * mirrorLength,
            }
          }
        }
      } else if (handle === 'cp2') {
        const baseCp2 = invertTensionPoint(current, segment.p2, safeTension)
        segment.cp2 = { x: baseCp2.x, y: baseCp2.y }
        const anchor = segment.p2
        if (mirrorMode !== 'disconnected') {
          const oppositeIndex = path.closed ? (segmentIndex + 1) % segments.length : segmentIndex + 1
          const opposite = segments[oppositeIndex]
          if (opposite) {
            const vector = { x: baseCp2.x - anchor.x, y: baseCp2.y - anchor.y }
            const length = Math.hypot(vector.x, vector.y) || 1
            const unit = { x: vector.x / length, y: vector.y / length }
            const oppositeLength = Math.hypot(
              opposite.cp1.x - anchor.x,
              opposite.cp1.y - anchor.y,
            )
            const mirrorLength = mirrorMode === 'mirror-angle' ? oppositeLength : length
            opposite.cp1 = {
              x: anchor.x - unit.x * mirrorLength,
              y: anchor.y - unit.y * mirrorLength,
            }
          }
        }
      }

      if (linkHandles && (handle === 'cp1' || handle === 'cp2')) {
        segments.forEach((seg, idx) => {
          if (idx === segmentIndex) return
          if (handle === 'cp1') {
            seg.cp1 = { x: seg.cp1.x + delta.x, y: seg.cp1.y + delta.y }
          } else if (handle === 'cp2') {
            seg.cp2 = { x: seg.cp2.x + delta.x, y: seg.cp2.y + delta.y }
          }
        })
      }

      dragChangedRef.current = true
      return { ...path, segments }
    })
    setDragState((prev) => (prev ? { ...prev, last: current } : prev))
  }

  const handlePointerUp = () => {
    if (dragState && dragState.handle !== 'pan' && dragChangedRef.current) {
      pushHistory(pathsRef.current)
      basePathsRef.current = clonePaths(pathsRef.current)
      dragChangedRef.current = false
    }
    setDragState(null)
  }

  const isInteractiveTarget = (target) => {
    if (!target || typeof target.closest !== 'function') return false
    return target.closest('.distress-node, .distress-handle')
  }

  const getHandleMeta = (target) => {
    if (!target || typeof target.closest !== 'function') return null
    const el = target.closest('.distress-node, .distress-handle')
    if (!el) return null
    const pathIndex = Number(el.dataset.pathIndex)
    const segmentIndex = Number(el.dataset.segmentIndex)
    const handle = el.dataset.handleType
    if (Number.isNaN(pathIndex) || Number.isNaN(segmentIndex) || !handle) {
      return null
    }
    return { pathIndex, segmentIndex, handle }
  }

  const handlePanStart = (event) => {
    if (!spaceDown) return
    event.preventDefault()
    setIsPanning(true)
    const start = getSvgPoint(event)
    setDragState({ handle: 'pan', start, panStart: pan })
  }

  const handlePanMove = (event) => {
    if (!isPanning || !dragState || dragState.handle !== 'pan') return
    const current = getSvgPoint(event)
    const dx = current.x - dragState.start.x
    const dy = current.y - dragState.start.y
    setPan({
      x: dragState.panStart.x + dx,
      y: dragState.panStart.y + dy,
    })
  }

  const handlePanEnd = () => {
    if (!isPanning) return
    setIsPanning(false)
    setDragState(null)
  }

  const handleWheel = (event) => {
    if (!svgRef.current) return
    event.preventDefault()
    const delta = -event.deltaY
    const zoomFactor = delta > 0 ? 1.08 : 0.92
    const nextZoom = Math.min(4, Math.max(0.2, zoom * zoomFactor))
    setZoom(nextZoom)
  }

  const handleZoomButton = (direction) => {
    const nextZoom = Math.min(4, Math.max(0.2, zoom + direction * 0.1))
    setZoom(nextZoom)
  }

  const applyColor = (type, value) => {
    setPaths((prev) => {
      const next = prev.map((path) => ({
        ...path,
        attrs: {
          ...path.attrs,
          [type]: value,
        },
      }))
      pushHistory(next)
      return next
    })
  }

  const applyOpacity = (type, value) => {
    setPaths((prev) => {
      const next = prev.map((path) => ({
        ...path,
        attrs: {
          ...path.attrs,
          [type]: value,
        },
      }))
      pushHistory(next)
      return next
    })
  }

  const applyStrokeWidth = (value) => {
    const nextValue = normalizeStrokeWidth(value)
    setStrokeWidth(nextValue)
    setPaths((prev) => {
      const next = prev.map((path) => ({
        ...path,
        attrs: {
          ...path.attrs,
          strokeWidth: nextValue,
        },
      }))
      pushHistory(next)
      return next
    })
  }

  useEffect(() => {
    if (!basePathsRef.current?.length) return
    if (resolutionRef.current === resolution) return
    resolutionRef.current = resolution
    setPaths((prev) => {
      const decimated = decimatePaths(basePathsRef.current, resolution)
      const next = decimated.map((path, idx) => ({
        ...path,
        attrs: {
          ...path.attrs,
          ...prev[idx]?.attrs,
        },
      }))
      pushHistory(next)
      return next
    })
  }, [resolution])

  const handleReset = () => {
    if (!originalPathsRef.current?.length) return
    const resetPaths = clonePaths(originalPathsRef.current)
    basePathsRef.current = clonePaths(originalPathsRef.current)
    setPaths(resetPaths)
    syncUiFromPaths(resetPaths)
    historyRef.current = { stack: [clonePaths(resetPaths)], index: 0 }
    setHistoryMeta({ index: 0, length: 1 })
  }

  const handleUnifyShapes = () => {
    if (paths.length < 2) return
    const scope = new paper.PaperScope()
    scope.setup(new scope.Size(viewBoxSize.width, viewBoxSize.height))
    let united = null
    displayPaths.forEach((path) => {
      const pathData = segmentsToPath(path.segments, path.closed)
      const paperPath = new scope.Path(pathData)
      paperPath.closed = path.closed
      if (!united) {
        united = paperPath
      } else {
        const result = united.unite(paperPath)
        united.remove()
        paperPath.remove()
        united = result
      }
    })
    if (!united) return
    const items = united instanceof scope.CompoundPath ? united.children : [united]
    const baseAttrs = paths[0]?.attrs || {}
    const unifiedPaths = items.map((item, idx) => ({
      id: `unified-${idx}`,
      segments: pathItemToSegments(item),
      closed: item.closed,
      attrs: { ...baseAttrs },
    }))
    setPaths(unifiedPaths)
    basePathsRef.current = clonePaths(unifiedPaths)
    pushHistory(unifiedPaths)
  }

  const handleExport = () => {
    if (!displayPaths.length) return
    const doc = document.implementation.createDocument(
      'http://www.w3.org/2000/svg',
      'svg',
      null,
    )
    const svg = doc.documentElement
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    svg.setAttribute('viewBox', viewBox)
    if (resolvedData?.width) svg.setAttribute('width', resolvedData.width)
    if (resolvedData?.height) svg.setAttribute('height', resolvedData.height)

    displayPaths.forEach((path) => {
      const pathEl = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
      const d = segmentsToPath(path.segments, path.closed)
      pathEl.setAttribute('d', d)
      pathEl.setAttribute('fill', fillEnabled ? path.attrs?.fill || '#ffffff' : 'none')
      if (path.attrs?.fillOpacity != null) {
        pathEl.setAttribute('fill-opacity', path.attrs?.fillOpacity)
      }
      pathEl.setAttribute('stroke', strokeEnabled ? path.attrs?.stroke || '#000000' : 'none')
      pathEl.setAttribute('stroke-width', strokeEnabled ? strokeWidth : '0')
      if (path.attrs?.strokeOpacity != null) {
        pathEl.setAttribute('stroke-opacity', path.attrs?.strokeOpacity)
      }
      svg.appendChild(pathEl)
    })

    const svgString = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([svgString], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'refined.svg'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const handleCopySvg = async () => {
    if (!displayPaths.length || !navigator?.clipboard) return
    const doc = document.implementation.createDocument(
      'http://www.w3.org/2000/svg',
      'svg',
      null,
    )
    const svg = doc.documentElement
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    svg.setAttribute('viewBox', viewBox)
    if (resolvedData?.width) svg.setAttribute('width', resolvedData.width)
    if (resolvedData?.height) svg.setAttribute('height', resolvedData.height)

    displayPaths.forEach((path) => {
      const pathEl = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
      const d = segmentsToPath(path.segments, path.closed)
      pathEl.setAttribute('d', d)
      pathEl.setAttribute('fill', fillEnabled ? path.attrs?.fill || '#ffffff' : 'none')
      if (path.attrs?.fillOpacity != null) {
        pathEl.setAttribute('fill-opacity', path.attrs?.fillOpacity)
      }
      pathEl.setAttribute('stroke', strokeEnabled ? path.attrs?.stroke || '#000000' : 'none')
      pathEl.setAttribute('stroke-width', strokeEnabled ? strokeWidth : '0')
      if (path.attrs?.strokeOpacity != null) {
        pathEl.setAttribute('stroke-opacity', path.attrs?.strokeOpacity)
      }
      svg.appendChild(pathEl)
    })

    const svgString = new XMLSerializer().serializeToString(svg)
    await navigator.clipboard.writeText(svgString)
  }

  const handleCopyPath = async () => {
    if (!displayPaths.length || !navigator?.clipboard) return
    const pathData = displayPaths
      .map((path) => segmentsToPath(path.segments, path.closed))
      .join('\n')
    await navigator.clipboard.writeText(pathData)
  }

  const displayPaths = useMemo(
    () =>
      paths.map((path) => ({
        ...path,
        segments: applyCurveTension(path.segments, Math.max(0.2, curveTension)),
      })),
    [paths, curveTension],
  )

  const metrics = useMemo(() => {
    let nodes = 0
    let controlPoints = 0
    displayPaths.forEach((path) => {
      const count = path.closed ? path.segments.length : path.segments.length + 1
      nodes += count
      controlPoints += count * 2
    })
    return { nodes, controlPoints, paths: displayPaths.length }
  }, [displayPaths])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showFillPicker &&
        fillPickerRef.current &&
        !fillPickerRef.current.contains(event.target)
      ) {
        setShowFillPicker(false)
      }
      if (
        showStrokePicker &&
        strokePickerRef.current &&
        !strokePickerRef.current.contains(event.target)
      ) {
        setShowStrokePicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showFillPicker, showStrokePicker])

  return (
    <div className="h-dvh bg-surface-primary flex">
      <div className="relative flex-1 min-w-0 overflow-hidden">
        {(() => {
          return (
            <>
              <GridOverlay zoom={zoom} pan={pan} gridSpacing={64} />
              <div className="relative z-10 flex h-full w-full items-center justify-center">
                <svg
                  ref={svgRef}
                  viewBox={viewBox}
                  className={`h-full w-full ${isPanning ? 'cursor-grabbing' : spaceDown ? 'cursor-grab' : 'cursor-default'}`}
                  onPointerDown={(event) => {
                    const meta = getHandleMeta(event.target)
                    if (spaceDown && !isInteractiveTarget(event.target)) {
                      handlePanStart(event)
                      svgRef.current?.setPointerCapture?.(event.pointerId)
                      return
                    }
                    if (!meta) return
                    event.preventDefault()
                    event.stopPropagation()
                    const start = getCanvasPoint(event)
                    setDragState({ ...meta, start })
                    svgRef.current?.setPointerCapture?.(event.pointerId)
                  }}
                  onPointerMove={(event) => {
                    if (dragState?.handle === 'pan') {
                      handlePanMove(event)
                    } else if (dragState) {
                      handlePointerMove(event)
                    }
                  }}
                  onPointerUp={(event) => {
                    handlePanEnd()
                    handlePointerUp()
                    if (svgRef.current?.hasPointerCapture?.(event.pointerId)) {
                      svgRef.current?.releasePointerCapture?.(event.pointerId)
                    }
                  }}
                  onPointerLeave={(event) => {
                    handlePanEnd()
                    handlePointerUp()
                    if (svgRef.current?.hasPointerCapture?.(event.pointerId)) {
                      svgRef.current?.releasePointerCapture?.(event.pointerId)
                    }
                  }}
                  onWheel={handleWheel}
                >
                  <rect width="100%" height="100%" fill="transparent" />
                  <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                    {displayPaths.map((path, pathIndex) => (
                      <g key={path.id}>
                        <path
                          d={segmentsToPath(path.segments, path.closed)}
                          fill={fillEnabled ? path.attrs?.fill || '#ffffff' : 'none'}
                          fillOpacity={path.attrs?.fillOpacity ?? 0.1}
                          stroke={
                            strokeEnabled
                              ? path.attrs?.stroke || '#000000'
                              : 'none'
                          }
                          strokeOpacity={path.attrs?.strokeOpacity ?? 0.1}
                          strokeWidth={strokeEnabled ? strokeWidth : 0}
                        />
                        {path.segments.map((segment, segIndex) => (
                          <g key={`${path.id}-handles-${segIndex}`}>
                            {showHandles ? (
                              <>
                                <line
                                  x1={segment.p1.x}
                                  y1={segment.p1.y}
                                  x2={segment.cp1.x}
                                  y2={segment.cp1.y}
                                  stroke="var(--kol-border-strong)"
                                  strokeWidth="1"
                                  strokeDasharray="3 3"
                                />
                                <line
                                  x1={segment.p2.x}
                                  y1={segment.p2.y}
                                  x2={segment.cp2.x}
                                  y2={segment.cp2.y}
                                  stroke="var(--kol-border-strong)"
                                  strokeWidth="1"
                                  strokeDasharray="3 3"
                                />
                                <circle
                                  cx={segment.cp1.x}
                                  cy={segment.cp1.y}
                                  r={handleSize}
                                  className="distress-handle cursor-move"
                                  data-path-index={pathIndex}
                                  data-segment-index={segIndex}
                                  data-handle-type="cp1"
                                  fill="#ffffff"
                                />
                                <circle
                                  cx={segment.cp2.x}
                                  cy={segment.cp2.y}
                                  r={handleSize}
                                  className="distress-handle cursor-move"
                                  data-path-index={pathIndex}
                                  data-segment-index={segIndex}
                                  data-handle-type="cp2"
                                  fill="#ffffff"
                                />
                              </>
                            ) : null}
                            {showNodes ? (
                              <>
                                <circle
                                  cx={segment.p1.x}
                                  cy={segment.p1.y}
                                  r={nodeSize}
                                  className="distress-node cursor-move"
                                  data-path-index={pathIndex}
                                  data-segment-index={segIndex}
                                  data-handle-type="p1"
                                  fill="#ffffff"
                                />
                                <circle
                                  cx={segment.p2.x}
                                  cy={segment.p2.y}
                                  r={nodeSize}
                                  className="distress-node cursor-move"
                                  data-path-index={pathIndex}
                                  data-segment-index={segIndex}
                                  data-handle-type="p2"
                                  fill="#ffffff"
                                />
                              </>
                            ) : null}
                          </g>
                        ))}
                      </g>
                    ))}
                  </g>
                </svg>
              </div>
              <div className="absolute left-0 top-0 z-20 flex flex-col gap-2">
                {[
                  {
                    label: 'Back',
                    onClick: () => navigate('/distress'),
                    icon: 'chevron-left',
                    tone: 'light',
                  },
                  {
                    label: 'Undo',
                    onClick: handleUndo,
                    disabled: historyMeta.index <= 0,
                    icon: 'undo',
                    tone: 'dark',
                  },
                  {
                    label: 'Redo',
                    onClick: handleRedo,
                    disabled: historyMeta.index >= historyMeta.length - 1,
                    icon: 'redo',
                    tone: 'dark',
                  },
                  {
                    label: 'Zoom out',
                    onClick: () => handleZoomButton(-1),
                    icon: 'zoom-out',
                    tone: 'light',
                  },
                  {
                    label: 'Zoom in',
                    onClick: () => handleZoomButton(1),
                    icon: 'zoom-in',
                    tone: 'light',
                  },
                  {
                    label: 'Unify',
                    onClick: handleUnifyShapes,
                    disabled: paths.length < 2,
                    icon: 'layers',
                    tone: 'dark',
                  },
                ].map((action) => (
                  <Tooltip key={action.label} label={action.label} placement="right">
                    <button
                      type="button"
                      onClick={action.onClick}
                      disabled={action.disabled}
                      className={`w-12 h-12 flex items-center justify-center rounded border border-auto transition disabled:opacity-40 ${
                        action.tone === 'light'
                          ? 'bg-surface-inverse'
                          : 'bg-surface-primary'
                      }`}
                      aria-label={action.label}
                    >
                      <Icon name={action.icon} size={24} />
                    </button>
                  </Tooltip>
                ))}
              </div>
              <div className="absolute bottom-0 left-0 z-20 flex flex-col gap-4">
                <div className="kol-mono-12 flex flex-col gap-1 rounded border border-fg-08 bg-surface-primary p-3">
                  <div>
                    <span className="kol-mono-12 uppercase tracking-[0.06em]">
                      Nodes:
                    </span>{' '}
                    {metrics.nodes}
                  </div>
                  <div>
                    <span className="kol-mono-12 uppercase tracking-[0.06em]">
                      Control Points:
                    </span>{' '}
                    {metrics.controlPoints}
                  </div>
                  <div>
                    <span className="kol-mono-12 uppercase tracking-[0.06em]">
                      Optimality:
                    </span>{' '}
                    {metrics.paths > 1 ? 'Multiple paths' : 'Perfect symmetry'}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleExport}
                    className="bg-surface-primary border-fg-08"
                  >
                    Download SVG
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleCopyPath}
                    className="bg-surface-primary border-fg-08"
                  >
                    Copy Path
                  </Button>
                </div>
              </div>
            </>
          )
        })()}
      </div>

      <EditorRail>
                  <Section label="Refine tools">
                    <Slider
                      label="Resolution"
                      min={10}
                      max={100}
                      value={resolution}
                      onChange={setResolution}
                      step={1}
                      variant="default"
                      className="w-full"
                    />
                    <Slider
                      label="Smoothness"
                      min={0.2}
                      max={2}
                      value={curveTension}
                      onChange={setCurveTension}
                      step={0.05}
                      variant="default"
                      className="w-full"
                    />
                    <Slider
                      label="Stroke width"
                      min={0}
                      max={12}
                      value={strokeWidth}
                      onChange={applyStrokeWidth}
                      step={0.1}
                      variant="default"
                      className="w-full"
                    />
                    <Slider
                      label="Node size"
                      min={1}
                      max={8}
                      value={nodeSize}
                      onChange={setNodeSize}
                      step={0.5}
                      variant="default"
                      className="w-full"
                    />
                    <Slider
                      label="Handle size"
                      min={1}
                      max={8}
                      value={handleSize}
                      onChange={setHandleSize}
                      step={0.5}
                      variant="default"
                      className="w-full"
                    />
                  </Section>
                  <Section label="Visualization">
                    <div className="grid grid-cols-2 gap-2">
                      <ToggleCheckbox
                        label="Nodes"
                        checked={showNodes}
                        onChange={setShowNodes}
                      />
                      <ToggleCheckbox
                        label="Handles"
                        checked={showHandles}
                        onChange={setShowHandles}
                      />
                    </div>
                  </Section>
                  <Section label="Bezier mirroring">
                    <div className="grid grid-cols-2 gap-2">
                      <ToggleCheckbox
                        label="Disconnected"
                        checked={mirrorMode === 'disconnected'}
                        onChange={() => setMirrorMode('disconnected')}
                      />
                      <ToggleCheckbox
                        label="Mirror angle"
                        checked={mirrorMode === 'mirror-angle'}
                        onChange={() => setMirrorMode('mirror-angle')}
                      />
                      <ToggleCheckbox
                        label="Mirror angle + length"
                        checked={mirrorMode === 'mirror-angle-length'}
                        onChange={() => setMirrorMode('mirror-angle-length')}
                        className="col-span-2"
                      />
                    </div>
                  </Section>
                  <Section label="Handle link edit">
                    <ToggleCheckbox
                      label="Link same-side handles"
                      checked={linkHandles}
                      onChange={setLinkHandles}
                    />
                  </Section>
                  <section className="flex items-start gap-8">
                    <div className="flex flex-col gap-3 relative flex-1" ref={strokePickerRef}>
                      <Section label="PATH COLOR" />
                      <div className="flex items-center gap-2">
                        <ColorSwatch
                          hex={strokeColor}
                          size={32}
                          radius="full"
                          showTransparent={!strokeEnabled}
                          transparentTone="error"
                          aria-haspopup="dialog"
                          aria-expanded={showStrokePicker}
                          onClick={(event) => {
                            if (event.altKey) {
                              setStrokeEnabled((prev) => !prev)
                            } else {
                              setShowStrokePicker((prev) => !prev)
                            }
                          }}
                        />
                        <span className="kol-mono-12">
                          {strokeColor.startsWith('rgba')
                            ? '#' +
                              strokeColor
                                .match(/\d+/g)
                                .slice(0, 3)
                                .map((x) =>
                                  parseInt(x, 10)
                                    .toString(16)
                                    .padStart(2, '0'),
                                )
                                .join('')
                            : strokeColor}
                        </span>
                      </div>
                      {showStrokePicker && (
                        <div className="absolute left-0 bottom-full z-20 mb-2">
                          <SketchPicker
                            color={strokeColor}
                            presetColors={[]}
                            styles={{
                              default: {
                                picker: {
                                  boxShadow: '0 16px 40px rgba(0, 0, 0, 0.4)',
                                  borderRadius: '12px',
                                  padding: '10px',
                                  background: 'var(--kol-surface-primary)',
                                },
                              },
                            }}
                            onChange={(color) => {
                              const rgba = `rgba(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, ${color.rgb.a})`
                              setStrokeColor(rgba)
                              applyColor('stroke', rgba)
                            }}
                            className="sketch-only-spectrum"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 relative flex-1" ref={fillPickerRef}>
                      <Section label="FILL COLOR" />
                      <div className="flex items-center gap-2">
                        <ColorSwatch
                          hex={fillColor}
                          size={32}
                          radius="full"
                          showTransparent={!fillEnabled}
                          transparentTone="error"
                          aria-haspopup="dialog"
                          aria-expanded={showFillPicker}
                          onClick={(event) => {
                            if (event.altKey) {
                              setFillEnabled((prev) => !prev)
                            } else {
                              setShowFillPicker((prev) => !prev)
                            }
                          }}
                        />
                        <span className="kol-mono-12">
                          {fillColor.startsWith('rgba')
                            ? '#' +
                              fillColor
                                .match(/\d+/g)
                                .slice(0, 3)
                                .map((x) =>
                                  parseInt(x, 10)
                                    .toString(16)
                                    .padStart(2, '0'),
                                )
                                .join('')
                            : fillColor}
                        </span>
                      </div>
                      {showFillPicker && (
                        <div className="absolute left-0 bottom-full z-20 mb-2">
                          <SketchPicker
                            color={fillColor}
                            presetColors={[]}
                            styles={{
                              default: {
                                picker: {
                                  boxShadow: '0 16px 40px rgba(0, 0, 0, 0.4)',
                                  borderRadius: '12px',
                                  padding: '10px',
                                  background: 'var(--kol-surface-primary)',
                                },
                              },
                            }}
                            onChange={(color) => {
                              const rgba = `rgba(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, ${color.rgb.a})`
                              setFillColor(rgba)
                              applyColor('fill', rgba)
                            }}
                            className="sketch-only-spectrum"
                          />
                        </div>
                      )}
                    </div>
                  </section>
      </EditorRail>
    </div>
  )
}

export default RefinePage
