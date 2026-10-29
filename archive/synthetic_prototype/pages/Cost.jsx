import { useState } from 'react'
import { SlidersHorizontal, Layers3, Target, Building2, Lightbulb, FlaskConical, Factory } from 'lucide-react'
import { useLive } from '../live'
import {
  Card, Grid, PageHeading, Note, Stat, Pills, Info, Surface,
  NAVY, MUTED, DIM, CHART, HAIRLINE, TINT, GREEN, fmtUSD, fmtUSDFull, fmtPct, fmtInt,
} from '../ui'
import { Unavailable, Loading } from '../states'
import { useScope, periodLabel, DEF, RateRow } from './common'

const LEVELS = [{ value: 'low', label: 'Low' }, { value: 'base', label: 'Base' }, { value: 'high', label: 'High' }]
const EDITABLE = ['recruiting', 'onboarding', 'vacancy_weeks', 'ramp_weeks']

// Scenario defaults. Reductions are assumptions to be tested, not promises.
const SCENARIOS = {
  targeted: { reduction: { low: 0.15, base: 0.25, high: 0.35 }, perEmployee: 500, fixed: 25000 },
  company:  { reduction: { low: 0.05, base: 0.10, high: 0.15 }, perEmployee: 120, fixed: 50000 },
}

export default function Cost() {
  const cost = useLive('/cost')
  const factors = useLive('/factors')
  const scope = useScope()
  const err = cost.error || factors.error
  if (err) return <Unavailable detail={err} />
  if (!cost.data || !factors.data) return <Loading />
  return <CostBody d={cost.data} fx={factors.data} scope={scope} />
}

function CostBody({ d, fx, scope }) {
  const [level, setLevel] = useState('base')
  const [over, setOver] = useState({})          // user edits on top of the level's values
  const [scen, setScen] = useState({})

  const a = Object.fromEntries(EDITABLE.map(k => [k, over[k] ?? d.assumptions[k][level]]))
  const weekly = d.pay_sum / 52
  const comp = {
    recruiting: d.departures * a.recruiting,
    onboarding: d.departures * a.onboarding,
    vacancy: weekly * a.vacancy_weeks * d.overtime_premium_net,
    ramp: weekly * a.ramp_weeks * d.ramp_gap,
  }
  const total = Object.values(comp).reduce((s, v) => s + v, 0)
  const perDep = d.departures ? total / d.departures : 0
  const costOf = (n, pay) => n * (a.recruiting + a.onboarding) + (pay / 52) * (a.vacancy_weeks * d.overtime_premium_net + a.ramp_weeks * d.ramp_gap)

  const sv = (k, field) => scen[`${k}.${field}`] ?? (field === 'reduction' ? SCENARIOS[k].reduction[level] : SCENARIOS[k][field])
  const setSv = (k, field, v) => setScen(s => ({ ...s, [`${k}.${field}`]: v }))

  const topGroups = d.groups.filter(g => d.top2.includes(g.group))
  const tDeps = topGroups.reduce((s, g) => s + g.departures, 0)
  const tPay = topGroups.reduce((s, g) => s + g.pay_sum, 0)
  const tHc = topGroups.reduce((s, g) => s + g.avg_hc, 0)
  const scenario = (k, deps, pay, hc) => {
    const annualDeps = deps * d.annualize
    const per = deps ? costOf(deps, pay) / deps : 0
    const avoidedN = annualDeps * sv(k, 'reduction')
    const avoided = avoidedN * per
    const spend = sv(k, 'perEmployee') * hc + sv(k, 'fixed')
    return { annualDeps, avoidedN, avoided, spend, net: avoided - spend, roi: spend ? (avoided - spend) / spend : null, hc }
  }
  const A = scenario('targeted', tDeps, tPay, tHc)
  const B = scenario('company', d.departures, d.pay_sum, d.avg_hc)

  const reset = lv => { setLevel(lv); setOver({}); setScen({}) }
  const compRows = [
    { key: 'recruiting', label: 'Recruiting', color: CHART.deep },
    { key: 'onboarding', label: 'Onboarding and training', color: CHART.navy },
    { key: 'vacancy', label: 'Vacancy cover (net)', color: CHART.mid },
    { key: 'ramp', label: 'Lost productivity, ramp-up', color: CHART.pale },
  ]
  const costGroups = [...d.groups].map(g => ({ ...g, cost: costOf(g.departures, g.pay_sum) })).sort((x, y) => y.cost - x.cost).slice(0, 6)
  const maxGroupCost = Math.max(...costGroups.map(g => g.cost), 1)

  return (
    <div className="fade-in">
      <PageHeading
        title="Cost and scenarios"
        subtitle={`What departures cost and what an improvement would save · ${scope} · ${periodLabel(d.period)}`}
        right={<span style={{ fontSize: 11, fontWeight: 700, padding: '5px 11px', borderRadius: 999, background: TINT.amber.bg, color: TINT.amber.fg }}>Scenario results are modeled, not measured</span>}
      />

      <Grid cols="minmax(300px, 380px) minmax(0, 1fr)" style={{ marginBottom: 16, alignItems: 'start' }}>
        <Card icon={SlidersHorizontal} title="Assumptions" right={<Pills small value={level} options={LEVELS} onChange={reset} />}>
          {EDITABLE.map(k => {
            const m = d.assumptions[k]
            const edited = over[k] != null
            return (
              <div key={k} style={{ padding: '9px 0', borderBottom: `1px solid ${HAIRLINE}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: NAVY, flex: 1, display: 'flex', alignItems: 'center' }}>
                    {m.label}<Info text={m.help} />
                  </span>
                  <NumberInput value={a[k]} unit={m.unit} edited={edited} onChange={v => setOver(o => ({ ...o, [k]: v }))} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 10.5, color: MUTED }}>
                  <SourceTag source={edited ? 'Edited' : m.source} />
                  <span>low {fmtA(m.unit, m.low)} · base {fmtA(m.unit, m.base)} · high {fmtA(m.unit, m.high)}</span>
                </div>
              </div>
            )
          })}
          <div style={{ padding: '9px 0 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600, color: NAVY }}>
              {d.assumptions.pay.label}<Info text={d.assumptions.pay.help} />
              <span style={{ flex: 1 }} /><span style={{ fontSize: 12, color: DIM }}>avg {fmtUSDFull(d.departures ? d.pay_sum / d.departures : null)}</span>
            </div>
            <div style={{ marginTop: 4 }}><SourceTag source={d.assumptions.pay.source} /></div>
          </div>
          <Note>Per departure: recruiting + onboarding + weekly pay × (vacancy weeks × 0.5 overtime premium + ramp weeks × 0.5 productivity gap).</Note>
        </Card>

        <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
          <Grid cols="repeat(auto-fit, minmax(190px, 1fr))">
            <Stat label="Replacement cost" value={fmtUSD(total)} sub={`${fmtInt(d.departures)} departures in the period`} info={DEF.cost} accent={CHART.red} />
            <Stat label="Cost per departure" value={fmtUSD(perDep)} sub={`${level} assumptions${Object.keys(over).length ? ', edited' : ''}`} info="Replacement cost ÷ departures in the period." />
            <Stat label="Annualized" value={fmtUSD(total * d.annualize)} sub={d.period.months === 12 ? 'period is 12 months' : `${d.period.months}-month period × ${d.annualize.toFixed(2)}`} info="Replacement cost scaled to 12 months at the period's pace." />
          </Grid>
          <Card icon={Layers3} title="What a departure costs" note="share of total replacement cost">
            <div style={{ display: 'flex', height: 26, borderRadius: 6, overflow: 'hidden' }}>
              {compRows.map(c => (
                <div key={c.key} title={`${c.label}: ${fmtUSDFull(comp[c.key])}`} style={{ width: `${total ? (comp[c.key] / total) * 100 : 0}%`, background: c.color, transition: 'width .35s' }} />
              ))}
            </div>
            <Grid cols="repeat(auto-fit, minmax(170px, 1fr))" gap={10} style={{ marginTop: 12 }}>
              {compRows.map(c => (
                <div key={c.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color, marginTop: 3, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11.5, color: DIM }}>{c.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{fmtUSD(comp[c.key])} <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>{total ? fmtPct(comp[c.key] / total, 0) : ''}</span></div>
                  </div>
                </div>
              ))}
            </Grid>
          </Card>
          <Card icon={Factory} title="Where the cost lands" note="plant × shift, highest replacement cost first">
            {costGroups.map(g => (
              <RateRow key={g.group} label={g.group} rate={g.cost} max={maxGroupCost * 1.05} wellAbove={d.top2.includes(g.group)}
                sub={`${g.departures} departures · ${fmtPct(g.rate)} rate`} valueFmt={fmtUSD} />
            ))}
            <Note>Red = one of the two groups with the highest departure rate (Scenario A's target).</Note>
          </Card>
        </div>
      </Grid>

      <Grid cols="repeat(auto-fit, minmax(420px, 1fr))" style={{ marginBottom: 16 }}>
        <ScenarioCard
          icon={Target} title="Scenario A · Targeted"
          who={d.top2.length ? `The two groups with the highest departure rates: ${d.top2.join(' and ')}` : 'No group of 10+ employees in this filter'}
          what="Fixed shift assignments plus a night/rotation differential and supervisor coaching in those groups."
          s={A} k="targeted" sv={sv} setSv={setSv}
        />
        <ScenarioCard
          icon={Building2} title="Scenario B · Company-wide"
          who={`Everyone in the current filter (avg ${fmtInt(d.avg_hc)} employees)`}
          what="Structured first-90-days onboarding, stay interviews and a pay review cycle across the company."
          s={B} k="company" sv={sv} setSv={setSv}
        />
      </Grid>

      <Recommendations d={d} fx={fx} A={A} perDep={perDep} />
    </div>
  )
}

const fmtA = (unit, v) => unit === 'usd' ? fmtUSDFull(v) : `${v} wks`

function SourceTag({ source }) {
  const t = source === 'Client-supplied' ? TINT.green : source === 'Edited' ? TINT.blue : TINT.amber
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: t.bg, color: t.fg }}>{source}</span>
}

function NumberInput({ value, unit, onChange, edited, pct = false, width = 92 }) {
  const shown = pct ? Math.round(value * 100) : value
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', height: 30, borderRadius: 8, padding: '0 8px', gap: 4,
      border: `1px solid ${edited ? '#9CC0EE' : '#E1E6EE'}`, background: edited ? '#F2F7FE' : '#fff', width,
    }}>
      {unit === 'usd' && <span style={{ fontSize: 12, color: MUTED }}>$</span>}
      <input type="number" value={shown} min={0} step={unit === 'usd' ? 100 : 1}
        onChange={e => { const v = Number(e.target.value); if (!Number.isNaN(v)) onChange(pct ? v / 100 : v) }}
        style={{ border: 'none', outline: 'none', width: '100%', fontSize: 13, fontWeight: 700, color: NAVY, fontFamily: 'inherit', background: 'transparent', textAlign: 'right' }} />
      {unit === 'weeks' && <span style={{ fontSize: 11, color: MUTED }}>wks</span>}
      {pct && <span style={{ fontSize: 12, color: MUTED }}>%</span>}
    </div>
  )
}

function ScenarioCard({ icon, title, who, what, s, k, sv, setSv }) {
  const good = s.net >= 0
  const max = Math.max(s.avoided, s.spend, 1)
  return (
    <Card icon={icon} title={title} right={<span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: TINT.amber.bg, color: TINT.amber.fg }}>Modeled</span>}>
      <div style={{ fontSize: 12.5, color: NAVY, fontWeight: 600 }}>{who}</div>
      <div style={{ fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 1.5 }}>{what}</div>

      <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
        <Field label="Departure reduction">
          <NumberInput pct value={sv(k, 'reduction')} edited={false} width={76} onChange={v => setSv(k, 'reduction', v)} />
        </Field>
        <Field label="Cost per employee / yr">
          <NumberInput unit="usd" value={sv(k, 'perEmployee')} edited={false} onChange={v => setSv(k, 'perEmployee', v)} />
        </Field>
        <Field label="Fixed program cost">
          <NumberInput unit="usd" value={sv(k, 'fixed')} edited={false} width={104} onChange={v => setSv(k, 'fixed', v)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${HAIRLINE}` }}>
        <Kpi label="Departures avoided / yr" value={s.avoidedN.toFixed(1)} sub={`of ${s.annualDeps.toFixed(0)} a year`} />
        <Kpi label="Avoided cost / yr" value={fmtUSD(s.avoided)} />
        <Kpi label="Initiative cost / yr" value={fmtUSD(s.spend)} sub={`${fmtInt(s.hc)} employees`} />
      </div>
      <div style={{ marginTop: 12 }}>
        {[['Avoided cost', s.avoided, CHART.navy], ['Initiative cost', s.spend, CHART.slate]].map(([l, v, c]) => (
          <div key={l} style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 10, alignItems: 'center', padding: '3px 0' }}>
            <span style={{ fontSize: 11, color: MUTED }}>{l}</span>
            <div style={{ height: 10, background: '#F0F3F8', borderRadius: 3 }}>
              <div style={{ width: `${(v / max) * 100}%`, height: '100%', background: c, borderRadius: 3, transition: 'width .35s' }} />
            </div>
          </div>
        ))}
      </div>
      <Surface style={{ marginTop: 12, padding: '11px 14px', boxShadow: 'none', background: good ? '#EAF6F0' : '#FDECEC', display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: good ? GREEN : CHART.red, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Net benefit / yr</span>
        <span style={{ fontSize: 22, fontWeight: 800, color: good ? GREEN : CHART.red, letterSpacing: '-0.03em' }}>{s.net < 0 ? '−' : ''}{fmtUSD(Math.abs(s.net))}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: DIM }}>return {s.roi == null ? '—' : `${(s.roi * 100).toFixed(0)}%`}</span>
      </Surface>
    </Card>
  )
}

const Field = ({ label, children }) => (
  <div>
    <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
    {children}
  </div>
)

const Kpi = ({ label, value, sub }) => (
  <div>
    <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: 19, fontWeight: 800, color: NAVY, letterSpacing: '-0.02em', marginTop: 3 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{sub}</div>}
  </div>
)

function Recommendations({ d, fx, A, perDep }) {
  const f = key => fx.factors.find(x => x.key === key)
  const pay = f('pay_ratio')
  const ot = f('overtime')
  const deepBand = pay?.bands[0]
  const unclear = fx.factors.filter(x => x.diff_lo != null && x.diff_lo <= 0 && x.diff_hi >= 0)
  const top = d.groups.find(g => g.group === d.top2[0])
  const L = d.levers

  // If the higher-risk group left at the lower group's share instead of its own.
  const payAvoided = deepBand && fx.base_share != null
    ? Math.max(0, deepBand.share - fx.base_share) * L.deep_below_n * d.annualize * perDep : 0
  const otAvoided = ot?.risk_share != null
    ? Math.max(0, ot.risk_share - ot.ref_share) * L.heavy_ot_n * d.annualize * perDep : 0
  const payNet = payAvoided - L.deep_below_cost

  const recs = [
    top && {
      title: `Stabilize schedules in ${d.top2.join(' and ')}`,
      evidence: `${top.group} runs at ${fmtPct(top.rate)}, ${top.vs_company?.toFixed(1)}× the company rate.`,
      cost: `${fmtUSD(A.spend)} a year (Scenario A)`,
      ret: `${fmtUSD(A.avoided)} avoided, net ${A.net < 0 ? '−' : ''}${fmtUSD(Math.abs(A.net))}`,
      test: 'Two-quarter pilot. Success: both groups within 1.2× the company rate.',
    },
    ot && {
      title: 'Cap overtime at 6 hours a week with a float pool',
      evidence: `${fmtPct(ot.risk_share)} of people over 6 hrs/week left vs ${fmtPct(ot.ref_share)} (+${(ot.diff * 100).toFixed(1)} pts).`,
      cost: `≈ ${Math.round(L.float_positions)} float positions; roughly cost-neutral against 1.5× overtime`,
      ret: `${fmtUSD(otAvoided)} avoided if the ${fmtInt(L.heavy_ot_n)} people over 6 hrs left at the lower share`,
      test: 'Pilot at one plant. Success: under 10% of staff above 6 hrs and their departure share down.',
    },
    pay && deepBand && {
      title: 'Lift pay under 90% of role median to 90%',
      evidence: `${fmtPct(deepBand.share)} of employees under 90% left vs ${fmtPct(fx.base_share)} overall (pay gap +${(pay.diff * 100).toFixed(1)} pts).`,
      cost: `${fmtUSD(L.deep_below_cost)} a year for ${fmtInt(L.deep_below_n)} employees`,
      ret: payNet >= 0
        ? `${fmtUSD(payAvoided)} avoided, net ${fmtUSD(payNet)}`
        : `${fmtUSD(payAvoided)} avoided: retention covers ${fmtPct(payAvoided / L.deep_below_cost, 0)} of the cost, so it also has to stand on hiring and fairness`,
      test: `Targeted, not blanket: lifting all ${fmtInt(L.below_market_n)} under 97% would cost ${fmtUSD(L.below_market_cost)} a year. Success: this group's share at company level in 12 months.`,
    },
  ].filter(Boolean)

  return (
    <Card icon={Lightbulb} title="Recommended retention actions" note="each one is a test with a success measure; figures update with the filters">
      <Grid cols="repeat(auto-fit, minmax(300px, 1fr))" gap={14}>
        {recs.map((r, i) => (
          <div key={r.title} style={{ padding: '14px 16px', borderRadius: 12, border: `1px solid ${HAIRLINE}`, background: '#FBFCFE' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: NAVY, color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
              <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, letterSpacing: '-0.01em', lineHeight: 1.3 }}>{r.title}</div>
            </div>
            <dl style={{ margin: '10px 0 0', display: 'grid', gridTemplateColumns: '72px 1fr', rowGap: 6, columnGap: 10, fontSize: 12, lineHeight: 1.45 }}>
              <dt style={dt}>Evidence</dt><dd style={dd}>{r.evidence}</dd>
              <dt style={dt}>Cost</dt><dd style={dd}>{r.cost}</dd>
              <dt style={dt}>Return</dt><dd style={dd}>{r.ret}</dd>
              <dt style={dt}><FlaskConical size={12} style={{ verticalAlign: -1 }} /> Test</dt><dd style={dd}>{r.test}</dd>
            </dl>
          </div>
        ))}
      </Grid>
      {unclear.length > 0 && (
        <Note>
          Not recommended yet: {unclear.map(u => u.label.toLowerCase()).join(', ')} — the difference between leavers and stayers isn't
          statistically clear in this data, so it shouldn't lead the budget.
        </Note>
      )}
    </Card>
  )
}

const dt = { fontWeight: 700, color: MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: 1 }
const dd = { margin: 0, color: DIM }
