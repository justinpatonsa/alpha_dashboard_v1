import { Grid3x3, Factory, Layers, Briefcase, Clock3 } from 'lucide-react'
import { useLive, useLiveContext } from '../live'
import { Card, Grid, PageHeading, Note, Info, NAVY, MUTED, HAIRLINE, fmtPct, fmtInt } from '../ui'
import { ViewBody, useScope, periodLabel, RateRow, DEF } from './common'

const DIM_META = {
  plant: { title: 'By plant', icon: Factory },
  department: { title: 'By department', icon: Layers },
  role: { title: 'By role', icon: Briefcase },
  shift: { title: 'By shift', icon: Clock3 },
}
const SHIFTS = ['Day', 'Evening', 'Night']

export default function Where() {
  const state = useLive('/where')
  const scope = useScope()
  return <ViewBody state={state}>{d => <WhereBody d={d} scope={scope} />}</ViewBody>
}

// Diverging tint around the company rate: navy below, red above.
function cellStyle(ratio, small) {
  if (ratio == null || small) return { background: '#F6F8FB', color: MUTED }
  if (ratio >= 1) {
    const a = Math.min(1, (ratio - 1) / 1.3)
    return { background: `rgba(176,48,37,${0.08 + a * 0.82})`, color: a > 0.45 ? '#fff' : NAVY }
  }
  const a = Math.min(1, (1 - ratio) / 0.7)
  return { background: `rgba(47,91,140,${0.06 + a * 0.3})`, color: NAVY }
}

function WhereBody({ d, scope }) {
  const { setFilters } = useLiveContext()
  const plants = d.dimensions.plant.map(p => p.group).sort()
  const cell = (pl, sh) => d.matrix.find(m => m.plant === pl && m.shift === sh)
  const plantRow = pl => d.dimensions.plant.find(p => p.group === pl)
  const focus = (patch) => setFilters(f => ({ ...f, ...patch }))

  return (
    <div className="fade-in">
      <PageHeading
        title="Where departures concentrate"
        subtitle={`Departure rate by plant, department, role and shift against the company rate · ${scope} · ${periodLabel(d.period)}`}
        right={
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              Company rate<Info text={DEF.rate} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: NAVY, letterSpacing: '-0.03em' }}>{fmtPct(d.company_rate)}</div>
            <div style={{ fontSize: 11.5, color: MUTED }}>{fmtInt(d.company_deps)} departures · avg {fmtInt(d.company_hc)} employees</div>
          </div>
        }
      />

      <Card icon={Grid3x3} title="Plant × shift" note="departure rate; shading shows distance from the company rate" style={{ marginBottom: 16 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 6, minWidth: 620 }}>
            <thead>
              <tr>
                <th style={th}></th>
                {SHIFTS.map(s => <th key={s} style={th}>{s}</th>)}
                <th style={{ ...th, borderLeft: `1px solid ${HAIRLINE}` }}>All shifts</th>
              </tr>
            </thead>
            <tbody>
              {plants.map(pl => {
                const row = plantRow(pl)
                return (
                  <tr key={pl}>
                    <td style={{ fontSize: 13, fontWeight: 700, color: NAVY, padding: '0 10px 0 2px', whiteSpace: 'nowrap' }}>{pl}</td>
                    {SHIFTS.map(sh => {
                      const c = cell(pl, sh)
                      if (!c) return <td key={sh} style={{ ...cellBase, background: '#FAFBFD', color: '#C3CCDA', textAlign: 'center' }}>—</td>
                      const st = cellStyle(c.vs_company, c.small)
                      return (
                        <td key={sh} onClick={() => focus({ plant: pl, shift: sh })} title={`Filter to ${pl} · ${sh}`}
                          style={{ ...cellBase, ...st, cursor: 'pointer' }}>
                          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>{fmtPct(c.rate)}</div>
                          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
                            {c.small ? 'n<10 · not ranked' : `${c.vs_company.toFixed(2)}× · ${c.departures} of avg ${Math.round(c.avg_hc)}`}
                          </div>
                        </td>
                      )
                    })}
                    <td style={{ ...cellBase, borderLeft: `1px solid ${HAIRLINE}`, background: '#fff', color: NAVY }}>
                      <div style={{ fontSize: 16, fontWeight: 800 }}>{fmtPct(row?.rate)}</div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{row ? `${row.vs_company?.toFixed(2)}× company` : ''}</div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Note>Red cells run above the company rate; the darker, the further above. Click a cell to filter every view to that plant and shift.</Note>
      </Card>

      <Grid cols="repeat(auto-fit, minmax(460px, 1fr))">
        {Object.entries(DIM_META).map(([key, m]) => {
          const rows = d.dimensions[key]
          const max = Math.max(...rows.map(r => r.rate || 0), d.company_rate || 0) * 1.08
          const above = rows.filter(r => r.well_above).length
          return (
            <Card key={key} icon={m.icon} title={m.title}
              note={above ? `${above} well above company` : 'none well above company'}>
              {rows.map(r => (
                <RateRow key={r.group} label={r.group} rate={r.rate} company={d.company_rate} max={max}
                  n={r.avg_hc} small={r.small} wellAbove={r.well_above}
                  sub={`${r.departures} departures · avg ${Math.round(r.avg_hc)}`}
                  onClick={() => focus({ [key]: r.group })} />
              ))}
            </Card>
          )
        })}
      </Grid>
      <Note>
        Red = 20% or more above the company rate. Groups averaging fewer than {d.small_threshold} employees are hatched and flagged, not ranked:
        one departure moves their rate too much to compare.
      </Note>
    </div>
  )
}

const th = { fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'left', padding: '0 12px 4px' }
const cellBase = { padding: '12px 14px', borderRadius: 10, verticalAlign: 'top', transition: 'background .3s' }
