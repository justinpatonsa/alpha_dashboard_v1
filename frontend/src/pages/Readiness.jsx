/* Build status — what this build can already prove, what waits on the data,
   and how each SOW acceptance test stands. Honest about every line. */
import { CheckCircle2, CircleDashed, CircleDot } from 'lucide-react'
import { Card, Grid, Surface, NAVY, MUTED, DIM, GREEN, AMBER } from '../ui'

const WORKING = [
  'Five views, filters and period selector',
  'Live query on every change + every 15 s',
  'Status bar and "data unavailable" state',
  'Read-only Supabase connection check',
  'Definitions behind every ?',
  'Cost model and both scenarios',
]
const WAITING = [
  ['Filter values', 'D1'],
  ['Every figure', 'D1'],
  ['Bands, survey topics, exit themes', 'D2'],
  ['Cost inputs and recommendations', 'D3'],
  ['Hosting (Cloudflare)', 'W6'],
]

const TESTS = [
  { d: 'D4', test: 'All five views load', state: 'met' },
  { d: 'D4', test: 'Filters work alone and combined', state: 'partial', note: 'Period only' },
  { d: 'D4', test: 'Five filter combinations match SQL totals', state: 'pending' },
  { d: 'D4', test: 'Filter or view change updates last-query time', state: 'met' },
  { d: 'D4', test: 'Broken connection shows an error and no data', state: 'met' },
  { d: 'D5', test: 'Client test change shows within 30 seconds', state: 'pending' },
  { d: 'D5', test: 'No caching, CSV reads or saved extracts', state: 'partial', note: 'Review at W7' },
]

const MILESTONES = [
  ['W2', 'D1', 'Data assessment + gate'], ['W4', 'D2', 'Retention analysis'], ['W5', 'D3', 'Cost model + scenarios'],
  ['W6', 'D4', 'Hosted dashboard'], ['W7', 'D5', 'Live test + validation'], ['W8', 'D6', 'Leadership presentation'],
]

const QUESTIONS = [
  'Workforce history or a fixed cohort?',
  'Are group fields dated or current-only?',
  'Is departure type recorded?',
  'Can Alpha share cost and salary data?',
  'Can the client commit a test record at acceptance?',
  'Hosted app OK, and who gets access?',
  'What improvement levels for the scenarios?',
]

const BADGE = {
  met: { tone: 'positive', label: 'Works now', Icon: CheckCircle2 },
  partial: { tone: 'info', label: 'Partly', Icon: CircleDot },
  pending: { tone: 'warning', label: 'Needs data', Icon: CircleDashed },
}

export default function Readiness() {
  return (
    <div className="al-page fade-in">
      <Grid cols="minmax(0, 1.25fr) minmax(0, 1fr)" style={{ alignItems: 'start' }}>
        <Card title="Working tonight">
          {WORKING.map(w => (
            <div key={w} className="al-row" style={{ alignItems: 'flex-start', color: DIM }}>
              <CheckCircle2 size={15} color={GREEN} style={{ flexShrink: 0, marginTop: 1 }} />{w}
            </div>
          ))}
        </Card>
        <Card title="Waits on the data">
          {WAITING.map(([w, when]) => (
            <div key={w} className="al-row" style={{ alignItems: 'flex-start', color: DIM }}>
              <CircleDashed size={15} color={AMBER} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ flex: 1 }}>{w}</span>
              <span style={{ fontSize: 11, color: MUTED, whiteSpace: 'nowrap' }}>{when}</span>
            </div>
          ))}
        </Card>
      </Grid>

      <Surface>
        <div className="ds-toolbar"><h2>Acceptance tests ({TESTS.length})</h2><span style={{ fontSize: 11, color: MUTED }}>SOW D4, D5</span></div>
        <div className="ds-table-scroll" role="region" aria-label="Acceptance tests" tabIndex={0}>
          <table className="ds-table">
            <thead><tr><th scope="col">Deliverable</th><th scope="col">Test</th><th scope="col">Status</th><th scope="col">Note</th></tr></thead>
            <tbody>
              {TESTS.map(t => {
                const b = BADGE[t.state]
                return (
                  <tr key={t.test}>
                    <td style={{ width: 90, fontWeight: 600 }}>{t.d}</td>
                    <th scope="row">{t.test}</th>
                    <td><span className={`al-state al-state--${b.tone}`}><b.Icon size={13} />{b.label}</span></td>
                    <td style={{ color: MUTED }}>{t.note}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Surface>

      <Grid cols="minmax(0, 1fr) minmax(0, 1fr)">
        <Card title="Milestones">
          <div style={{ position: 'relative', padding: '8px 4px 0', overflowX: 'auto' }}>
            <div style={{ position: 'absolute', left: 14, right: 14, top: 21, height: 1, background: '#c3d0db' }} />
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${MILESTONES.length}, minmax(64px, 1fr))`, position: 'relative' }}>
              {MILESTONES.map(([w, d, label]) => (
                <div key={w} style={{ textAlign: 'center' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', margin: '8px auto 9px', background: '#fff', border: '2px solid var(--ds-action)' }} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>{d}</div>
                  <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{w}</div>
                  <div style={{ fontSize: 11, color: DIM, marginTop: 5, lineHeight: 1.35, padding: '0 4px' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card title="Questions for Alpha">
          <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 7 }}>
            {QUESTIONS.map(q => <li key={q} style={{ fontSize: 12, color: DIM, lineHeight: 1.5 }}>{q}</li>)}
          </ol>
        </Card>
      </Grid>
    </div>
  )
}
