/* The title band's controls: the global filters (they apply to every data view
   and always move numerator and denominator together) and the connection status
   promised in Proposal 4.1 — last query time, live / disconnected, next check. */
import { RotateCcw } from 'lucide-react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const monthLabel = ym => {
  if (!ym) return ''
  const [y, m] = ym.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}
export const shortMonth = ym => {
  const [y, m] = ym.split('-').map(Number)
  return `${MONTHS[m - 1]} ’${String(y).slice(2)}`
}

export function monthRange(first, last) {
  const out = []
  let [y, m] = first.split('-').map(Number)
  const [ly, lm] = last.split('-').map(Number)
  while (y < ly || (y === ly && m <= lm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1; if (m > 12) { m = 1; y += 1 }
  }
  return out
}

export function addMonths(ym, n) {
  let [y, m] = ym.split('-').map(Number)
  m += n
  while (m > 12) { m -= 12; y += 1 }
  while (m < 1) { m += 12; y -= 1 }
  return `${y}-${String(m).padStart(2, '0')}`
}

const GROUPS = [
  { key: 'plant', label: 'Plant', all: 'All plants' },
  { key: 'department', label: 'Department', all: 'All departments' },
  { key: 'role', label: 'Role', all: 'All roles' },
  { key: 'shift', label: 'Shift', all: 'All shifts' },
]

function GroupSelect({ label, all, value, options, onChange }) {
  return (
    <label className="ds-field" title={options.length ? undefined : `${label} values load from Alpha's data`}>
      {label}
      <select value={value} onChange={e => onChange(e.target.value)}>
        <option value="">{all}</option>
        {options.length
          ? options.map(o => <option key={o} value={o}>{o}</option>)
          : <option disabled>Loads from Alpha's data</option>}
      </select>
    </label>
  )
}

export function FilterBar({ meta, filters, setFilters }) {
  const opts = meta?.options || { plant: [], department: [], role: [], shift: [] }
  const months = meta ? monthRange(meta.first_month, meta.last_month) : []
  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }))
  const last = meta?.last_month
  const year = last ? Number(last.slice(0, 4)) : null

  const quick = last ? [
    { label: '12M', title: 'Last 12 months', start: addMonths(last, -11), end: last },
    { label: 'YTD', title: 'Year to date', start: `${year}-01`, end: last },
    { label: '24M', title: 'Last 24 months', start: addMonths(last, -23), end: last },
    { label: String(year - 1), title: `Calendar ${year - 1}`, start: `${year - 1}-01`, end: `${year - 1}-12` },
  ] : []
  const isDefault = !GROUPS.some(g => filters[g.key]) && quick[0]?.start === filters.start && quick[0]?.end === filters.end
  const reset = () => setFilters({ plant: '', department: '', role: '', shift: '', start: quick[0].start, end: quick[0].end })

  return (
    <div className="ds-filters al-filters">
      {GROUPS.map(g => (
        <GroupSelect key={g.key} label={g.label} all={g.all} value={filters[g.key]} options={opts[g.key] || []} onChange={v => set(g.key, v)} />
      ))}
      <div className="ds-field" role="group" aria-label="Period">
        Period
        <div className="al-period">
          <select aria-label="From" value={filters.start} onChange={e => set('start', e.target.value)}>
            {months.filter(m => m <= filters.end).map(o => <option key={o} value={o}>{monthLabel(o)}</option>)}
          </select>
          to
          <select aria-label="To" value={filters.end} onChange={e => set('end', e.target.value)}>
            {months.filter(m => m >= filters.start).map(o => <option key={o} value={o}>{monthLabel(o)}</option>)}
          </select>
        </div>
      </div>
      <div className="ds-field" role="group" aria-label="Quick range">
        Quick range
        <div className="al-switch">
          {quick.map(q => (
            <button key={q.label} type="button" title={q.title} aria-pressed={q.start === filters.start && q.end === filters.end}
              onClick={() => setFilters(f => ({ ...f, start: q.start, end: q.end }))}>{q.label}</button>
          ))}
        </div>
      </div>
      <div className="ds-filter-actions">
        <button type="button" className="ds-button ds-button--plain" onClick={reset} disabled={isDefault || !last}>
          <RotateCcw size={13} /> Reset
        </button>
      </div>
    </div>
  )
}

const DOWN = { dot: 'down', title: 'Disconnected' }
const STATE = {
  connected: { dot: 'live', title: 'Live' },
  awaiting_credentials: { dot: 'wait', title: 'Awaiting access key' },
  auth_failed: DOWN, unreachable: DOWN, error: DOWN, api_down: DOWN,
  not_configured: { dot: '', title: 'Not configured' },
}

export function StatusLine({ conn, lastQuery, countdown }) {
  const s = STATE[conn?.state] || { dot: '', title: 'Connecting…' }
  const time = lastQuery ? new Date(lastQuery).toLocaleTimeString('en-US', { hour12: false }) : '—'
  return (
    <span className={`al-status ${s.dot === 'down' ? 'al-status--down' : ''}`} title={`${conn?.message || ''} Checked every 15 seconds.`}>
      <span className={`al-dot ${s.dot ? `al-dot--${s.dot}` : ''}`} aria-hidden="true" />
      <b>{s.title}</b>
      <span>· last query {time} · next check {countdown}s</span>
    </span>
  )
}
