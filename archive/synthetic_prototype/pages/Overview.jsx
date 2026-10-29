import { TrendingDown, MapPin, MessageSquareText } from 'lucide-react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts'
import { useLive, useLiveContext } from '../live'
import {
  Card, Stat, Grid, PageHeading, ChartTip, Legend, Coverage, Note,
  NAVY, MUTED, CHART, fmtInt, fmtPct, fmtUSD,
} from '../ui'
import { shortMonth, monthLabel } from '../TopBar'
import { DEF, ViewBody, useScope, periodLabel, priorLabel, LinkButton, RateRow } from './common'

export default function Overview() {
  const state = useLive('/overview')
  const scope = useScope()
  return (
    <ViewBody state={state}>
      {d => <OverviewBody d={d} scope={scope} />}
    </ViewBody>
  )
}

function OverviewBody({ d, scope }) {
  const { setFilters } = useLiveContext()
  const k = d.kpis
  const prior = priorLabel(d.period)
  const maxHot = Math.max(...d.hot_groups.map(g => g.rate || 0), d.company_rate || 0) * 1.1
  const maxTheme = Math.max(...d.themes.map(t => t.n), 1)

  return (
    <div className="fade-in">
      <PageHeading
        title="Overview"
        subtitle={`How many people left, at what rate, month by month · ${scope} · ${periodLabel(d.period)}`}
      />

      <Grid cols="repeat(auto-fit, minmax(190px, 1fr))" style={{ marginBottom: 16 }}>
        <Stat label="Headcount" value={fmtInt(k.headcount)} info={DEF.headcount}
          sub={`avg ${fmtInt(k.avg_hc)} over the period`} />
        <Stat label="Departures" value={fmtInt(k.departures)} info={DEF.departures}
          delta={d.deltas.departures} sub={`vs ${fmtInt(k.prior_departures)} ${prior}`} />
        <Stat label="Departure rate" value={fmtPct(k.rate)} info={DEF.rate} accent={CHART.red}
          delta={d.deltas.rate} sub={`vs ${fmtPct(k.prior_rate)} ${prior}`} />
        <Stat label="Retention rate" value={fmtPct(k.retention)} info={DEF.retention}
          delta={d.deltas.retention} deltaGoodWhenDown={false} sub={`vs ${fmtPct(k.prior_retention)} ${prior}`} />
        <Stat label="Replacement cost" value={fmtUSD(k.cost)} info={DEF.cost}
          delta={d.deltas.cost} sub="base assumptions" />
      </Grid>

      <Card
        icon={TrendingDown} title="Monthly departure trend"
        note={`${fmtPct(k.voluntary_share, 0)} of departures voluntary`}
        right={<Legend items={[
          { label: 'Voluntary', color: CHART.deep }, { label: 'Involuntary', color: CHART.pale },
          { label: 'Departure rate', color: CHART.red, line: true },
        ]} />}
        style={{ marginBottom: 16 }}
      >
        <div style={{ height: 290 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={d.trend} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="month" tickFormatter={m => shortMonth(m)} tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="n" tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis yAxisId="r" orientation="right" tickFormatter={v => `${(v * 100).toFixed(1)}%`} tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} width={48} />
              <Tooltip cursor={{ fill: 'rgba(13,27,42,0.04)' }} content={
                <ChartTip
                  labelFmt={m => {
                    const row = d.trend.find(t => t.month === m)
                    return `${monthLabel(m)}${row?.partial ? ' (month to date)' : ''}`
                  }}
                  fmt={(v, key) => key === 'rate' ? fmtPct(v, 2) : fmtInt(v)}
                />
              } />
              <Bar yAxisId="n" dataKey="vol" name="Voluntary" stackId="d" fill={CHART.deep} isAnimationActive={false}>
                {d.trend.map(t => <Cell key={t.month} fillOpacity={t.partial ? 0.45 : 1} />)}
              </Bar>
              <Bar yAxisId="n" dataKey="invol" name="Involuntary" stackId="d" fill={CHART.pale} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {d.trend.map(t => <Cell key={t.month} fillOpacity={t.partial ? 0.45 : 1} />)}
              </Bar>
              <Line yAxisId="r" dataKey="rate" name="Departure rate" stroke={CHART.red} strokeWidth={2.4}
                dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <Note>Monthly rate = departures in the month ÷ (start + end headcount) ÷ 2. The latest month is month to date and drawn lighter.</Note>
      </Card>

      <Grid cols="repeat(auto-fit, minmax(380px, 1fr))">
        <Card icon={MapPin} title="Where it runs high" note="plant × shift vs. company rate" right={<LinkButton label="Where" to="where" />}>
          {d.hot_groups.length ? d.hot_groups.map(g => {
            const [plant, shift] = g.group.split(' · ')
            return (
              <RateRow key={g.group} label={g.group} rate={g.rate} company={d.company_rate} max={maxHot}
                n={g.avg_hc} wellAbove={g.well_above}
                onClick={() => setFilters(f => ({ ...f, plant, shift }))} />
            )
          }) : <div style={{ fontSize: 12.5, color: MUTED }}>No groups with 10 or more employees in this filter.</div>}
          <Note>Dashed line = company rate for the same period ({fmtPct(d.company_rate)}). Click a row to filter the dashboard to it.</Note>
        </Card>

        <Card icon={MessageSquareText} title="Top reported exit themes" right={<>
          <Coverage pct={k.departures ? d.exit_count / k.departures : 0} label="of leavers interviewed" />
          <LinkButton label="Employee voice" to="voice" />
        </>}>
          {d.themes.slice(0, 5).map(t => (
            <div key={t.theme} style={{ display: 'grid', gridTemplateColumns: '170px 1fr 40px', alignItems: 'center', gap: 12, padding: '7px 0' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: NAVY }}>{t.theme}</span>
              <div style={{ height: 14, background: '#F0F3F8', borderRadius: 4 }}>
                <div style={{ width: `${(t.n / maxTheme) * 100}%`, height: '100%', borderRadius: 4, background: CHART.navy, transition: 'width .4s' }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: NAVY, textAlign: 'right' }}>{t.n}</span>
            </div>
          ))}
          {!d.themes.length && <div style={{ fontSize: 12.5, color: MUTED }}>No exit interviews in this filter.</div>}
          <Note>Reasons people gave in exit interviews ({d.exit_count} of {fmtInt(k.departures)} departures). Reported reasons, not proven causes.</Note>
        </Card>
      </Grid>
    </div>
  )
}
