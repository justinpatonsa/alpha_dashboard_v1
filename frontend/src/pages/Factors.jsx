import { Grid } from '../ui'
import { AwaitingBanner, ChartSlot, ForestFrame, RankFrame } from '../blueprint'
import { ViewQuery } from './common'

// The four factors named in the RFP and Proposal 3.3.
const FACTORS = [
  { label: 'Pay', info: 'Pay relative to the median for the employee\'s role.' },
  { label: 'Workload', info: 'Whatever workload measure Alpha\'s HR data holds.' },
  { label: 'Satisfaction', info: 'From the HR measures or the survey (with its coverage).' },
  { label: 'Training', info: 'Training or development records.' },
]

export default function Factors() {
  return (
    <ViewQuery id="factors">
      {() => (
        <div className="al-page fade-in">
          <AwaitingBanner />

          <ChartSlot title="Leavers vs. stayers" note="Associations, not causes"
            info="Rate difference with a 95% confidence interval; chi-square or t-test. Associations, not causes. Nothing scores or predicts individuals.">
            <ForestFrame rows={FACTORS.map(f => f.label)} />
          </ChartSlot>

          <Grid cols="repeat(auto-fit, minmax(230px, 1fr))">
            {FACTORS.map(f => (
              <ChartSlot key={f.label} title={f.label} info={`${f.info} Bars show the share who left in each band.`}>
                <RankFrame rows={3} marker="all employees" />
              </ChartSlot>
            ))}
          </Grid>
        </div>
      )}
    </ViewQuery>
  )
}
