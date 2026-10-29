import { ChevronRight } from 'lucide-react'
import { useLiveContext } from '../live'
import { Unavailable, Loading } from '../states'
import { monthLabel } from '../TopBar'
import { MUTED, NAVY, fmtPct, CHART } from '../ui'

export const DEF = {
  headcount: 'Employees active on the last day of the period (today, for the current month), within the filtered group.',
  departures: 'Employees whose departure date falls inside the period, within the filtered group. Voluntary and involuntary combined.',
  rate: 'Departures dated in the period ÷ average headcount. Each month\'s average is (start + end) ÷ 2; the period average is the mean of the months. Filters change numerator and denominator together.',
  retention: 'Employees on the books at the start of the period who are still employed at its end ÷ headcount at the start.',
  cost: 'Recruiting + onboarding and training + vacancy cover (overtime premium, net of unpaid salary) + lost productivity during ramp-up, for each departure in the period, at base assumptions.',
  voluntary: 'Voluntary departures ÷ all departures in the period. Only shown because the data carries a departure type.',
}

/** Loading / error / data switch for a live view. A failed query shows no figures. */
export function ViewBody({ state, children }) {
  if (state.error) return <Unavailable detail={state.error} />
  if (!state.data) return <Loading />
  return children(state.data)
}

export function useScope() {
  const { filters } = useLiveContext()
  const parts = []
  if (filters.plant) parts.push(filters.plant)
  if (filters.department) parts.push(filters.department)
  if (filters.role) parts.push(`${filters.role}s`)
  if (filters.shift) parts.push(`${filters.shift} shift`)
  return parts.length ? parts.join(' · ') : 'All of Alpha'
}

export function periodLabel(p) {
  if (!p) return ''
  const through = new Date(p.through + 'T00:00:00')
  const partial = through.getDate() !== new Date(through.getFullYear(), through.getMonth() + 1, 0).getDate()
  const end = partial
    ? `${through.getDate()} ${monthLabel(p.end)}`
    : monthLabel(p.end)
  return p.start === p.end ? end : `${monthLabel(p.start)} – ${end}`
}

export function priorLabel(p) {
  return p?.months === 12 ? 'prior year' : `prior ${p?.months} mo`
}

export function LinkButton({ label, to }) {
  const { navigate } = useLiveContext()
  return (
    <button type="button" onClick={() => navigate(to)} style={{
      display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', padding: 0,
      fontSize: 11.5, fontWeight: 600, color: '#2B72D0', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
    }}>
      {label} <ChevronRight size={13} strokeWidth={2.4} />
    </button>
  )
}

/** One row of a rate-vs-company bar list. `max` sets the scale; the dashed
    marker is the company rate so "well above" reads without numbers. */
export function RateRow({ label, rate, company, max, n, small, wellAbove, onClick, sub, valueFmt = v => fmtPct(v) }) {
  const w = rate != null && max ? Math.min(100, (rate / max) * 100) : 0
  const mark = company != null && max ? Math.min(100, (company / max) * 100) : null
  const color = small ? '#C9D2DF' : wellAbove ? CHART.red : CHART.navy
  const ratio = rate != null && company ? rate / company : null
  return (
    <div className={onClick ? 'row-hover' : undefined} onClick={onClick} title={onClick ? `Filter the dashboard to ${label}` : undefined} style={{
      display: 'grid', gridTemplateColumns: 'minmax(120px, 190px) 1fr 64px 60px', alignItems: 'center', gap: 12,
      padding: '7px 8px', margin: '0 -8px', borderRadius: 8, cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: small ? MUTED : NAVY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        <div style={{ fontSize: 10.5, color: MUTED, marginTop: 1 }}>{sub ?? (n != null ? `avg ${Math.round(n)} employees` : '')}</div>
      </div>
      <div style={{ position: 'relative', height: 14, background: '#F0F3F8', borderRadius: 4 }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: `${w}%`, borderRadius: 4, background: color,
          backgroundImage: small ? 'repeating-linear-gradient(45deg, rgba(255,255,255,.55) 0 3px, transparent 3px 6px)' : 'none',
          transition: 'width .4s ease',
        }} />
        {mark != null && (
          <div style={{ position: 'absolute', left: `${mark}%`, top: -4, bottom: -4, width: 0, borderLeft: `2px dashed ${NAVY}`, opacity: 0.55 }} />
        )}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: small ? MUTED : NAVY, textAlign: 'right' }}>{valueFmt(rate)}</div>
      <div style={{ textAlign: 'right' }}>
        {small ? (
          <span title="Fewer than 10 employees on average: flagged, not ranked" style={{
            fontSize: 10, fontWeight: 700, color: '#B27A15', background: '#FBF0DC', padding: '2px 6px', borderRadius: 999,
          }}>n&lt;10</span>
        ) : ratio != null ? (
          <span style={{ fontSize: 11.5, fontWeight: 700, color: wellAbove ? CHART.red : MUTED }}>{ratio.toFixed(2)}×</span>
        ) : null}
      </div>
    </div>
  )
}
