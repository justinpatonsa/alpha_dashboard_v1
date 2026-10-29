import { Grid, KpiStrip, SectionHeading } from '../ui'
import { AwaitingBanner, MetricSlot, ChartSlot, TrendFrame, RankFrame } from '../blueprint'
import { DEF, ViewQuery, LinkButton, useScope, periodText } from './common'
import { useLiveContext } from '../live'

export default function Overview() {
  const { filters } = useLiveContext()
  const scope = useScope()
  return (
    <ViewQuery id="overview">
      {() => (
        <div className="al-page fade-in">
          <AwaitingBanner />

          <div>
            <SectionHeading title="At a glance" context={`${scope} · ${periodText(filters)}`} />
            <KpiStrip>
              <MetricSlot label="Headcount" def={DEF.headcount} />
              <MetricSlot label="Departures" def={DEF.departures} />
              <MetricSlot label="Departure rate" def={DEF.rate} keyMeasure />
              <MetricSlot label="Retention rate" def={DEF.retention} />
              <MetricSlot label="Replacement cost" def={DEF.cost} />
            </KpiStrip>
          </div>

          <ChartSlot title="Monthly departure trend" note="Departures per month and the monthly departure rate"
            info="Bars: departures per month (voluntary and involuntary, if recorded). Line: monthly departure rate. The axis follows the period selector.">
            <TrendFrame />
          </ChartSlot>

          <Grid cols="repeat(auto-fit, minmax(400px, 1fr))">
            <ChartSlot title="Where it runs high" note="Highest-rate plant × shift groups" info="Highest-rate plant × shift groups against the company rate."
              right={<LinkButton label="Where" to="where" />}>
              <RankFrame rows={3} />
            </ChartSlot>
            <ChartSlot title="Top exit themes" note="Exit-interview reasons, grouped" info="Exit-interview reasons grouped into themes, with the share of leavers interviewed."
              right={<LinkButton label="Employee voice" to="voice" />}>
              <RankFrame rows={3} marker={null} />
            </ChartSlot>
          </Grid>
        </div>
      )}
    </ViewQuery>
  )
}
