import { useMemo } from 'react'

export default function useSvgDistortion({
  svgSource,
  activeMode,
  amount,
  frequency,
  smoothness,
  seed,
  previewMode,
}) {
  return useMemo(() => {
    const ensureBackground = (svg, color) => {
      const existing = svg.querySelector('rect[data-kol-bg="true"]')
      if (existing) return
      const viewBox = svg.getAttribute('viewBox')
      let x = 0
      let y = 0
      let width = svg.getAttribute('width')
      let height = svg.getAttribute('height')
      if (viewBox) {
        const parts = viewBox.split(/\s+/).map(Number)
        if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
          x = parts[0]
          y = parts[1]
          width = parts[2]
          height = parts[3]
        }
      }
      if (!width || !height) {
        width = width || 800
        height = height || 800
      }
      const rect = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'rect')
      rect.setAttribute('data-kol-bg', 'true')
      rect.setAttribute('x', String(x))
      rect.setAttribute('y', String(y))
      rect.setAttribute('width', String(width))
      rect.setAttribute('height', String(height))
      rect.setAttribute('fill', color)
      svg.insertBefore(rect, svg.firstChild)
    }

    const buildSegments = (points, closed) => {
      if (points.length < 2) return []
      const alpha = 0.5
      const segments = []
      const segmentCount = closed ? points.length : points.length - 1
      const getPoint = (index) => {
        if (closed) return points[(index + points.length) % points.length]
        if (index < 0) return points[0]
        if (index >= points.length) return points[points.length - 1]
        return points[index]
      }
      const getT = (t, p0, p1) => {
        const dx = p1.x - p0.x
        const dy = p1.y - p0.y
        const dist = Math.hypot(dx, dy)
        return t + Math.pow(dist, alpha)
      }
      for (let i = 0; i < segmentCount; i += 1) {
        const p0 = getPoint(i - 1)
        const p1 = getPoint(i)
        const p2 = getPoint(i + 1)
        const p3 = getPoint(i + 2)
        let t0 = 0
        let t1 = getT(t0, p0, p1)
        let t2 = getT(t1, p1, p2)
        let t3 = getT(t2, p2, p3)
        if (t1 === t0) t1 = t0 + 1
        if (t2 === t1) t2 = t1 + 1
        if (t3 === t2) t3 = t2 + 1

        const m1x = ((p2.x - p0.x) / (t2 - t0)) * (t1 - t0)
        const m1y = ((p2.y - p0.y) / (t2 - t0)) * (t1 - t0)
        const m2x = ((p3.x - p1.x) / (t3 - t1)) * (t2 - t1)
        const m2y = ((p3.y - p1.y) / (t3 - t1)) * (t2 - t1)

        segments.push({
          p1: { x: p1.x, y: p1.y },
          cp1: { x: p1.x + m1x / 3, y: p1.y + m1y / 3 },
          cp2: { x: p2.x - m2x / 3, y: p2.y - m2y / 3 },
          p2: { x: p2.x, y: p2.y },
        })
      }
      return segments
    }

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

    const buildSvg = (mode, includeBackground = false, includeSegments = false) => {
      if (!svgSource.trim()) {
        return { html: '', error: '', nodeCount: 0, baseNodes: 0 }
      }

      const parser = new DOMParser()
      const doc = parser.parseFromString(svgSource, 'image/svg+xml')
      if (doc.querySelector('parsererror')) {
        return { html: '', error: 'Invalid SVG markup.', nodeCount: 0, baseNodes: 0 }
      }

      const svg = doc.documentElement
      const ns = 'http://www.w3.org/2000/svg'
      const geometrySelector = 'path, rect, circle, ellipse, line, polyline, polygon'
      const geometryElements = Array.from(svg.querySelectorAll(geometrySelector))
      const closedTags = new Set(['rect', 'circle', 'ellipse', 'polygon'])

      const random = (value) => {
        const x = Math.sin(value) * 10000
        return x - Math.floor(x)
      }

      const getBaseNodes = (element) => {
        const tag = element.tagName.toLowerCase()
        if (tag === 'rect') return 4
        if (tag === 'line') return 2
        if (tag === 'circle' || tag === 'ellipse') return 4
        if (tag === 'polygon' || tag === 'polyline') {
          const points = element.getAttribute('points') || ''
          const coords = points
            .trim()
            .replace(/,/g, ' ')
            .split(/\s+/)
            .filter(Boolean)
          return Math.floor(coords.length / 2)
        }
        if (tag === 'path') {
          const d = element.getAttribute('d') || ''
          const commands = d.match(/[MLCQSTA]/gi) || []
          return Math.max(1, commands.length)
        }
        return 0
      }

      const isClosedShape = (element) => {
        const tag = element.tagName.toLowerCase()
        if (closedTags.has(tag)) return true
        if (tag === 'path') {
          const d = element.getAttribute('d') || ''
          return /z/i.test(d)
        }
        return false
      }

      const getModeOffset = (index, t, strength, freq) => {
        const base = random(seed + index * 12.9898)
        const alt = random(seed * 2.133 + index * 78.233)
        const centeredA = base - 0.5
        const centeredB = alt - 0.5
        const phase = (t * freq * 2 + seed * 0.1) * Math.PI

        if (activeMode.id === 'noise') {
          return {
            dx: Math.sin(phase) * strength,
            dy: Math.cos(phase) * strength,
          }
        }

        if (activeMode.id === 'jitter') {
          return { dx: centeredA * strength, dy: centeredB * strength }
        }

        if (activeMode.id === 'hand') {
          return {
            dx: Math.sin(phase * 0.6) * strength * 0.8,
            dy: Math.sin(phase * 0.9) * strength * 0.8,
          }
        }

        if (activeMode.id === 'roughen') {
          const stepA = Math.round(centeredA * 4) / 4
          const stepB = Math.round(centeredB * 4) / 4
          return { dx: stepA * strength * 1.2, dy: stepB * strength * 1.2 }
        }

        if (activeMode.id === 'tear') {
          const saw = (t * freq * 0.6) % 1
          const spike = base > 0.86 ? 1.8 : 1
          return {
            dx: (saw - 0.5) * strength * 2.2 * spike,
            dy: centeredB * strength * 0.6 * spike,
          }
        }

        if (activeMode.id === 'ink-spread') {
          return {
            dx: centeredA * strength * 0.4,
            dy: centeredB * strength * 0.4,
          }
        }

        if (activeMode.id === 'offset') {
          const angle = (seed % 360) * (Math.PI / 180)
          return {
            dx: Math.cos(angle) * strength * 0.6 + centeredA * strength * 0.2,
            dy: Math.sin(angle) * strength * 0.6 + centeredB * strength * 0.2,
          }
        }

        const spike = base > 0.9 ? 1.7 : 0.9
        return { dx: centeredA * strength * spike, dy: centeredB * strength * spike }
      }

      let baseNodeCount = 0
      let generatedNodeCount = 0
      const needsBake = mode === 'bake' && amount > 0
      const paths = []

      if (mode === 'filter') {
        const defs = doc.createElementNS(ns, 'defs')
        const filter = doc.createElementNS(ns, 'filter')
        filter.setAttribute('id', 'edgeDistort')
        filter.setAttribute('x', '-50%')
        filter.setAttribute('y', '-50%')
        filter.setAttribute('width', '200%')
        filter.setAttribute('height', '200%')

        const baseFrequency = Math.max(0.002, frequency / 800)
        const scale = Math.max(0, amount * 1.1)
        const octaves = Math.max(1, Math.round(1 + smoothness / 45))

        const turbulence = doc.createElementNS(ns, 'feTurbulence')
        turbulence.setAttribute(
          'type',
          activeMode.id === 'noise' ? 'fractalNoise' : 'turbulence',
        )
        turbulence.setAttribute('baseFrequency', baseFrequency.toFixed(4))
        turbulence.setAttribute('numOctaves', String(octaves))
        turbulence.setAttribute('seed', String(seed))
        turbulence.setAttribute('result', 'noise')
        filter.appendChild(turbulence)

        const displacement = doc.createElementNS(ns, 'feDisplacementMap')
        displacement.setAttribute('in', 'SourceGraphic')
        displacement.setAttribute('in2', 'noise')
        displacement.setAttribute('scale', String(scale))
        displacement.setAttribute('xChannelSelector', 'R')
        displacement.setAttribute('yChannelSelector', 'G')
        displacement.setAttribute('result', 'distort')
        filter.appendChild(displacement)

        if (activeMode.id === 'ink-spread') {
          const blur = doc.createElementNS(ns, 'feGaussianBlur')
          blur.setAttribute('in', 'distort')
          blur.setAttribute('stdDeviation', (amount / 18 + 0.6).toFixed(2))
          blur.setAttribute('result', 'blur')
          filter.appendChild(blur)

          const merge = doc.createElementNS(ns, 'feMerge')
          const nodeA = doc.createElementNS(ns, 'feMergeNode')
          nodeA.setAttribute('in', 'blur')
          const nodeB = doc.createElementNS(ns, 'feMergeNode')
          nodeB.setAttribute('in', 'distort')
          merge.appendChild(nodeA)
          merge.appendChild(nodeB)
          filter.appendChild(merge)
        }

        if (activeMode.id === 'offset') {
          const offset = doc.createElementNS(ns, 'feOffset')
          offset.setAttribute('in', 'distort')
          offset.setAttribute('dx', (amount / 8 + 1).toFixed(1))
          offset.setAttribute('dy', (amount / 12 + 0.5).toFixed(1))
          offset.setAttribute('result', 'offset')
          filter.appendChild(offset)

          const merge = doc.createElementNS(ns, 'feMerge')
          const nodeA = doc.createElementNS(ns, 'feMergeNode')
          nodeA.setAttribute('in', 'distort')
          const nodeB = doc.createElementNS(ns, 'feMergeNode')
          nodeB.setAttribute('in', 'offset')
          merge.appendChild(nodeA)
          merge.appendChild(nodeB)
          filter.appendChild(merge)
        }

        defs.appendChild(filter)

        const nodesToWrap = Array.from(svg.childNodes).filter(
          (node) => node.nodeType === 1 && node.nodeName.toLowerCase() !== 'defs',
        )
        const group = doc.createElementNS(ns, 'g')
        nodesToWrap.forEach((node) => group.appendChild(node))
        if (nodesToWrap.length > 0) {
          group.setAttribute('filter', 'url(#edgeDistort)')
        }

        svg.setAttribute('overflow', 'visible')
        svg.insertBefore(defs, svg.firstChild)
        if (nodesToWrap.length > 0) {
          svg.appendChild(group)
        }
      }

      geometryElements.forEach((element, index) => {
        if (typeof element.getTotalLength !== 'function') return
        let length = 0
        try {
          length = element.getTotalLength()
        } catch (error) {
          return
        }
        if (!Number.isFinite(length) || length <= 0) return

        const baseNodes = getBaseNodes(element)
        baseNodeCount += baseNodes

        if (!needsBake) {
          return
        }

        const baseSpacing = Math.max(6, 70 - Math.min(50, frequency) * 1.2)
        const extraFrequency = Math.max(0, frequency - 50)
        const spacing = Math.max(2, baseSpacing - extraFrequency * 0.3)
        const sampleCount = Math.min(
          2000,
          Math.max(baseNodes || 4, Math.round(length / spacing)),
        )
        generatedNodeCount += sampleCount

        const strength = Math.max(0, amount)
        const freq = Math.max(
          1,
          frequency <= 50 ? frequency / 6 : 50 / 6 + extraFrequency / 8,
        )
        const basePoints = []
        const offsets = []
        const closed = isClosedShape(element)
        for (let i = 0; i < sampleCount; i += 1) {
          const t = sampleCount === 1 ? 0 : closed ? i / sampleCount : i / (sampleCount - 1)
          const point = element.getPointAtLength(length * t)
          const offset = getModeOffset(i + index * 1000, t, strength, freq)
          basePoints.push({ x: point.x, y: point.y })
          offsets.push({ x: offset.dx, y: offset.dy })
        }

        let finalOffsets = offsets
        if (smoothness > 0) {
          const window = Math.max(1, Math.round(smoothness / 30))
          const smoothOffsets = offsets.map((_, idx) => {
            let sumX = 0
            let sumY = 0
            let count = 0
            for (let step = -window; step <= window; step += 1) {
              let sampleIndex = idx + step
              if (closed) {
                sampleIndex = (sampleIndex + offsets.length) % offsets.length
              } else {
                if (sampleIndex < 0 || sampleIndex >= offsets.length) continue
              }
              sumX += offsets[sampleIndex].x
              sumY += offsets[sampleIndex].y
              count += 1
            }
            return { x: sumX / count, y: sumY / count }
          })
          finalOffsets = smoothOffsets
        }

        const points = basePoints.map((point, idx) => ({
          x: point.x + finalOffsets[idx].x,
          y: point.y + finalOffsets[idx].y,
        }))

        const path = doc.createElementNS(ns, 'path')
        const segments = buildSegments(points, closed)
        const d = segmentsToPath(segments, closed)
        path.setAttribute('d', d)

        Array.from(element.attributes).forEach((attr) => {
          const name = attr.name
          if (
            [
              'd',
              'points',
              'x',
              'y',
              'width',
              'height',
              'cx',
              'cy',
              'r',
              'rx',
              'ry',
              'x1',
              'y1',
              'x2',
              'y2',
            ].includes(name)
          ) {
            return
          }
          path.setAttribute(name, attr.value)
        })

        if (includeSegments) {
          paths.push({
            id: `${element.tagName}-${index}`,
            closed,
            segments,
            attrs: {
              fill: element.getAttribute('fill') || '#ffffff',
              stroke: element.getAttribute('stroke') || 'none',
              strokeWidth: element.getAttribute('stroke-width') || '0',
            },
          })
        }

        element.replaceWith(path)
      })

      if (!needsBake) {
        if (includeBackground) {
          ensureBackground(svg, '#121215')
        }
        const serialized = new XMLSerializer().serializeToString(svg)
        return {
          html: serialized,
          error: '',
          nodeCount: baseNodeCount,
          baseNodes: baseNodeCount,
          paths: includeSegments ? paths : undefined,
          viewBox: svg.getAttribute('viewBox') || null,
          width: svg.getAttribute('width') || null,
          height: svg.getAttribute('height') || null,
        }
      }

      svg.setAttribute('overflow', 'visible')
      if (includeBackground) {
        ensureBackground(svg, '#121215')
      }
      const serialized = new XMLSerializer().serializeToString(svg)
      return {
        html: serialized,
        error: '',
        nodeCount: generatedNodeCount,
        baseNodes: baseNodeCount,
        paths: includeSegments ? paths : undefined,
        viewBox: svg.getAttribute('viewBox') || null,
        width: svg.getAttribute('width') || null,
        height: svg.getAttribute('height') || null,
      }
    }

    const previewResult = buildSvg(previewMode)
    if (previewMode === 'bake') {
      const exportResult = buildSvg('bake', false, true)
      return { ...previewResult, exportHtml: exportResult.html, exportData: exportResult }
    }
    const exportResult = buildSvg('bake', false, true)
    return { ...previewResult, exportHtml: exportResult.html, exportData: exportResult }
  }, [svgSource, activeMode.id, amount, frequency, smoothness, seed, previewMode])
}
