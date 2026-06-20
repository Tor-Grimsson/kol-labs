import { NavLink, useLocation } from 'react-router-dom'
import { RAIL_GROUPS } from '../../pages/_shared/railGroups.js'

/**
 * RailVariantNav — the variant switcher that sits in a rail header (where the
 * page title used to be). Plain text links, space-between, active one emphasized.
 * Reads from RAIL_GROUPS so it never drifts from the left nav.
 *
 * Active = the variant whose `to` is the LONGEST prefix of the current path
 * (mirrors sidebars `getActivePage`), so a category with nested preset routes
 * (e.g. /scanlines/radial/rings → Radial) resolves correctly and a root variant
 * (/radar) doesn't steal a deeper sibling (/radar/ascii).
 */
export default function RailVariantNav({ group }) {
  const variants = RAIL_GROUPS[group] ?? []
  const { pathname } = useLocation()
  let activeTo = null
  let bestLen = -1
  for (const v of variants) {
    if ((pathname === v.to || pathname.startsWith(v.to + '/')) && v.to.length > bestLen) {
      activeTo = v.to
      bestLen = v.to.length
    }
  }
  return (
    <div className="flex justify-between">
      {variants.map((v) => (
        <NavLink
          key={v.to}
          to={v.to}
          className={`no-underline ${v.to === activeTo ? 'text-emphasis' : 'text-meta hover:text-emphasis'}`}
        >
          {v.label}
        </NavLink>
      ))}
    </div>
  )
}
