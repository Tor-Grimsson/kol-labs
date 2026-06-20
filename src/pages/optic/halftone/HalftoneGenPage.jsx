import { HalftoneInner } from './HalftonePage.jsx'

// Halftone — the pure parametric dot/bead-field generator (Pattern group,
// /optic/halftone). Same engine as Bitmap, no photo source. Source provider
// comes from OpticPage.
export default function HalftoneGenPage() {
  return <HalftoneInner mode="generator" />
}
