// Round 2: 100 prototypes generated from the 20-territory research sweep.
// See docs/research/round2/*.md for the source material.



import { r2_fluid_01_lbm } from './fluid-01-lbm'
import { r2_fluid_02_vortex } from './fluid-02-vortex'
import { r2_fluid_03_stam } from './fluid-03-stam'
import { r2_fluid_04_swe } from './fluid-04-swe'
import { r2_fluid_05_sph } from './fluid-05-sph'

import { r2_rd_01_fhn } from './rd-01-fhn'
import { r2_rd_02_oregonator } from './rd-02-oregonator'
import { r2_rd_03_le } from './rd-03-lengyel-epstein'
import { r2_rd_04_seashell } from './rd-04-seashell'
import { r2_rd_05_aniso } from './rd-05-aniso-schnakenberg'

import { r2_lsys_01_tropism } from './lsys-01-tropism'
import { r2_lsys_02_oracle } from './lsys-02-oracle'
import { r2_lsys_03_stochastic } from './lsys-03-stochastic'
import { r2_lsys_04_phyllotaxis } from './lsys-04-phyllotaxis'
import { r2_lsys_05_signal } from './lsys-05-signal'

import { r2_phys_01_peristaltic } from './phys-01-peristaltic'
import { r2_phys_02_chemotaxis } from './phys-02-chemotaxis'
import { r2_phys_03_multispecies } from './phys-03-multispecies'
import { r2_phys_04_dlahybrid } from './phys-04-dlahybrid'
import { r2_phys_05_memory } from './phys-05-memory'

import { r2_ca_01_lenia } from './ca-01-lenia'
import { r2_ca_02_smoothlife } from './ca-02-smoothlife'
import { r2_ca_03_asymptotic_lenia } from './ca-03-asymptotic-lenia'
import { r2_ca_04_flow_lenia } from './ca-04-flow-lenia'
import { r2_ca_05_glaberish } from './ca-05-glaberish'

import { r2_act_01_vicsek } from './act-01-vicsek'
import { r2_act_02_nematics } from './act-02-nematics'
import { r2_act_03_mips } from './act-03-mips'
import { r2_act_04_chiral } from './act-04-chiral'
import { r2_act_05_runtumble } from './act-05-runtumble'

import { r2_attr_01_rossler } from './attr-01-rossler'
import { r2_attr_02_aizawa } from './attr-02-aizawa'
import { r2_attr_03_standard_map } from './attr-03-standard-map'
import { r2_attr_04_thomas } from './attr-04-thomas'
import { r2_attr_05_sprott_linz } from './attr-05-sprott-linz'

import { r2_frac_01_flame } from './frac-01-flame'
import { r2_frac_02_buddhabrot } from './frac-02-buddhabrot'
import { r2_frac_03_orbit_trap } from './frac-03-orbit-trap'
import { r2_frac_04_kifs } from './frac-04-kifs'
import { r2_frac_05_bifurcation } from './frac-05-bifurcation'

import { r2_hyp_01_pqr_tiling } from './hyp-01-pqr-tiling'
import { r2_hyp_02_schottky } from './hyp-02-schottky'
import { r2_hyp_03_droste } from './hyp-03-droste'
import { r2_hyp_04_ford } from './hyp-04-ford'
import { r2_hyp_05_apollonian } from './hyp-05-apollonian'

import { r2_geom_01_power } from './geom-01-power'
import { r2_geom_02_alpha } from './geom-02-alpha'
import { r2_geom_03_apollonius } from './geom-03-apollonius'
import { r2_geom_04_dualgrowth } from './geom-04-dualgrowth'
import { r2_geom_05_cvt_density } from './geom-05-cvt-density'

import { r2_curve_01_csf } from './curve-01-csf'
import { r2_curve_02_willmore } from './curve-02-willmore'
import { r2_curve_03_repulsive } from './curve-03-repulsive'
import { r2_curve_04_tangent_angle } from './curve-04-tangent-angle'
import { r2_curve_05_vortex_sheet } from './curve-05-vortex-sheet'

import { r2_stoch_01_wilson } from './stoch-01-wilson'
import { r2_stoch_02_invperc } from './stoch-02-invperc'
import { r2_stoch_03_gff } from './stoch-03-gff'
import { r2_stoch_04_eden } from './stoch-04-eden'
import { r2_stoch_05_fpp } from './stoch-05-fpp'

import { r2_wave_01_cgle } from './wave-01-cgle'
import { r2_wave_02_chladni } from './wave-02-chladni'
import { r2_wave_03_fitzhugh_nagumo } from './wave-03-fitzhugh-nagumo'
import { r2_wave_04_kuramoto_sivashinsky } from './wave-04-kuramoto-sivashinsky'
import { r2_wave_05_fdtd_ripple } from './wave-05-fdtd-ripple'

import { r2_soc_01_btw } from './soc-01-btw'
import { r2_soc_02_identity } from './soc-02-identity'
import { r2_soc_03_forestfire } from './soc-03-forestfire'
import { r2_soc_04_ofc } from './soc-04-ofc'
import { r2_soc_05_manna } from './soc-05-manna'

import { r2_topo_01_torusknot } from './topo-01-torusknot'
import { r2_topo_02_hopf } from './topo-02-hopf'
import { r2_topo_03_clifford } from './topo-03-clifford'
import { r2_topo_04_toruslink } from './topo-04-toruslink'
import { r2_topo_05_dehntwist } from './topo-05-dehntwist'

import { r2_nbody_01_fig8 } from './nbody-01-fig8'
import { r2_nbody_02_tde } from './nbody-02-tde'
import { r2_nbody_03_jeans } from './nbody-03-jeans'
import { r2_nbody_04_roche } from './nbody-04-roche'
import { r2_nbody_05_plummer } from './nbody-05-plummer'

import { r2_spec_01_harmonograph } from './spec-01-harmonograph'
import { r2_spec_02_lissajous_knot } from './spec-02-lissajous-knot'
import { r2_spec_03_bessel_drumhead } from './spec-03-bessel-drumhead'
import { r2_spec_04_maurer_rose } from './spec-04-maurer-rose'
import { r2_spec_05_detuned_lissajous } from './spec-05-detuned-lissajous'

import { r2_tile_01_truchet } from './tile-01-truchet'
import { r2_tile_02_hat } from './tile-02-hat'
import { r2_tile_03_quasiwave } from './tile-03-quasiwave'
import { r2_tile_04_kolam } from './tile-04-kolam'
import { r2_tile_05_penrose } from './tile-05-penrose'

import { r2_net_01_ba } from './net-01-ba'
import { r2_net_02_ws } from './net-02-watts-strogatz'
import { r2_net_03_er } from './net-03-er-giant'
import { r2_net_04_mst } from './net-04-mst'
import { r2_net_05_explperc } from './net-05-explosive-perc'

import { r2_nca_01_munca } from './nca-01-munca'
import { r2_nca_02_noisenca } from './nca-02-noisenca'
import { r2_nca_03_dynca } from './nca-03-dynca'
import { r2_nca_04_steerable } from './nca-04-steerable'
import { r2_nca_05_isotropic } from './nca-05-isotropic'

export const ROUND2_PROTOTYPES              = [
  // Fluid dynamics (5)
  r2_fluid_01_lbm, r2_fluid_02_vortex, r2_fluid_03_stam, r2_fluid_04_swe, r2_fluid_05_sph,
  // Reaction-diffusion (5)
  r2_rd_01_fhn, r2_rd_02_oregonator, r2_rd_03_le, r2_rd_04_seashell, r2_rd_05_aniso,
  // Advanced L-systems (5)
  r2_lsys_01_tropism, r2_lsys_02_oracle, r2_lsys_03_stochastic, r2_lsys_04_phyllotaxis, r2_lsys_05_signal,
  // Physarum variants (5)
  r2_phys_01_peristaltic, r2_phys_02_chemotaxis, r2_phys_03_multispecies, r2_phys_04_dlahybrid, r2_phys_05_memory,
  // Continuous CA / Lenia (5)
  r2_ca_01_lenia, r2_ca_02_smoothlife, r2_ca_03_asymptotic_lenia, r2_ca_04_flow_lenia, r2_ca_05_glaberish,
  // Active matter (5)
  r2_act_01_vicsek, r2_act_02_nematics, r2_act_03_mips, r2_act_04_chiral, r2_act_05_runtumble,
  // Strange attractors (5)
  r2_attr_01_rossler, r2_attr_02_aizawa, r2_attr_03_standard_map, r2_attr_04_thomas, r2_attr_05_sprott_linz,
  // Fractals / IFS (5)
  r2_frac_01_flame, r2_frac_02_buddhabrot, r2_frac_03_orbit_trap, r2_frac_04_kifs, r2_frac_05_bifurcation,
  // Hyperbolic geometry (5)
  r2_hyp_01_pqr_tiling, r2_hyp_02_schottky, r2_hyp_03_droste, r2_hyp_04_ford, r2_hyp_05_apollonian,
  // Computational geometry (5)
  r2_geom_01_power, r2_geom_02_alpha, r2_geom_03_apollonius, r2_geom_04_dualgrowth, r2_geom_05_cvt_density,
  // Curve flows (5)
  r2_curve_01_csf, r2_curve_02_willmore, r2_curve_03_repulsive, r2_curve_04_tangent_angle, r2_curve_05_vortex_sheet,
  // Stochastic growth (5)
  r2_stoch_01_wilson, r2_stoch_02_invperc, r2_stoch_03_gff, r2_stoch_04_eden, r2_stoch_05_fpp,
  // Wave phenomena (5)
  r2_wave_01_cgle, r2_wave_02_chladni, r2_wave_03_fitzhugh_nagumo, r2_wave_04_kuramoto_sivashinsky, r2_wave_05_fdtd_ripple,
  // Self-organized criticality (5)
  r2_soc_01_btw, r2_soc_02_identity, r2_soc_03_forestfire, r2_soc_04_ofc, r2_soc_05_manna,
  // Topology / torus / knots (5)
  r2_topo_01_torusknot, r2_topo_02_hopf, r2_topo_03_clifford, r2_topo_04_toruslink, r2_topo_05_dehntwist,
  // N-body / astrophysics (5)
  r2_nbody_01_fig8, r2_nbody_02_tde, r2_nbody_03_jeans, r2_nbody_04_roche, r2_nbody_05_plummer,
  // Spectral / harmonic (5)
  r2_spec_01_harmonograph, r2_spec_02_lissajous_knot, r2_spec_03_bessel_drumhead, r2_spec_04_maurer_rose, r2_spec_05_detuned_lissajous,
  // Tessellations / aperiodic (5)
  r2_tile_01_truchet, r2_tile_02_hat, r2_tile_03_quasiwave, r2_tile_04_kolam, r2_tile_05_penrose,
  // Network growth (5)
  r2_net_01_ba, r2_net_02_ws, r2_net_03_er, r2_net_04_mst, r2_net_05_explperc,
  // Neural CA (5)
  r2_nca_01_munca, r2_nca_02_noisenca, r2_nca_03_dynca, r2_nca_04_steerable, r2_nca_05_isotropic,
]
