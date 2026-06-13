const RASTER_SCALE = 4

/**
 * Process an uploaded image file and return imageSrc + rasterSrc.
 * Works for both SVG and raster images.
 * @param {File} file
 * @returns {Promise<{ imageSrc: string, rasterSrc: string, isSvg: boolean }>}
 */
export default function processImageUpload(file, { recolor = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Not an image file'))
      return
    }

    const isSvg = file.type === 'image/svg+xml'

    if (isSvg) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const rawText = event.target.result
        const svgText = recolor
          ? rawText.replace(/fill="(?!none)[^"]*"/gi, 'fill="currentColor"')
          : rawText
        const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
        const svgUrl = URL.createObjectURL(blob)

        // Read as data URL for storage
        const imageSrc = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText)

        // Rasterize
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = (img.naturalWidth || 1024) * RASTER_SCALE
          canvas.height = (img.naturalHeight || 1024) * RASTER_SCALE
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          URL.revokeObjectURL(svgUrl)
          resolve({ imageSrc, rasterSrc: canvas.toDataURL('image/png'), isSvg: true })
        }
        img.onerror = () => {
          URL.revokeObjectURL(svgUrl)
          reject(new Error('Failed to load SVG'))
        }
        img.src = svgUrl
      }
      reader.readAsText(file)
    } else {
      const reader = new FileReader()
      reader.onload = (event) => {
        const dataUrl = event.target.result
        resolve({ imageSrc: dataUrl, rasterSrc: dataUrl, isSvg: false })
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    }
  })
}
