
import { packingLloyd } from './01-packing-lloyd'
import { diffgrow } from './02-diffgrow'
import { spaceCol } from './03-space-col'
import { boids } from './04-boids'
import { frontPack } from './05-front-pack'
import { dla } from './06-dla'
import { flowField } from './07-flow-field'
import { quadtree } from './08-quadtree'
import { forceContainer } from './09-force-container'
import { reactionDiff } from './10-reaction-diffusion'
import { attractor } from './11-attractor'
import { lSystem } from './12-l-system'
import { layered } from './13-layered'
import { layeredErase } from './14-layered-erase'
import { triggered } from './15-triggered'
import { ROUND2_PROTOTYPES } from './round2'

export const PROTOTYPES              = [
  packingLloyd,
  diffgrow,
  spaceCol,
  boids,
  frontPack,
  dla,
  flowField,
  quadtree,
  forceContainer,
  reactionDiff,
  attractor,
  lSystem,
  layered,
  layeredErase,
  triggered,
  ...ROUND2_PROTOTYPES,
]


