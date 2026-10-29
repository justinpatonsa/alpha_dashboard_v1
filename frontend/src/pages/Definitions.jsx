import { Card, CardHeader, Grid, Surface, NAVY, MUTED } from '../ui'

// Proposal 3.2, worded as submitted. "Proposed defaults: final definitions
// depend on the data shape confirmed in discovery."
const METRICS = [
  { name: 'Departure rate', when: 'Monthly or selected period (history data)', population: 'Employees active during the period, within the filtered group', num: 'Departures dated in the period', den: 'Average headcount over the period (monthly: (start + end) ÷ 2)' },
  { name: 'Cohort attrition rate', when: 'Fallback if the data is a fixed cohort', population: 'Employees in the cohort', num: 'Cohort members who left', den: 'Cohort size at the start' },
  { name: 'Retention rate', when: 'Selected period', population: 'Employees active at period start', num: 'Those still employed at period end', den: 'Headcount at period start' },
  { name: 'Voluntary share', when: 'Selected period', population: 'Departures in the period', num: 'Voluntary departures', den: 'All departures (only if a reason type exists)' },
  { name: 'Replacement cost', when: 'Per departure', population: 'Departures in the period', num: 'Recruiting + onboarding + vacancy cover (net) + ramp-up productivity', den: '—' },
]

const RULES = [
  ['Filters', 'Apply to every view; numerator and denominator move together.'],
  ['Small groups', 'Under 10 employees: flagged, not ranked.'],
  ['Associations', 'Not causes. Nothing predicts individuals.'],
  ['Coverage', 'Shown on every survey and exit result.'],
  ['No imputation', 'Missing responses stay “no response”.'],
]

export default function Definitions() {
  return (
    <div className="al-page fade-in">
      <Surface>
        <CardHeader title="Metrics" note="Proposal 3.2 · finalised after discovery" />
        <div className="ds-table-scroll" role="region" aria-label="Metric definitions" tabIndex={0}>
          <table className="ds-table al-wrap" style={{ minWidth: 860 }}>
            <thead><tr>{['Metric', 'Period', 'Population', 'Numerator', 'Denominator'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {METRICS.map(m => (
                <tr key={m.name}>
                  <th scope="row">{m.name}</th>
                  <td>{m.when}</td><td>{m.population}</td><td>{m.num}</td><td>{m.den}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>
      <Card title="Rules">
        <Grid cols="repeat(auto-fit, minmax(180px, 1fr))" gap={16}>
          {RULES.map(([h, t]) => (
            <div key={h}>
              <div style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>{h}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 1.6 }}>{t}</div>
            </div>
          ))}
        </Grid>
      </Card>
    </div>
  )
}
