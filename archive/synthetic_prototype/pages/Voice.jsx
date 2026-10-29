import { useState } from 'react'
import { ClipboardList, DoorOpen, Quote, ChevronDown } from 'lucide-react'
import { useLive } from '../live'
import { Card, Grid, PageHeading, Note, Coverage, Legend, Stat, NAVY, MUTED, DIM, CHART, HAIRLINE, TINT, fmtPct, fmtInt } from '../ui'
import { ViewBody, useScope, periodLabel } from './common'
import { monthLabel } from '../TopBar'
import { fmtP } from './Factors'

export default function Voice() {
  const state = useLive('/voice')
  const scope = useScope()
  return <ViewBody state={state}>{d => <VoiceBody d={d} scope={scope} />}</ViewBody>
}

function VoiceBody({ d, scope }) {
  const s = d.survey
  const x = d.exit
  const [open, setOpen] = useState(null)
  const maxTheme = Math.max(...x.themes.map(t => t.n), 1)
  const pos = v => `${((v - 1) / 4) * 100}%`
  const dims = [...s.dimensions].sort((a, b) => (a.diff ?? 0) - (b.diff ?? 0))

  return (
    <div className="fade-in">
      <PageHeading
        title="Employee voice"
        subtitle={`Survey scores and reported reasons for leaving, with coverage shown on every result · ${scope} · ${periodLabel(d.period)}`}
      />

      <Grid cols="repeat(auto-fit, minmax(220px, 1fr))" style={{ marginBottom: 16 }}>
        <Stat label="Survey coverage" value={fmtPct(s.coverage, 0)} sub={`${fmtInt(s.respondents)} of ${fmtInt(s.population)} employees responded`}
          info="Employees in the filtered population with an experience-survey response ÷ all employees active in the period." />
        <Stat label="Leavers who responded" value={fmtInt(s.leaver_respondents)} sub={`vs ${fmtInt(s.stayer_respondents)} stayers`}
          info="Survey respondents who left during the period. Their answers come from the last survey wave before they left." />
        <Stat label="Exit interview coverage" value={fmtPct(x.coverage, 0)} sub={`${fmtInt(x.interviews)} of ${fmtInt(x.departures)} departures`}
          info="Departures in the period with an exit interview ÷ all departures in the period." />
        <Stat label="Top reported theme" value={x.themes[0]?.theme || '—'} sub={x.themes[0] ? `${fmtPct(x.themes[0].share, 0)} of interviews` : ''}
          info="Most common theme among exit-interview reasons in the period. A reported reason, not a proven cause." />
      </Grid>

      <Grid cols="minmax(0, 1.05fr) minmax(0, 1fr)" style={{ marginBottom: 16 }}>
        <Card icon={ClipboardList} title="Experience survey" note="average score, 1–5"
          right={<Coverage pct={s.coverage} label="responded" />}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <Legend items={[{ label: 'Left in period', color: CHART.red }, { label: 'Stayed', color: CHART.navy }]} />
            <span style={{ fontSize: 11, color: MUTED }}>biggest gap first</span>
          </div>
          {dims.map(dm => (
            <div key={dm.key} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 92px', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: `1px solid ${HAIRLINE}` }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: NAVY }}>{dm.label}</span>
              <div style={{ position: 'relative', height: 16 }}>
                <div style={{ position: 'absolute', left: 0, right: 0, top: 7, height: 2, background: '#EEF1F6' }} />
                {[1, 2, 3, 4, 5].map(t => <div key={t} style={{ position: 'absolute', left: pos(t), top: 4, height: 8, width: 1, background: '#DDE3EC' }} />)}
                {dm.leavers != null && dm.stayers != null && (
                  <div style={{ position: 'absolute', top: 6, height: 4, background: 'rgba(176,48,37,0.25)', left: pos(Math.min(dm.leavers, dm.stayers)), width: `calc(${pos(Math.max(dm.leavers, dm.stayers))} - ${pos(Math.min(dm.leavers, dm.stayers))})` }} />
                )}
                {dm.stayers != null && <Dot left={pos(dm.stayers)} color={CHART.navy} title={`Stayed: ${dm.stayers.toFixed(2)}`} />}
                {dm.leavers != null && <Dot left={pos(dm.leavers)} color={CHART.red} title={`Left: ${dm.leavers.toFixed(2)}`} />}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: dm.diff < -0.2 ? CHART.red : DIM }}>
                  {dm.diff == null ? '—' : `${dm.diff > 0 ? '+' : '−'}${Math.abs(dm.diff).toFixed(2)}`}
                </div>
                <div style={{ fontSize: 10.5, color: MUTED }}>{fmtP(dm.p_value)}</div>
              </div>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 92px', gap: 14, marginTop: 6 }}>
            <span />
            <div style={{ position: 'relative', height: 14, fontSize: 10.5, color: MUTED }}>
              {[1, 2, 3, 4, 5].map(t => <span key={t} style={{ position: 'absolute', left: pos(t), transform: 'translateX(-50%)' }}>{t}</span>)}
            </div>
          </div>
          <Note>Leavers' answers are from the last survey wave before they left. Night shift responds least often, so read shift-level gaps with that in mind.</Note>
        </Card>

        <Card icon={DoorOpen} title="Reported reasons for leaving" note="exit interviews, grouped into themes"
          right={<Coverage pct={x.coverage} label="of leavers" />}>
          {x.themes.map(t => (
            <div key={t.theme} style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
              <div className="row-hover" onClick={() => setOpen(open === t.theme ? null : t.theme)} style={{
                display: 'grid', gridTemplateColumns: '160px 1fr 70px 16px', alignItems: 'center', gap: 12,
                padding: '9px 8px', margin: '0 -8px', borderRadius: 8, cursor: 'pointer',
              }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: NAVY }}>{t.theme}</span>
                <div style={{ height: 14, background: '#F0F3F8', borderRadius: 4, display: 'flex', overflow: 'hidden' }}>
                  {['Day', 'Evening', 'Night'].map((sh, i) => (
                    <div key={sh} title={`${sh}: ${t.by_shift[sh] || 0}`} style={{
                      width: `${((t.by_shift[sh] || 0) / maxTheme) * 100}%`, height: '100%',
                      background: [CHART.pale, CHART.mid, CHART.deep][i], transition: 'width .4s',
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: NAVY, textAlign: 'right' }}>
                  {t.n} <span style={{ color: MUTED, fontWeight: 600 }}>· {fmtPct(t.share, 0)}</span>
                </span>
                <ChevronDown size={14} color={MUTED} style={{ transform: open === t.theme ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </div>
              {open === t.theme && (
                <div style={{ padding: '2px 0 10px 12px' }}>
                  {t.reasons.map(r => (
                    <div key={r.reason} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: DIM, padding: '3px 0' }}>
                      <span>{r.reason}</span><b style={{ color: NAVY }}>{r.n}</b>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {!x.themes.length && <div style={{ fontSize: 12.5, color: MUTED }}>No exit interviews in this filter.</div>}
          <div style={{ marginTop: 10 }}>
            <Legend items={[{ label: 'Day', color: CHART.pale }, { label: 'Evening', color: CHART.mid }, { label: 'Night', color: CHART.deep }]} />
          </div>
          <Note>What people said when they left. Labelled as reported reasons, not causes. Click a theme for the reasons inside it.</Note>
        </Card>
      </Grid>

      <Card icon={Quote} title="In their words" note="most recent exit-interview comments in this filter · no names or IDs shown">
        {x.comments.length ? (
          <Grid cols="repeat(auto-fill, minmax(280px, 1fr))" gap={12}>
            {x.comments.map((c, i) => (
              <div key={i} style={{ padding: '13px 14px', borderRadius: 10, background: '#F7F9FC', border: `1px solid ${HAIRLINE}` }}>
                <div style={{ fontSize: 13, color: NAVY, lineHeight: 1.5 }}>“{c.comment}”</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 9, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: TINT.slate.bg, color: TINT.slate.fg }}>{c.theme}</span>
                  <span style={{ fontSize: 11, color: MUTED }}>{c.role} · {c.plant} · {c.shift} · {monthLabel(c.month)}</span>
                </div>
              </div>
            ))}
          </Grid>
        ) : <div style={{ fontSize: 12.5, color: MUTED }}>No comments in this filter.</div>}
      </Card>
    </div>
  )
}

const Dot = ({ left, color, title }) => (
  <div title={title} style={{
    position: 'absolute', left, top: 1, width: 14, height: 14, borderRadius: '50%', transform: 'translateX(-50%)',
    background: color, border: '2px solid #fff', boxShadow: '0 1px 3px rgba(13,27,42,.3)', transition: 'left .4s',
  }} />
)
