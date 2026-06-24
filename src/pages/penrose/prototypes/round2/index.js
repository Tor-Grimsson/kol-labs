// Round 2 — curated to 2 prototypes per territory (40 of the original 100; the
// rest were culled in the 2026-06 cleanup). The most distinct / canonical of each
// territory is kept. See docs/research/round2/*.md for the source material.

import { r2_fluid_03_stam } from './fluid-03-stam'
import { r2_fluid_05_sph } from './fluid-05-sph'

import { r2_rd_01_fhn } from './rd-01-fhn'
import { r2_rd_04_seashell } from './rd-04-seashell'

import { r2_lsys_01_tropism } from './lsys-01-tropism'
import { r2_lsys_04_phyllotaxis } from './lsys-04-phyllotaxis'

import { r2_phys_02_chemotaxis } from './phys-02-chemotaxis'
import { r2_phys_03_multispecies } from './phys-03-multispecies'

import { r2_ca_01_lenia } from './ca-01-lenia'
import { r2_ca_02_smoothlife } from './ca-02-smoothlife'

import { r2_act_01_vicsek } from './act-01-vicsek'
import { r2_act_03_mips } from './act-03-mips'

import { r2_attr_02_aizawa } from './attr-02-aizawa'
import { r2_attr_04_thomas } from './attr-04-thomas'

import { r2_frac_01_flame } from './frac-01-flame'
import { r2_frac_02_buddhabrot } from './frac-02-buddhabrot'

import { r2_hyp_03_droste } from './hyp-03-droste'
import { r2_hyp_05_apollonian } from './hyp-05-apollonian'

import { r2_geom_02_alpha } from './geom-02-alpha'
import { r2_geom_03_apollonius } from './geom-03-apollonius'

import { r2_curve_01_csf } from './curve-01-csf'
import { r2_curve_03_repulsive } from './curve-03-repulsive'

import { r2_stoch_01_wilson } from './stoch-01-wilson'
import { r2_stoch_04_eden } from './stoch-04-eden'

import { r2_wave_02_chladni } from './wave-02-chladni'
import { r2_wave_04_kuramoto_sivashinsky } from './wave-04-kuramoto-sivashinsky'

import { r2_soc_01_btw } from './soc-01-btw'
import { r2_soc_03_forestfire } from './soc-03-forestfire'

import { r2_topo_02_hopf } from './topo-02-hopf'
import { r2_topo_03_clifford } from './topo-03-clifford'

import { r2_nbody_01_fig8 } from './nbody-01-fig8'
import { r2_nbody_05_plummer } from './nbody-05-plummer'

import { r2_spec_01_harmonograph } from './spec-01-harmonograph'
import { r2_spec_04_maurer_rose } from './spec-04-maurer-rose'

import { r2_tile_02_hat } from './tile-02-hat'
import { r2_tile_05_penrose } from './tile-05-penrose'

import { r2_net_01_ba } from './net-01-ba'
import { r2_net_04_mst } from './net-04-mst'

import { r2_nca_01_munca } from './nca-01-munca'
import { r2_nca_03_dynca } from './nca-03-dynca'

export const ROUND2_PROTOTYPES = [
  r2_fluid_03_stam, r2_fluid_05_sph,
  r2_rd_01_fhn, r2_rd_04_seashell,
  r2_lsys_01_tropism, r2_lsys_04_phyllotaxis,
  r2_phys_02_chemotaxis, r2_phys_03_multispecies,
  r2_ca_01_lenia, r2_ca_02_smoothlife,
  r2_act_01_vicsek, r2_act_03_mips,
  r2_attr_02_aizawa, r2_attr_04_thomas,
  r2_frac_01_flame, r2_frac_02_buddhabrot,
  r2_hyp_03_droste, r2_hyp_05_apollonian,
  r2_geom_02_alpha, r2_geom_03_apollonius,
  r2_curve_01_csf, r2_curve_03_repulsive,
  r2_stoch_01_wilson, r2_stoch_04_eden,
  r2_wave_02_chladni, r2_wave_04_kuramoto_sivashinsky,
  r2_soc_01_btw, r2_soc_03_forestfire,
  r2_topo_02_hopf, r2_topo_03_clifford,
  r2_nbody_01_fig8, r2_nbody_05_plummer,
  r2_spec_01_harmonograph, r2_spec_04_maurer_rose,
  r2_tile_02_hat, r2_tile_05_penrose,
  r2_net_01_ba, r2_net_04_mst,
  r2_nca_01_munca, r2_nca_03_dynca,
]
