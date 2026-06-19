// Pixi filter mapping layer — salvaged from apps/editor's utils/pixiFilters.js.
//
// `createPixiFilter` is the {type, params} → pixi-filters instance switch. It's
// driven by engine/pixiPipeline.js, which chains the results on ONE persistent
// Application (the editor created a throwaway app per filter — slow, leaked GL
// contexts).

import { DisplacementFilter } from 'pixi.js'
import {
  AdjustmentFilter,
  AdvancedBloomFilter,
  AsciiFilter,
  BackdropBlurFilter,
  BevelFilter,
  BloomFilter,
  BulgePinchFilter,
  ColorGradientFilter,
  ColorMapFilter,
  ColorOverlayFilter,
  ColorReplaceFilter,
  ConvolutionFilter,
  CrossHatchFilter,
  CRTFilter,
  DotFilter,
  DropShadowFilter,
  EmbossFilter,
  GlitchFilter,
  GlowFilter,
  GodrayFilter,
  GrayscaleFilter,
  HslAdjustmentFilter,
  KawaseBlurFilter,
  MotionBlurFilter,
  MultiColorReplaceFilter,
  OldFilmFilter,
  OutlineFilter,
  PixelateFilter,
  RadialBlurFilter,
  ReflectionFilter,
  RGBSplitFilter,
  ShockwaveFilter,
  SimpleLightmapFilter,
  SimplexNoiseFilter,
  TiltShiftFilter,
  TwistFilter,
  ZoomBlurFilter,
} from 'pixi-filters'

/**
 * Build a pixi-filters instance from this repo's effect id + params.
 * `displacementSprite` is the noise map sprite, only used by filter-displacement.
 *
 * NOTE: rgb-split params are flattened to redX/blueX in effects.config.js; this
 * re-nests them to the {red:{x},blue:{x}} shape RGBSplitFilter expects.
 */
export function createPixiFilter(filterType, params = {}, displacementSprite) {
  switch (filterType) {
    // Color Adjustments
    case 'filter-adjustment':
      return new AdjustmentFilter(params)
    case 'filter-hsl-adjustment':
      return new HslAdjustmentFilter(params)
    case 'filter-color-gradient':
      return new ColorGradientFilter(params)
    case 'filter-color-map':
      return new ColorMapFilter(params)
    case 'filter-color-overlay':
      return new ColorOverlayFilter(params)
    case 'filter-color-replace':
      return new ColorReplaceFilter(params)
    case 'filter-multi-color-replace':
      return new MultiColorReplaceFilter(params)

    // Blur
    case 'filter-radial-blur':
      return new RadialBlurFilter(params)
    case 'filter-zoom-blur':
      return new ZoomBlurFilter(params)
    case 'filter-motion-blur':
      return new MotionBlurFilter(params)
    case 'filter-kawase-blur':
      return new KawaseBlurFilter(params)
    case 'filter-tilt-shift':
      return new TiltShiftFilter(params)
    case 'filter-backdrop-blur':
      return new BackdropBlurFilter(params)

    // Displacement
    case 'filter-displacement':
      if (displacementSprite) {
        return new DisplacementFilter({
          sprite: displacementSprite,
          scale: { x: params.scaleX ?? 20, y: params.scaleY ?? 20 },
        })
      }
      return null

    // Distortion
    case 'filter-twist':
      return new TwistFilter(params)
    case 'filter-bulge-pinch':
      return new BulgePinchFilter(params)
    case 'filter-shockwave':
      return new ShockwaveFilter(params)

    // Artistic
    case 'filter-ascii':
      return new AsciiFilter(params)
    case 'filter-cross-hatch':
      return new CrossHatchFilter(params)
    case 'filter-dot':
      return new DotFilter(params)
    case 'filter-crt':
      return new CRTFilter(params)
    case 'filter-old-film':
      return new OldFilmFilter(params)
    case 'filter-glitch':
      return new GlitchFilter(params)
    case 'filter-rgb-split': {
      const { redX = -10, blueX = 10, ...rest } = params
      return new RGBSplitFilter({ ...rest, red: { x: redX, y: 0 }, blue: { x: blueX, y: 0 } })
    }
    case 'filter-simplex-noise':
      return new SimplexNoiseFilter(params)

    // Lighting
    case 'filter-bloom':
      return new BloomFilter(params)
    case 'filter-advanced-bloom':
      return new AdvancedBloomFilter(params)
    case 'filter-glow':
      return new GlowFilter(params)
    case 'filter-godray':
      return new GodrayFilter(params)
    case 'filter-simple-lightmap':
      return new SimpleLightmapFilter(params)

    // Stylize
    case 'filter-bevel':
      return new BevelFilter(params)
    case 'filter-drop-shadow':
      return new DropShadowFilter(params)
    case 'filter-outline':
      return new OutlineFilter(params)
    case 'filter-reflection':
      return new ReflectionFilter(params)

    // Utility
    case 'filter-convolution':
      return new ConvolutionFilter(params)
    case 'filter-emboss':
      return new EmbossFilter(params)
    case 'filter-grayscale':
      return new GrayscaleFilter(params)
    case 'filter-pixelate':
      return new PixelateFilter(params)

    default:
      return null
  }
}
