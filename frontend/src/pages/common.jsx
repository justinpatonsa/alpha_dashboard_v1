import { ArrowRight } from 'lucide-react'
import { useLive, useLiveContext } from '../live'
import { Unavailable, Loading } from '../states'
import { monthLabel } from '../filters'
import { NAVY } from '../ui'

/* Metric definitions, worded as in Proposal 3.2. "Proposed defaults": final
   definitions depend on the data shape confirmed in discovery. */
export const DEF = {
  headcount: 'Employees active on the last day of the period, within the filtered group. Needs hire and departure dates and employment status.',
  departures: 'Departures dated in the period, within the filtered group.',
  rate: 'Population: employees active during the period, within the filtered group. Numerator: departures dated in the period. Denominator: average headcount over the period (monthly: (start + end) ÷ 2).',
  retention: 'Population: employees active at period start. Numerator: those still employed at period end. Denominator: headcount at period start.',
  voluntary: 'Voluntary departures ÷ all departures in the period, only if a departure type exists in the data.',
  cost: 'Recruiting + onboarding and training + vacancy coverage (net of unpaid salary) + lost productivity during ramp-up, per departure. Alpha\'s figures where supplied; cited low / base / high assumptions where not, each labelled.',
}

/** Runs the view's live query (every load, filter change and 15-second tick)
    and shows the result line; a failed query replaces the view with the error state. */
export function ViewQuery({ id, children }) {
  const state = useLive(`/view/${id}`)
  if (state.error) return <Unavailable detail={state.error} />
  if (!state.data) return <Loading />
  return children(state.data)
}

export function useScope() {
  const { filters } = useLiveContext()
  const parts = []
  if (filters.plant) parts.push(filters.plant)
  if (filters.department) parts.push(filters.department)
  if (filters.role) parts.push(filters.role)
  if (filters.shift) parts.push(`${filters.shift} shift`)
  return parts.length ? parts.join(' · ') : 'All of Alpha'
}

export function periodText(f) {
  if (!f.start || !f.end) return ''
  return f.start === f.end ? monthLabel(f.start) : `${monthLabel(f.start)} – ${monthLabel(f.end)}`
}

/** A destination link to another view, as in the reference's "Open workspaces →". */
export function LinkButton({ label, to }) {
  return (
    <a href={`#/${to}`} className="al-inline-icon" style={{ gap: 7, fontSize: 12, flexShrink: 0 }}>
      {label} <ArrowRight size={14} />
    </a>
  )
}

export const H = ({ children }) => <span style={{ color: NAVY, fontWeight: 600 }}>{children}</span>
