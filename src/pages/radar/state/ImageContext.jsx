import { createContext, useCallback, useContext, useState } from 'react'
import processImageUpload from '../utils/processImageUpload'

/**
 * One uploaded image or video, shared across every effect page (the
 * effects.app model: upload once, apply any effect). Images are decoded
 * HTMLImageElements; video/* files become a muted looping HTMLVideoElement
 * with .width/.height mirrored from the intrinsic size, so a video drops in
 * anywhere an image works (canvas drawImage, GL textures). `isVideo` tells
 * pages to run a per-frame render loop.
 */
const ImageContext = createContext(null)

export function ImageProvider({ children }) {
  const [sourceImage, setSourceImage] = useState(null)
  const [isVideo, setIsVideo] = useState(false)

  const loadImageFromFile = useCallback(async (file) => {
    if (!file) return
    if (file.type.startsWith('video/')) {
      const video = document.createElement('video')
      video.muted = true
      video.loop = true
      video.playsInline = true
      video.onloadedmetadata = () => {
        video.width = video.videoWidth
        video.height = video.videoHeight
        setIsVideo(true)
        setSourceImage(video)
        void video.play()
      }
      video.src = URL.createObjectURL(file)
      return
    }
    try {
      const { rasterSrc } = await processImageUpload(file)
      const img = new Image()
      img.onload = () => { setIsVideo(false); setSourceImage(img) }
      img.src = rasterSrc
    } catch {
      /* not an image — ignore */
    }
  }, [])

  return (
    <ImageContext.Provider value={{ sourceImage, isVideo, loadImageFromFile }}>
      {children}
    </ImageContext.Provider>
  )
}

export function useImage() {
  const ctx = useContext(ImageContext)
  if (!ctx) throw new Error('useImage must be used within ImageProvider')
  return ctx
}
