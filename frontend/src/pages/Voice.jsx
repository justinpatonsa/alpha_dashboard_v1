import { Grid, KpiStrip, SectionHeading } from '../ui'
import { AwaitingBanner, MetricSlot, ChartSlot, RankFrame } from '../blueprint'
import { ViewQuery, useScope, periodText } from './common'
import { useLiveContext } from '../live'

export default function Voice() {
  const { filters } = useLiveContext()
  const scope = useScope()
  return (
    <ViewQuery id="voice">
      {() => (
        <div className="al-page fade-in">
          <AwaitingBanner />

          <div>
            <SectionHeading title="Coverage" context={`${scope} · ${periodText(filters)}`} />
            <KpiStrip>
              <MetricSlot label="Survey coverage" def="Employees with a survey response ÷ all employees in the period. Missing responses are never estimated." />
              <MetricSlot label="Exit-interview coverage" def="Departures with an exit interview ÷ all departures in the period." />
              <MetricSlot label="Top exit theme" def="Most common theme among exit-interview reasons. A reported reason, not a confirmed cause." />
            </KpiStrip>
          </div>

          <Grid cols="minmax(0, 1fr) minmax(0, 1fr)">
            <ChartSlot title="Survey scores" note="Leavers vs. stayers, by survey topic" info="Average score of leavers vs. stayers for each survey topic, with response coverage.">
              <RankFrame rows={5} marker="no difference" />
            </ChartSlot>
            <ChartSlot title="Exit reasons" note="Reported reasons, not confirmed causes" info="Exit-interview reasons grouped into themes. Reported reasons, not confirmed causes.">
              <RankFrame rows={5} marker={null} />
            </ChartSlot>
          </Grid>
        </div>
      )}
    </ViewQuery>
  )
}
