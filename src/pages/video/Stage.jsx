import CropBox from './CropBox.jsx'
import FormatWindow from './FormatWindow.jsx'

/**
 * The preview stage. The source video is shown at its natural fit and is NEVER
 * transformed — changing the project format only swaps the overlay placed over it:
 *
 *   - 'source' → no overlay (the whole frame is the output; trim only).
 *   - 'free'   → CropBox, an arbitrary draggable/resizable rectangle.
 *   - aspect   → FormatWindow, an aspect-locked output window (drag to move,
 *                scroll to zoom). What's inside it exports, scaled to the format.
 *
 * One <video> node stays mounted across modes, so switching format never reloads
 * the clip or loses the trim/playhead.
 */
export default function Stage({
  srcUrl, videoRef, kind, ratio, meta, win, onWin,
  crop, onCrop, onLoadedMetadata, onTogglePlay,
}) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-0">
      <div className="relative inline-block max-w-full">
        <video
          ref={videoRef}
          src={srcUrl}
          className="block max-h-[62vh] max-w-full rounded"
          playsInline
          onLoadedMetadata={onLoadedMetadata}
          onClick={kind === 'source' ? onTogglePlay : undefined}
        />
        {kind === 'free' && meta && <CropBox crop={crop} onChange={onCrop} aspect={null} meta={meta} />}
        {kind === 'aspect' && meta && <FormatWindow ratio={ratio} meta={meta} params={win} onParams={onWin} />}
        {/* source outline — above the dim so the clip's edges stay visible */}
        <div className="absolute inset-0 border border-fg-24 rounded pointer-events-none" />
      </div>
    </div>
  )
}
