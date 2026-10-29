/* Data discovery (D1) — the one reference page that shows real data today:
   the live state of the connection, and once signed in, every table Alpha's
   account can see with its row count and columns. Never row values. */
import { KeyRound, Circle, CheckCircle2, CircleDashed, AlertTriangle, HelpCircle } from 'lucide-react'
import { useLive } from '../live'
import { Card, CardHeader, Grid, Surface, NAVY, MUTED, DIM, fmtInt } from '../ui'
import { Unavailable, Loading } from '../states'

// RFP section 4, the only description of the data available before access.
const AREAS = [
  { area: 'Employee and employment information', desc: 'Organizational assignments, employment history, retention and departure information, and selected HR measures', feeds: 'Overview, Where, Factors' },
  { area: 'Compensation and development', desc: 'Compensation information and employee training or development records', feeds: 'Factors, Cost' },
  { area: 'Employee feedback', desc: 'Survey information concerning employee experience and workplace conditions', feeds: 'Employee voice, Factors' },
  { area: 'Departure feedback', desc: 'Exit-interview information and reported reasons for leaving, where available', feeds: 'Employee voice' },
]

// Proposal 3.1: what the week 1–2 assessment confirms for every table.
const CHECKS = [
  'Keys and field definitions',
  'Volume and time period',
  'Completeness and duplicates',
  'Workforce history or fixed cohort',
  'Group fields dated or current-only',
  'Departure type recorded',
  'Row counts reconcile',
  'Counts hold after every join',
]

const STATE_TEXT = {
  connected: { tone: 'positive', Icon: CheckCircle2, title: 'Connected, read-only' },
  awaiting_credentials: { tone: 'warning', Icon: CircleDashed, title: 'Project reachable · awaiting access key' },
  auth_failed: { tone: 'negative', Icon: AlertTriangle, title: 'Sign-in failed' },
  unreachable: { tone: 'negative', Icon: AlertTriangle, title: 'Project unreachable' },
  error: { tone: 'negative', Icon: AlertTriangle, title: 'Connection error' },
}

export default function Discovery() {
  const state = useLive('/discovery')
  if (state.error) return <Unavailable detail={state.error} />
  if (!state.data) return <Loading />
  const d = state.data
  const st = d.status
  const s = STATE_TEXT[st.state] || { tone: 'info', Icon: HelpCircle, title: st.state }
  const t = new Date(d.queried_at).toLocaleTimeString('en-US', { hour12: false })

  return (
    <div className="al-page fade-in">
      <Grid cols="minmax(0, 1.2fr) minmax(0, 1fr)">
        <Card title="Connection" note={`Checked ${t}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span className={`al-state al-state--${s.tone}`} style={{ fontSize: 12 }}><s.Icon size={15} />{s.title}</span>
            <code className="al-code">{st.project || '—'}</code>
          </div>
          {st.missing?.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <KeyRound size={14} color={MUTED} />
              <span style={{ fontSize: 12, color: MUTED }}>Missing in <code className="al-code">.env</code>:</span>
              {st.missing.map(m => <code key={m} className="al-code">{m}</code>)}
            </div>
          )}
        </Card>
        <Card title="Why there are no numbers">
          <blockquote style={{ margin: 0, padding: '2px 0 2px 14px', borderLeft: '3px solid var(--ds-action)', fontSize: 14, color: NAVY, lineHeight: 1.55 }}>
            “No database access, sample data, schema, field list, or data dictionary will be provided for preparing the proposal.”
          </blockquote>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>Alpha RFP, section 4</div>
        </Card>
      </Grid>

      {d.tables.length > 0 ? (
        <Surface>
          <div className="ds-toolbar"><h2>Tables ({d.tables.length})</h2><span style={{ fontSize: 11, color: MUTED }}>Names, row counts and columns only</span></div>
          <div className="ds-table-scroll" role="region" aria-label="Tables" tabIndex={0}>
            <table className="ds-table al-wrap">
              <thead><tr><th scope="col">Table</th><th scope="col" className="ds-number">Rows</th><th scope="col">Columns</th></tr></thead>
              <tbody>
                {d.tables.map(tb => (
                  <tr key={tb.table}>
                    <th scope="row" style={{ whiteSpace: 'nowrap' }}><code className="al-code">{tb.table}</code></th>
                    <td className="ds-number al-num" style={{ whiteSpace: 'nowrap' }}>{tb.error ? '—' : fmtInt(tb.rows)}</td>
                    <td style={{ color: DIM }}>{tb.error || tb.columns.join(', ') || '(no readable rows)'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
      ) : (
        <Surface>
          <CardHeader title="Expected data areas" note="RFP section 4" />
          <div className="ds-table-scroll" role="region" aria-label="Expected data areas" tabIndex={0}>
            <table className="ds-table al-wrap">
              <thead><tr><th scope="col">Data area</th><th scope="col">What the RFP says it holds</th><th scope="col">Status</th></tr></thead>
              <tbody>
                {AREAS.map(a => (
                  <tr key={a.area}>
                    <th scope="row">{a.area}</th>
                    <td>{a.desc}</td>
                    <td><span className="al-state al-state--warning"><CircleDashed size={13} />Not yet seen</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
      )}

      <Card title="Week 1–2 checks" note="Reported in D1">
        <Grid cols="repeat(4, minmax(0, 1fr))" gap={8}>
          {CHECKS.map(c => (
            <div key={c} style={{ display: 'flex', gap: 9, alignItems: 'center', fontSize: 12, color: DIM, padding: '4px 0' }}>
              <Circle size={15} color="#b5c2cd" style={{ flexShrink: 0 }} />
              {c}
            </div>
          ))}
        </Grid>
      </Card>
    </div>
  )
}
