import { Scale, BadgeDollarSign, Timer, GraduationCap, Smile } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ErrorBar, ReferenceLine, Cell,
} from 'recharts'
import { useLive } from '../live'
import { Card, Grid, PageHeading, Note, Coverage, ChartTip, Info, NAVY, MUTED, DIM, CHART, HAIRLINE, fmtPct, fmtInt } from '../ui'
import { ViewBody, useScope, periodLabel } from './common'

const ICONS = { pay_ratio: BadgeDollarSign, overtime: Timer, training: GraduationCap, satisfaction: Smile }

export const fmtP = p => p == null ? '—' : p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`
const fmtVal = (unit, v) => v == null ? '—'
  : unit === 'ratio' ? `${(v * 100).toFixed(1)}%`
  : unit === 'hrs' ? `${v.toFixed(1)} hrs`
  : v.toFixed(2)

export default function Factors() {
  const state = useLive('/factors')
  const scope = useScope()
  return <ViewBody state={state}>{d => <FactorsBody d={d} scope={scope} />}</ViewBody>
}

function FactorsBody({ d, scope }) {
  const span = Math.max(0.05, ...d.factors.flatMap(f => [Math.abs(f.diff_lo ?? 0), Math.abs(f.diff_hi ?? 0)])) * 1.15
  const x = v => `${50 + (v / span) * 50}%`

  return (
    <div className="fade-in">
      <PageHeading
        title="Factors: leavers vs. stayers"
        subtitle={`Which workplace factors are most strongly associated with leaving · ${scope} · ${periodLabel(d.period)}`}
        right={
          <div style={{ display: 'flex', gap: 22, textAlign: 'right' }}>
            <Mini label="Employees in period" value={fmtInt(d.population)} />
            <Mini label="Left in period" value={fmtInt(d.leavers)} />
            <Mini label="Share who left" value={fmtPct(d.base_share)} />
          </div>
        }
      />

      <Card icon={Scale} title="Difference in share who left" note="higher-risk group minus everyone else, with 95% confidence interval" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 300px) 1fr 190px', gap: 16, alignItems: 'center' }}>
          <div />
          <div style={{ position: 'relative', height: 18, fontSize: 10.5, color: MUTED }}>
            {[-span, -span / 2, 0, span / 2, span].map(v => (
              <span key={v} style={{ position: 'absolute', left: x(v), transform: 'translateX(-50%)' }}>
                {v === 0 ? 'no difference' : `${v > 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(0)} pts`}
              </span>
            ))}
          </div>
          <div />
          {d.factors.map(f => {
            const clear = f.diff_lo != null && (f.diff_lo > 0 || f.diff_hi < 0)
            const color = clear ? (f.diff > 0 ? CHART.red : CHART.navy) : CHART.slate
            return [
              <div key={f.key + 'l'} style={{ padding: '6px 0' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{f.risk_label}</div>
                <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>
                  {fmtPct(f.risk_share)} left (n={fmtInt(f.risk_n)}) vs {fmtPct(f.ref_share)} for {f.ref_label.toLowerCase()} (n={fmtInt(f.ref_n)})
                </div>
              </div>,
              <div key={f.key + 'c'} style={{ position: 'relative', height: 34, borderTop: `1px solid ${HAIRLINE}`, borderBottom: `1px solid ${HAIRLINE}` }}>
                <div style={{ position: 'absolute', left: '50%', top: -4, bottom: -4, borderLeft: `2px dashed ${NAVY}`, opacity: 0.35 }} />
                {f.diff != null && <>
                  <div style={{ position: 'absolute', top: 15, height: 4, borderRadius: 2, background: color, opacity: 0.35, left: x(f.diff_lo), width: `calc(${x(f.diff_hi)} - ${x(f.diff_lo)})` }} />
                  <div style={{ position: 'absolute', top: 10, width: 14, height: 14, borderRadius: '50%', background: color, border: '2px solid #fff', boxShadow: '0 1px 3px rgba(13,27,42,.3)', left: x(f.diff), transform: 'translateX(-50%)' }} />
                </>}
              </div>,
              <div key={f.key + 'r'} style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: clear ? color : DIM }}>
                  {f.diff == null ? '—' : `${f.diff > 0 ? '+' : '−'}${Math.abs(f.diff * 100).toFixed(1)} pts`}
                </div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                  {f.diff_lo != null ? `${(f.diff_lo * 100).toFixed(1)} to ${(f.diff_hi * 100).toFixed(1)} · ${fmtP(f.p_value)}` : ''}
                </div>
                {!clear && f.diff != null && <div style={{ fontSize: 10.5, fontWeight: 700, color: '#B27A15', marginTop: 2 }}>Not statistically clear</div>}
              </div>,
            ]
          })}
        </div>
        <Note>
          Each row compares the share of employees who left during the period. A bar that crosses the dashed line means the data can't
          tell the two groups apart. Chi-square test for the p-value. These are associations, not causes: each one becomes a test with a success measure.
        </Note>
      </Card>

      <Grid cols="repeat(auto-fit, minmax(460px, 1fr))">
        {d.factors.map(f => <FactorCard key={f.key} f={f} base={d.base_share} />)}
      </Grid>
    </div>
  )
}

function Mini({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: NAVY, letterSpacing: '-0.03em', marginTop: 2 }}>{value}</div>
    </div>
  )
}

function FactorCard({ f, base }) {
  const Icon = ICONS[f.key]
  const data = f.bands.map(b => ({
    ...b, err: b.share != null ? [b.share - b.lo, b.hi - b.share] : [0, 0],
  }))
  const top = Math.max(...f.bands.map(b => b.hi || 0), base || 0)
  const step = top > 0.3 ? 0.1 : 0.05
  const ticks = Array.from({ length: Math.ceil(top / step) + 1 }, (_, i) => +(i * step).toFixed(2))
  return (
    <Card icon={Icon} title={f.label} right={<Coverage pct={f.coverage} label={`coverage · ${f.source}`} />}>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="band" tick={{ fontSize: 11, fill: DIM }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, ticks[ticks.length - 1]]} ticks={ticks} tickFormatter={v => `${Math.round(v * 100)}%`} tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'rgba(13,27,42,0.04)' }} content={
              <ChartTip fmt={(v, k) => fmtPct(v)} labelFmt={l => {
                const b = f.bands.find(x => x.band === l)
                return `${l} · ${b?.leavers} of ${b?.n} left`
              }} />
            } />
            <ReferenceLine y={base} stroke={NAVY} strokeDasharray="4 4" strokeOpacity={0.5} />
            <Bar dataKey="share" name="Share who left" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map(b => <Cell key={b.band} fill={b.small ? '#C9D2DF' : b.lo > base ? CHART.red : CHART.navy} />)}
              <ErrorBar dataKey="err" width={6} strokeWidth={1.5} stroke={NAVY} direction="y" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', gap: 18, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${HAIRLINE}`, fontSize: 12, color: DIM, flexWrap: 'wrap' }}>
        <span>Leavers avg <b style={{ color: CHART.red }}>{fmtVal(f.unit, f.leaver_mean)}</b></span>
        <span>Stayers avg <b style={{ color: NAVY }}>{fmtVal(f.unit, f.stayer_mean)}</b></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', color: MUTED }}>
          Welch t-test {fmtP(f.mean_p)} · dashed = all ({fmtPct(base)})
          <Info text="Compares the average for people who left in the period against people still employed at its end. Whiskers are 95% confidence intervals; a band is red only when its whole interval sits above the all-employee share." />
        </span>
      </div>
    </Card>
  )
}
