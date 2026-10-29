import { Grid } from '../ui'
import { AwaitingBanner, ChartSlot, MatrixFrame, RankFrame } from '../blueprint'
import { ViewQuery } from './common'

const DIMS = [
  { key: 'plant', title: 'By plant' },
  { key: 'department', title: 'By department' },
  { key: 'role', title: 'By role' },
  { key: 'shift', title: 'By shift' },
]
const RANK_INFO = 'Departure rate for each group against the company rate. Groups under 10 employees are flagged, not ranked.'

export default function Where() {
  return (
    <ViewQuery id="where">
      {() => (
        <div className="al-page fade-in">
          <AwaitingBanner />

          <ChartSlot title="Plant × shift" note="Departure rate by plant and shift, against the company rate"
            info="Each cell is a departure rate, shaded by how far it sits from the company rate. Click a cell to filter every view to it.">
            <MatrixFrame />
          </ChartSlot>

          <Grid cols="repeat(auto-fit, minmax(440px, 1fr))">
            {DIMS.map(m => (
              <ChartSlot key={m.key} title={m.title} info={RANK_INFO}>
                <RankFrame rows={4} />
              </ChartSlot>
            ))}
          </Grid>
        </div>
      )}
    </ViewQuery>
  )
}
