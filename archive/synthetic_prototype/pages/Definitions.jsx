import { BookOpen, Database, CheckCircle2, XCircle, Ruler, RadioTower } from 'lucide-react'
import { useLive } from '../live'
import { Card, Grid, PageHeading, Note, Coverage, NAVY, MUTED, DIM, HAIRLINE, GREEN, CHART, fmtInt } from '../ui'
import { ViewBody } from './common'

const METRICS = [
  { name: 'Headcount', population: 'Employees in the filtered group', period: 'Last day of the period (today for the current month)', num: 'Employees with hire date ≤ day and no departure on or before it', den: '—' },
  { name: 'Departures', population: 'Employees in the filtered group', period: 'Selected start to end month', num: 'Employees whose departure date falls in the period', den: '—' },
  { name: 'Departure rate', population: 'Employees active in the period, filtered group', period: 'Monthly or the selected period', num: 'Departures dated in the period', den: 'Average headcount: each month (start + end) ÷ 2, then the mean of the months' },
  { name: 'Retention rate', population: 'Employees on the books at period start', period: 'Selected period', num: 'Of those, still employed at period end', den: 'Headcount at period start' },
  { name: 'Voluntary share', population: 'Departures in the period', period: 'Selected period', num: 'Voluntary departures', den: 'All departures (shown only because a departure type exists)' },
  { name: 'Cohort attrition rate', population: 'A fixed cohort, if the data has no dated history', period: 'Cohort window', num: 'Cohort members who left', den: 'Cohort size at the start (fallback, not used with this data)' },
  { name: 'Replacement cost', population: 'Departures in the period', period: 'Selected period', num: 'Recruiting + onboarding + vacancy cover (net of unpaid salary) + lost productivity during ramp-up', den: 'Per departure; low / base / high assumptions, each labelled client-supplied or assumption' },
  { name: 'Share who left (Factors)', population: 'Employees active at any point in the period, with the factor recorded', period: 'Selected period', num: 'Those who left during the period', den: 'All of them; 95% Wilson interval per band, chi-square across groups' },
]

const RULES = [
  ['Filters', 'Plant, department, role, shift and months apply to every view and always change numerator and denominator together.'],
  ['Small groups', 'Groups averaging fewer than 10 employees are flagged, not ranked.'],
  ['Well above', 'A group is "well above" the company when its rate is 20% or more above the company rate for the same filter and period.'],
  ['Associations', 'Factor and survey differences are associations, not causes. Logistic regression is descriptive; no individual is scored or predicted.'],
  ['Employee voice', 'Exit reasons are reported reasons, not proven causes. Coverage is shown on every survey and exit result.'],
]

export default function Definitions() {
  const state = useLive('/coverage')
  return <ViewBody state={state}>{d => <Body d={d} />}</ViewBody>
}

function Body({ d }) {
  return (
    <div className="fade-in">
      <PageHeading title="Definitions and data" subtitle="How every number on this dashboard is defined, and what the data covers. Each metric's ? icon shows the same definition in place." />

      <Card icon={BookOpen} title="Metric definitions" note="population, period, numerator, denominator" pad="4px 20px 14px" style={{ marginBottom: 16 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 860 }}>
            <thead>
              <tr>{['Metric', 'Population', 'Period', 'Numerator', 'Denominator'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {METRICS.map(m => (
                <tr key={m.name}>
                  <td style={{ ...td, fontWeight: 700, color: NAVY, whiteSpace: 'nowrap' }}>{m.name}</td>
                  <td style={td}>{m.population}</td><td style={td}>{m.period}</td><td style={td}>{m.num}</td><td style={td}>{m.den}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Grid cols="minmax(0, 1.4fr) minmax(0, 1fr)" style={{ marginBottom: 16, alignItems: 'start' }}>
        <Card icon={Database} title="Data coverage" note="queried live from the database" pad="4px 20px 14px">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>{['Table', 'Data area', 'Rows', 'Covers', 'Dates'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {d.tables.map(t => (
                <tr key={t.table}>
                  <td style={{ ...td, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, color: NAVY, fontWeight: 600 }}>{t.table}</td>
                  <td style={td}>{t.area}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: NAVY }}>{fmtInt(t.rows)}</td>
                  <td style={td}><Coverage pct={t.coverage} label={`of ${t.basis}`} /></td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{t.dates}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Note>Not every employee has a survey response or exit interview; those views show their coverage on every chart.</Note>
        </Card>

        <div style={{ display: 'grid', gap: 16 }}>
          <Card icon={CheckCircle2} title="Data checks" note="run on every load">
            {d.checks.map(c => (
              <div key={c.check} style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '6px 0', fontSize: 12.5, color: DIM }}>
                {c.ok ? <CheckCircle2 size={16} color={GREEN} /> : <XCircle size={16} color={CHART.red} />}
                {c.check}
              </div>
            ))}
          </Card>
          <Card icon={RadioTower} title="Live connection">
            <div style={{ fontSize: 12.5, color: DIM, lineHeight: 1.6 }}>
              Every page load, filter and view change queries the database directly: no cache, no CSV extracts, <code style={code}>Cache-Control: no-store</code> on
              every response. The open view re-queries every 15 seconds, so a committed change shows within 30 seconds without a reload.
              If the connection fails the dashboard says so and shows no figures.
            </div>
          </Card>
        </div>
      </Grid>

      <Card icon={Ruler} title="Rules applied everywhere">
        <Grid cols="repeat(auto-fit, minmax(260px, 1fr))" gap={14}>
          {RULES.map(([h, t]) => (
            <div key={h}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: NAVY }}>{h}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 1.5 }}>{t}</div>
            </div>
          ))}
        </Grid>
      </Card>
    </div>
  )
}

const th = { textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '12px 10px 8px 0', borderBottom: `1px solid ${HAIRLINE}` }
const td = { padding: '9px 10px 9px 0', borderBottom: `1px solid ${HAIRLINE}`, color: DIM, verticalAlign: 'top', lineHeight: 1.45 }
const code = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5, background: '#EEF1F6', padding: '1px 5px', borderRadius: 4, color: NAVY }
