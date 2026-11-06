/* Employees — every employee's record, read live. The database joins the four
   tables on employee_id (api/employees.py); the table shows one page at a time,
   and selecting a row opens everything on file for that person over a blurred
   page. Arrow keys step through the rows of the current page. */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X, Check, CheckCircle2, LogOut, Loader2,
} from 'lucide-react'
import { useLive } from '../live'
import { Surface, fmtInt, fmtUSDFull } from '../ui'
import { Unavailable, Loading } from '../states'

// ── Value formatting ──────────────────────────────────────────────────────────

// Stored codes that don't read well once underscores become spaces.
const WORDS = { IT: 'IT', hr: 'HR', RandD: 'R&D', product_mng: 'Product management' }
const words = v => {
  if (v == null || v === '') return '—'
  if (WORDS[v]) return WORDS[v]
  const plant = /^plant_([a-z])$/.exec(v)
  if (plant) return `Plant ${plant[1].toUpperCase()}`
  const s = String(v).replaceAll('_', ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const fmtDate = v => v
  ? new Date(`${v}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—'
const fmtScore = v => v == null ? '—' : Number(v).toFixed(2)
const fmtCents = v => v == null ? '—' : `$${Number(v).toFixed(2)}`
const yesNo = v => v == null ? '—' : v ? 'Yes' : 'No'

const STATUS_LABELS = { stayed: 'Stayed', left: 'Left (any reason)', voluntary: 'Left · voluntary', involuntary: 'Left · involuntary' }

function Status({ row, withDate }) {
  if (row.left == null) return '—'
  if (!row.left) return <span className="al-state al-state--positive"><CheckCircle2 size={13} />Stayed</span>
  return (
    <span className="al-state al-state--negative">
      <LogOut size={13} />Left · {words(row.separation_type)}{withDate && row.departure_date && ` · ${fmtDate(row.departure_date)}`}
    </span>
  )
}

const OnFile = ({ has }) => has
  ? <span className="al-inline-icon" style={{ color: 'var(--ds-positive)' }}><Check size={13} />On file</span>
  : <span className="al-dim">None</span>

// ── Table ─────────────────────────────────────────────────────────────────────

// `sort` names the API's sort key; numeric columns sort high-to-low on first click.
const COLUMNS = [
  { label: 'Employee ID', sort: 'employee_id' },
  { label: 'Status', render: r => <Status row={r} /> },
  { label: 'Department', sort: 'department', render: r => words(r.department) },
  { label: 'Plant', sort: 'plant', render: r => words(r.plant) },
  { label: 'Job role', sort: 'job_role', render: r => words(r.job_role) },
  { label: 'Shift', sort: 'shift', render: r => words(r.shift) },
  { label: 'Hired', sort: 'hire_date', render: r => fmtDate(r.hire_date) },
  { label: 'Departed', sort: 'departure_date', render: r => r.departure_date ? fmtDate(r.departure_date) : <span className="al-dim">—</span> },
  { label: 'Annual base pay', sort: 'annual_base_pay_usd', number: true, render: r => fmtUSDFull(r.compensation_training?.annual_base_pay_usd) },
  { label: 'Satisfaction', sort: 'satisfaction_level', number: true, render: r => fmtScore(r.satisfaction_level) },
  { label: 'Last evaluation', sort: 'last_evaluation', number: true, render: r => fmtScore(r.last_evaluation) },
  { label: 'Monthly hours', sort: 'average_monthly_hours', number: true, render: r => fmtInt(r.average_monthly_hours) },
  { label: 'Survey', render: r => <OnFile has={r.employee_surveys} /> },
  { label: 'Exit interview', render: r => r.left ? <OnFile has={r.exit_interviews} /> : <span className="al-dim">n/a</span> },
]

const START = { q: '', department: '', plant: '', status: '', sort: 'employee_id', desc: false, page: 1, size: 50 }

function Picker({ label, all, value, values, names = words, onChange }) {
  return (
    <select className="al-select" aria-label={label} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{all}</option>
      {values.map(v => <option key={v} value={v}>{names(v)}</option>)}
    </select>
  )
}

export default function Employees() {
  const [query, setQuery] = useState(START)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(null)            // index of the row whose record is showing
  const refocus = useRef(null)                      // row to return focus to once the record closes
  const scroller = useRef(null)
  const params = useMemo(() => Object.fromEntries(Object.entries(query).filter(([, v]) => v !== '' && v !== false)), [query])
  const state = useLive('/employees', params)

  // Search runs once typing pauses.
  useEffect(() => {
    const t = setTimeout(() => setQuery(x => x.q === search.trim() ? x : { ...x, q: search.trim(), page: 1 }), 300)
    return () => clearTimeout(t)
  }, [search])

  // The dialog is gone by the time this runs, so the page can take focus again.
  useEffect(() => {
    if (open != null || refocus.current == null) return
    scroller.current?.querySelectorAll('.al-rowlink')[refocus.current]?.focus()
    refocus.current = null
  }, [open])
  const close = () => { refocus.current = open; setOpen(null) }

  const set = changes => { setOpen(null); setQuery(x => ({ ...x, page: 1, ...changes })) }
  const toggleSort = (key, number) => set(query.sort === key ? { sort: key, desc: !query.desc } : { sort: key, desc: !!number })
  const clear = () => { setSearch(''); set({ q: '', department: '', plant: '', status: '' }) }

  if (state.error) return <Unavailable detail={state.error} />
  if (!state.data) return <Loading />
  const { rows, total, options } = state.data
  const pages = Math.max(1, Math.ceil((total ?? 0) / query.size))
  const from = total ? (query.page - 1) * query.size + 1 : 0
  const filtered = query.q || query.department || query.plant || query.status

  return (
    <div className="al-page fade-in">
      <Surface>
        <div className="ds-toolbar al-emp-toolbar">
          <h2>Employees <span className="al-count">({fmtInt(total)})</span></h2>
          <label className="ds-search">
            <Search size={14} />
            <input type="search" placeholder="Employee ID or job role" aria-label="Search by employee ID or job role"
              value={search} onChange={e => setSearch(e.target.value)} />
          </label>
          <Picker label="Department" all="All departments" value={query.department} values={options.department} onChange={v => set({ department: v })} />
          <Picker label="Plant" all="All plants" value={query.plant} values={options.plant} onChange={v => set({ plant: v })} />
          <Picker label="Status" all="Any status" value={query.status} values={options.status} names={v => STATUS_LABELS[v]} onChange={v => set({ status: v })} />
          {filtered && <button type="button" className="ds-button ds-button--plain" onClick={clear}>Clear</button>}
          {state.loading && <Loader2 size={15} className="al-spin" style={{ marginLeft: 'auto', color: 'var(--ds-subtle)' }} aria-label="Updating" />}
        </div>

        <div ref={scroller} className="ds-table-scroll al-emp-scroll" role="region" aria-label="Employees" tabIndex={0}>
          <table className={`ds-table al-emp-table ${state.loading ? 'al-updating' : ''}`} data-density="compact">
            <thead>
              <tr>
                {COLUMNS.map((c, i) => {
                  const active = c.sort && query.sort === c.sort
                  const Arrow = active && query.desc ? ChevronDown : ChevronUp
                  return (
                    <th key={c.label} scope="col" className={c.number ? 'ds-number' : undefined} data-pin={i === 0 ? 'start' : undefined}
                      aria-sort={active ? (query.desc ? 'descending' : 'ascending') : undefined}>
                      {c.sort
                        ? <button type="button" className="al-sort" onClick={() => toggleSort(c.sort, c.number)}>{c.label}<Arrow size={12} /></button>
                        : c.label}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.employee_id} className={open === i ? 'al-open' : undefined} onClick={() => setOpen(i)}>
                  <th scope="row" data-pin="start">
                    <button type="button" className="al-rowlink" onClick={e => { e.stopPropagation(); setOpen(i) }}>{r.employee_id}</button>
                  </th>
                  {COLUMNS.slice(1).map(c => <td key={c.label} className={c.number ? 'ds-number' : undefined}>{c.render(r)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="ds-empty"><strong>No employees match</strong>Try a different search, or clear the filters.</div>
          )}
        </div>

        <div className="ds-table-foot al-emp-foot">
          <span>
            {total ? `${fmtInt(from)}–${fmtInt(from + rows.length - 1)} of ${fmtInt(total)}` : '0 employees'}
            {' · '}employees joined to compensation_training, employee_surveys and exit_interviews on employee_id
          </span>
          <div className="al-pager">
            <select className="al-select" aria-label="Rows per page" value={query.size} onChange={e => set({ size: Number(e.target.value) })}>
              {options.size.map(n => <option key={n} value={n}>{n} per page</option>)}
            </select>
            <button type="button" aria-label="Previous page" disabled={query.page <= 1}
              onClick={() => { setOpen(null); setQuery(x => ({ ...x, page: x.page - 1 })) }}><ChevronLeft size={14} /></button>
            <span>Page {fmtInt(query.page)} of {fmtInt(pages)}</span>
            <button type="button" aria-label="Next page" disabled={query.page >= pages}
              onClick={() => { setOpen(null); setQuery(x => ({ ...x, page: x.page + 1 })) }}><ChevronRight size={14} /></button>
          </div>
        </div>
      </Surface>

      {open != null && rows[open] && (
        <RecordDialog ids={rows.map(r => r.employee_id)} index={open} onIndex={setOpen} onClose={close} />
      )}
    </div>
  )
}

// ── Record pop-up ─────────────────────────────────────────────────────────────

const NO_PARAMS = {}

function RecordDialog({ ids, index, onIndex, onClose }) {
  const id = ids[index]
  const dialog = useRef(null)
  const state = useLive(`/employees/${encodeURIComponent(id)}`, NO_PARAMS)
  // A refetch for the next ID keeps the last record until it lands; don't show the wrong person.
  const rec = state.data?.record?.employee_id === id ? state.data.record : null

  useEffect(() => {
    const d = dialog.current
    d.showModal()
    d.focus()
    const html = document.documentElement
    const overflow = html.style.overflow
    html.style.overflow = 'hidden'
    return () => { html.style.overflow = overflow; if (d.open) d.close() }
  }, [])

  const step = n => { const j = index + n; if (j >= 0 && j < ids.length) onIndex(j) }
  const keys = e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1) }
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1) }
  }
  const at = state.data?.queried_at && new Date(state.data.queried_at).toLocaleTimeString('en-US', { hour12: false })

  return (
    <dialog ref={dialog} className="ds-dialog al-record" aria-labelledby="al-record-title" tabIndex={-1}
      onCancel={e => { e.preventDefault(); onClose() }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={keys}>
      <header className="al-record-head">
        <div>
          <span className="al-record-kicker">Employee record</span>
          <h2 id="al-record-title">{id}</h2>
          <p>{rec ? `${words(rec.job_role)} · ${words(rec.department)} · ${words(rec.plant)} · ${words(rec.shift)} shift` : ' '}</p>
        </div>
        <div className="al-record-actions">
          {rec && <Status row={rec} withDate />}
          <span className="al-record-pos">{index + 1} of {ids.length}</span>
          <button type="button" className="al-iconbtn" aria-label="Previous employee" disabled={index === 0} onClick={() => step(-1)}><ChevronLeft size={16} /></button>
          <button type="button" className="al-iconbtn" aria-label="Next employee" disabled={index === ids.length - 1} onClick={() => step(1)}><ChevronRight size={16} /></button>
          <button type="button" className="al-iconbtn" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </div>
      </header>

      <div className="al-record-body">
        {state.error ? <Unavailable detail={state.error} /> : rec ? <RecordBody rec={rec} /> : <Loading />}
      </div>

      <footer className="al-record-foot">
        <span>All four tables joined on employee_id{at && ` · read live ${at}`}. Hover a field for its column name.</span>
        <span>← → steps through this page · Esc closes</span>
      </footer>
    </dialog>
  )
}

const Section = ({ title, table, note, children }) => (
  <section className="al-record-section">
    <header><h3>{title}</h3><code className="al-code">{table}</code></header>
    {note && <p className="al-record-note">{note}</p>}
    {children}
  </section>
)

const Field = ({ label, col, children }) => (
  <div className="al-field" title={col}><dt>{label}</dt><dd>{children}</dd></div>
)

/** A 0–1 score as a short bar with its value. */
const Meter = ({ value }) => value == null ? '—' : (
  <span className="al-meter"><span><i style={{ width: `${Math.min(1, Math.max(0, value)) * 100}%` }} /></span>{fmtScore(value)}</span>
)

/** A 1–5 survey rating as five pips. */
const Pips = ({ value, max = 5 }) => value == null ? '—' : (
  <span className="al-pips" role="img" aria-label={`${value} of ${max}`}>
    {Array.from({ length: max }, (_, i) => <i key={i} className={i < value ? 'on' : undefined} />)}
    <b>{value}</b>
  </span>
)

function RecordBody({ rec }) {
  const comp = rec.compensation_training
  const survey = rec.employee_surveys
  const exit = rec.exit_interviews
  const costs = comp && [comp.estimated_recruiting_cost_usd, comp.estimated_onboarding_cost_usd, comp.estimated_replacement_training_cost_usd]

  return (
    <div className="fade-in">
      <div className="al-record-kpis">
        <div><span>Years at company</span><strong>{fmtInt(rec.time_spend_company)}</strong><small>Hired {fmtDate(rec.hire_date)}</small></div>
        <div><span>Annual base pay</span><strong>{fmtUSDFull(comp?.annual_base_pay_usd)}</strong>
          <small>{comp ? `${words(comp.pay_basis)} · ${words(comp.salary_band)} band` : 'No compensation row'}</small></div>
        <div><span>Satisfaction</span><strong>{fmtScore(rec.satisfaction_level)}</strong><small>0–1 scale</small></div>
        <div><span>Last evaluation</span><strong>{fmtScore(rec.last_evaluation)}</strong><small>0–1 scale</small></div>
      </div>

      <div className="al-record-cols">
        <div className="al-record-col">
          <Section title="Employment" table="employees">
            <dl>
              <Field label="Department" col="department">{words(rec.department)}</Field>
              <Field label="Plant" col="plant">{words(rec.plant)}</Field>
              <Field label="Job role" col="job_role">{words(rec.job_role)}</Field>
              <Field label="Shift" col="shift">{words(rec.shift)}</Field>
              <Field label="Hire date" col="hire_date">{fmtDate(rec.hire_date)}</Field>
              <Field label="Years at company (as of 2024)" col="time_spend_company">{fmtInt(rec.time_spend_company)}</Field>
              <Field label="Baseline date" col="baseline_date">{fmtDate(rec.baseline_date)}</Field>
              <Field label="Reporting end date" col="reporting_end_date">{fmtDate(rec.reporting_end_date)}</Field>
              <Field label="Left" col="left">{yesNo(rec.left)}</Field>
              <Field label="Separation type" col="separation_type">{words(rec.separation_type)}</Field>
              <Field label="Departure date" col="departure_date">{fmtDate(rec.departure_date)}</Field>
            </dl>
          </Section>

          <Section title="Compensation and training" table="compensation_training"
            note={comp && `As of ${fmtDate(comp.as_of_date)}`}>
            {comp ? (
              <dl>
                <Field label="Pay basis" col="pay_basis">{words(comp.pay_basis)}</Field>
                <Field label="Salary band" col="salary_band">{words(comp.salary_band)}</Field>
                <Field label="Annual base pay" col="annual_base_pay_usd">{fmtUSDFull(comp.annual_base_pay_usd)}</Field>
                <Field label="Hourly base pay" col="hourly_base_pay_usd">{fmtCents(comp.hourly_base_pay_usd)}</Field>
                <Field label="Training hours, 2024" col="training_hours_2024">{fmtInt(comp.training_hours_2024)}</Field>
                <Field label="Primary training type" col="primary_training_type">{words(comp.primary_training_type)}</Field>
                <Field label="Est. recruiting cost" col="estimated_recruiting_cost_usd">{fmtUSDFull(comp.estimated_recruiting_cost_usd)}</Field>
                <Field label="Est. onboarding cost" col="estimated_onboarding_cost_usd">{fmtUSDFull(comp.estimated_onboarding_cost_usd)}</Field>
                <Field label="Est. replacement training cost" col="estimated_replacement_training_cost_usd">{fmtUSDFull(comp.estimated_replacement_training_cost_usd)}</Field>
                <Field label="Est. cost to replace (sum of the three)" col="sum of the three estimates">
                  {costs.every(v => v != null) ? fmtUSDFull(costs.reduce((a, b) => a + b, 0)) : '—'}
                </Field>
              </dl>
            ) : <div className="al-record-empty">No compensation or training row for this employee.</div>}
          </Section>
        </div>

        <div className="al-record-col">
          <Section title="Performance and workload" table="employees">
            <dl>
              <Field label="Satisfaction level" col="satisfaction_level"><Meter value={rec.satisfaction_level} /></Field>
              <Field label="Last evaluation" col="last_evaluation"><Meter value={rec.last_evaluation} /></Field>
              <Field label="Projects" col="number_project">{fmtInt(rec.number_project)}</Field>
              <Field label="Average monthly hours" col="average_monthly_hours">{fmtInt(rec.average_monthly_hours)}</Field>
              <Field label="Work accident" col="work_accident">{yesNo(rec.work_accident)}</Field>
              <Field label="Promoted in last 5 years" col="promotion_last_5years">{yesNo(rec.promotion_last_5years)}</Field>
            </dl>
          </Section>

          <Section title="Engagement survey" table="employee_surveys"
            note={survey && `Answered ${fmtDate(survey.survey_date)} · 1–5, 5 assumed most favourable`}>
            {survey ? (
              <dl>
                <Field label="Supervisor support" col="supervisor_support_score"><Pips value={survey.supervisor_support_score} /></Field>
                <Field label="Schedule predictability" col="schedule_predictability_score"><Pips value={survey.schedule_predictability_score} /></Field>
                <Field label="Career opportunity" col="career_opportunity_score"><Pips value={survey.career_opportunity_score} /></Field>
                <Field label="Work–life balance" col="work_life_balance_score"><Pips value={survey.work_life_balance_score} /></Field>
                <Field label="Survey ID" col="survey_id"><code className="al-code">{survey.survey_id}</code></Field>
              </dl>
            ) : <div className="al-record-empty">No survey response on record for this employee.</div>}
          </Section>

          <Section title="Exit interview" table="exit_interviews">
            {exit ? (
              <dl>
                <Field label="Primary departure reason" col="primary_departure_reason">{words(exit.primary_departure_reason)}</Field>
                <Field label="Interview date" col="interview_date">{fmtDate(exit.interview_date)}</Field>
                <Field label="Interview ID" col="exit_interview_id"><code className="al-code">{exit.exit_interview_id}</code></Field>
              </dl>
            ) : (
              <div className="al-record-empty">
                {rec.left
                  ? 'No exit interview on record for this employee.'
                  : `Not applicable: still employed at the end of the reporting period (${fmtDate(rec.reporting_end_date)}).`}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}
