/**
 * Platform output presets. `w/h` are the 1x output dimensions; the UI offers
 * 2x where the source has the pixels. Add platforms/sizes here — everything
 * else (matrix, crop math, jobs) derives from this list.
 */
export const PRESETS = [
  { id: 'ig-square',    platform: 'Instagram', label: 'Feed square',    ratio: '1:1',    w: 1080, h: 1080 },
  { id: 'ig-portrait',  platform: 'Instagram', label: 'Feed portrait',  ratio: '4:5',    w: 1080, h: 1350 },
  { id: 'ig-landscape', platform: 'Instagram', label: 'Feed landscape', ratio: '16:9',   w: 1080, h: 608 },
  { id: 'ig-53',        platform: 'Instagram', label: 'Wide 5:3',       ratio: '5:3',    w: 1080, h: 648 },
  { id: 'ig-story',     platform: 'Instagram', label: 'Story / Reel',   ratio: '9:16',   w: 1080, h: 1920 },
  { id: 'fb-feed',      platform: 'Facebook',  label: 'Feed link',      ratio: '16:9',   w: 1200, h: 675 },
  { id: 'fb-square',    platform: 'Facebook',  label: 'Feed square',    ratio: '1:1',    w: 1200, h: 1200 },
  { id: 'fb-story',     platform: 'Facebook',  label: 'Story',          ratio: '9:16',   w: 1080, h: 1920 },
]

export const SCALES = [1, 2]
