/* Cost and scenarios — the one view that works fully tonight, because it's a
   model, not a measurement. The formula is Proposal 6.2's; every input starts
   empty and is typed in. Once connected, departures and pay fill from the
   database and the rest from Alpha's cost data or cited assumptions. */
import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { Card, CardHeader, Grid, KpiStrip, Pills, Info, Surface, NAVY, MUTED, CHART, HAIRLINE, LINK, GREEN, AMBER, fmtUSD, fmtUSDFull } from '../ui'
import { ViewQuery } from './common'

const LEVELS = [{ value: 'low', label: 'Low' }, { value: 'base', label: 'Base' }, { value: 'high', label: 'High' }]

const INPUTS = [
  { key: 'recruit', label: 'Recruiting', unit: 'usd', help: 'Advertising, agency and recruiter time to fill one role.' },
  { key: 'onboard', label: 'Onboarding', unit: 'usd', help: 'Per hire. Counted once, so it isn\'t double-counted with ramp-up.' },
  { key: 'pay', label: 'Annual pay', unit: 'usd', help: 'Comes from the compensation data once connected.', fromData: true },
  { key: 'vacancyWeeks', label: 'Weeks vacant', unit: 'weeks', help: 'Alpha\'s time to fill.' },
  { key: 'coverPct', label: 'Vacancy cover', unit: 'pct', help: 'Extra cost of covering the work as a % of pay, net of the salary not paid. A 1.5× overtime cover is 50%.' },
  { key: 'rampWeeks', label: 'Ramp-up weeks', unit: 'weeks', help: 'Time for a new hire to reach full productivity.' },
  { key: 'rampGap', label: 'Ramp-up shortfall', unit: 'pct', help: 'Average shortfall versus a fully productive employee.' },
]

const num = v => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v))

function perDeparture(x) {
  const v = Object.fromEntries(INPUTS.map(i => [i.key, num(x[i.key])]))
  if (Object.values(v).some(n => n == null)) return null
  const weekly = v.pay / 52
  const parts = {
    recruiting: v.recruit,
    onboarding: v.onboard,
    vacancy: weekly * v.vacancyWeeks * (v.coverPct / 100),
    ramp: weekly * v.rampWeeks * (v.rampGap / 100),
  }
  return { parts, total: Object.values(parts).reduce((s, n) => s + n, 0) }
}

export default function Cost() {
  return <ViewQuery id="cost">{() => <CostBody />}</ViewQuery>
}

function CostBody() {
  const [level, setLevel] = useState('base')
  const [vals, setVals] = useState({ low: {}, base: {}, high: {} })
  const [src, setSrc] = useState({})        // input key -> true when Alpha supplied it
  const set = (k, v) => setVals(s => ({ ...s, [level]: { ...s[level], [k]: v } }))
  const results = Object.fromEntries(LEVELS.map(l => [l.value, perDeparture(vals[l.value])]))
  const cur = results[level]

  return (
    <div className="al-page fade-in">
      <div className="ds-message" role="note">
        <FlaskConical size={14} /> Modeled, not measured. Inputs are typed in until Alpha's cost and pay data are connected.
      </div>

      <Grid cols="minmax(320px, 400px) minmax(0, 1fr)" style={{ alignItems: 'start' }}>
        <Card
          title={<>Inputs<Info width={300} text="Per departure = recruiting + onboarding and training + vacancy cover (net of unpaid salary) + lost productivity in ramp-up (Proposal 6.2). Click a tag to mark where a figure came from." /></>}
          right={<Pills small value={level} options={LEVELS} onChange={setLevel} />}>
          {INPUTS.map(i => {
            const alpha = !!src[i.key]
            return (
              <div key={i.key} className="al-row">
                <span style={{ fontWeight: 600, color: NAVY, flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
                  {i.label}<Info text={i.help} />
                </span>
                {i.fromData
                  ? <span className="al-tag" style={{ color: LINK }}>Data</span>
                  : <button type="button" className="al-tag" title="Click to switch" aria-label={`${i.label} source: ${alpha ? 'Alpha' : 'Assumption'}. Click to switch.`}
                      onClick={() => setSrc(x => ({ ...x, [i.key]: !alpha }))} style={{ color: alpha ? GREEN : AMBER }}>
                      {alpha ? 'Alpha' : 'Assumption'}
                    </button>}
                <Input label={i.label} unit={i.unit} value={vals[level][i.key] ?? ''} onChange={v => set(i.key, v)} />
              </div>
            )
          })}
        </Card>

        <div className="al-page" style={{ gap: 19 }}>
          <KpiStrip label="Cost per departure by scenario level">
            {LEVELS.map(l => (
              <div key={l.value} className={`ds-kpi ${l.value === level ? 'ds-kpi--key' : ''}`}>
                <span>{l.label} · per departure</span>
                <strong className={results[l.value] ? '' : 'al-kpi-empty'}>{results[l.value] ? fmtUSD(results[l.value].total) : '—'}</strong>
                <small>{results[l.value] ? 'From the inputs' : 'Inputs incomplete'}</small>
              </div>
            ))}
          </KpiStrip>

          <Card title="Cost of one departure" note={`${LEVELS.find(l => l.value === level).label} level, by component`}>
            {cur ? (
              <>
                <div style={{ display: 'flex', height: 18, background: 'var(--ds-surface-muted)' }}>
                  {PARTS.map(p => <div key={p.key} title={`${p.label}: ${fmtUSDFull(cur.parts[p.key])}`} style={{ width: `${cur.total ? (cur.parts[p.key] / cur.total) * 100 : 0}%`, background: p.color, transition: 'width .35s' }} />)}
                </div>
                <Grid cols="repeat(4, minmax(0, 1fr))" gap={10} style={{ marginTop: 14 }}>
                  {PARTS.map(p => (
                    <div key={p.key} style={{ display: 'flex', gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: p.color, marginTop: 3, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 11, color: MUTED }}>{p.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: NAVY, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmtUSDFull(cur.parts[p.key])}</div>
                      </div>
                    </div>
                  ))}
                </Grid>
              </>
            ) : (
              <div className="ds-empty" style={{ padding: '10px 0' }}>Fill in the inputs to see the breakdown.</div>
            )}
          </Card>
        </div>
      </Grid>

      <Grid cols="repeat(auto-fit, minmax(440px, 1fr))">
        <Scenario title="Scenario A · Targeted" per={cur?.total} who="The two highest-rate groups" />
        <Scenario title="Scenario B · Company-wide" per={cur?.total} who="Everyone in the current filter" />
      </Grid>

      <Surface>
        <CardHeader title={<>Recommendations<Info text="At least three, written after the analysis (D2, D3). Each is a test with an owner, cost, benefit, baselined success indicator and strength of evidence." width={300} /></>}
          note="Written after the analysis" />
        <div className="ds-table-scroll" role="region" aria-label="Recommendations" tabIndex={0}>
          <table className="ds-table" style={{ minWidth: 700 }}>
            <thead>
              <tr>{['#', 'Recommendation', 'Owner', 'Cost', 'Benefit', 'Success indicator', 'Evidence'].map(h => <th key={h} scope="col">{h}</th>)}</tr>
            </thead>
            <tbody>
              {[1, 2, 3].map(n => (
                <tr key={n}>
                  <th scope="row" style={{ width: 40, fontWeight: 600 }}>{n}</th>
                  {Array.from({ length: 6 }).map((_, i) => <td key={i}><div style={{ height: 8, width: i === 0 ? '80%' : '60%', background: HAIRLINE, borderRadius: 2 }} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>
    </div>
  )
}

const PARTS = [
  { key: 'recruiting', label: 'Recruiting', color: CHART.deep },
  { key: 'onboarding', label: 'Onboarding', color: CHART.navy },
  { key: 'vacancy', label: 'Vacancy cover', color: CHART.mid },
  { key: 'ramp', label: 'Ramp-up', color: CHART.pale },
]

function Input({ label, unit, value, onChange, width = 108 }) {
  const max = unit === 'pct' ? 100 : undefined
  return (
    <span className={`al-input ${value !== '' ? 'al-input--filled' : ''}`} style={{ width }}>
      {unit === 'usd' && '$'}
      <input type="number" min={0} max={max} value={value} placeholder="—" aria-label={label}
        onChange={e => onChange(max != null && Number(e.target.value) > max ? String(max) : e.target.value)} />
      {unit === 'weeks' && 'wks'}
      {unit === 'pct' && '%'}
    </span>
  )
}

function Scenario({ title, who, per }) {
  const [v, setV] = useState({})
  const s = k => num(v[k])
  const ready = per != null && ['deps', 'hc', 'reduction', 'perEmp', 'fixed'].every(k => s(k) != null)
  const reduction = Math.min(100, Math.max(0, s('reduction') ?? 0))   // a share can't exceed 100%
  const avoidedN = ready ? s('deps') * reduction / 100 : null
  const avoided = ready ? avoidedN * per : null
  const spend = ready ? s('perEmp') * s('hc') + s('fixed') : null
  const net = ready ? avoided - spend : null
  const field = (k, label, unit) => (
    <label style={{ display: 'grid', gap: 6 }}>
      <span className="al-label">{label}</span>
      <Input label={label} unit={unit} width={unit === 'usd' ? 104 : 78} value={v[k] ?? ''} onChange={x => setV(o => ({ ...o, [k]: x }))} />
    </label>
  )
  return (
    <Card title={title} note={who}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {field('deps', 'Leavers / yr')}
        {field('hc', 'Employees')}
        {field('reduction', 'Reduction', 'pct')}
        {field('perEmp', 'Per employee', 'usd')}
        {field('fixed', 'Fixed cost', 'usd')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${HAIRLINE}` }}>
        <Kpi label="Avoided cost / yr" value={ready ? fmtUSD(avoided) : '—'} />
        <Kpi label="Initiative cost / yr" value={ready ? fmtUSD(spend) : '—'} />
        <Kpi label="Net benefit / yr" value={ready ? `${net < 0 ? '(' : ''}${fmtUSD(Math.abs(net))}${net < 0 ? ')' : ''}` : '—'} color={ready ? (net >= 0 ? GREEN : CHART.red) : undefined} />
      </div>
    </Card>
  )
}

const Kpi = ({ label, value, color }) => (
  <div>
    <div className="al-label">{label}</div>
    <div style={{ fontSize: 20, fontWeight: 500, color: value === '—' ? '#b5c2cd' : (color || NAVY), letterSpacing: '-0.3px', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
  </div>
)
