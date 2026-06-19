import { useState } from 'react'
import Button from '../../../components/atoms/Button.jsx'
import MediaPicker from '../../../components/framework/MediaPicker.jsx'
import { useImage } from '../state/ImageContext'

// Drop-in alongside the radar Upload buttons: opens the CDN library picker and
// loads the chosen item as the shared source (no disk upload).
export default function LibrarySourceButton({ accept = 'all', className = 'w-full' }) {
  const { loadImageFromUrl } = useImage()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="primary" size="sm" iconLeft="image" className={className} onClick={() => setOpen(true)}>
        From library
      </Button>
      <MediaPicker
        open={open}
        accept={accept}
        onClose={() => setOpen(false)}
        onPick={(url, o) => loadImageFromUrl(url, o?.contentType)}
      />
    </>
  )
}
