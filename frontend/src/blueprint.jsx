/* Blueprint primitives — how a view looks before the data is in.

   Rule: nothing on screen may look like a figure we don't have. Slots keep the
   size and position the real tile or chart will take, and draw their frame in
   dashed outline with flat, equal ghost marks so no shape implies a trend.
   Detail (definitions, what data a slot needs) lives behind the info icon. */
import { Hourglass } from 'lucide-react'
import { useLiveContext } from './live'
import { Card, Info, NAVY, MUTED } from './ui'
import { monthRange, shortMonth } from './filters'

export const GHOST = '#e5e9ed'
export const GHOST_LINE = '#c3d0db'

/** One quiet information strip per page saying why the figures are empty. */
export function AwaitingBanner() {
  const { conn } = useLiveContext()
  const text = conn?.state === 'connected'
    ? 'Connected. Figures appear once metrics are mapped to Alpha\'s tables.'
    : 'No figures yet. They appear once Alpha\'s data is connected.'
  return <div className="ds-message" role="status"><Hourglass size={14} /> {text}</div>
}

/** A measure in the KPI strip with no number yet. The info icon holds the definition. */
export function MetricSlot({ label, def, keyMeasure }) {
  return (
    <div className={`ds-kpi ${keyMeasure ? 'ds-kpi--key' : ''}`}>
      <span>{label}{def && <Info text={def} width={280} />}</span>
      <strong className="al-kpi-empty" aria-label="No figure yet">—</strong>
      <small>Awaiting data</small>
    </div>
  )
}

/** Panel holding a ghost chart. `info` goes behind the info icon in the heading. */
export function ChartSlot({ title, note, info, right, children, style }) {
  return (
    <Card title={<>{title}{info && <Info text={info} width={300} />}</>} note={note} right={right} style={style}>
      {children}
    </Card>
  )
}

function Stage({ height, children }) {
  return <div className="al-stage" style={{ height }}>{children}</div>
}

/** Month axis from the period selector (a calendar, not data), flat baseline. */
export function TrendFrame({ height = 240 }) {
  const { filters } = useLiveContext()
  const months = filters.start && filters.end ? monthRange(filters.start, filters.end) : []
  const step = Math.max(1, Math.ceil(months.length / 14))
  return (
    <Stage height={height}>
      <svg width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
        {[0.25, 0.5].map(y => <line key={y} x1="5%" x2="95%" y1={`${y * 100}%`} y2={`${y * 100}%`} stroke={GHOST} strokeDasharray="3 5" />)}
        <line x1="5%" x2="95%" y1="80%" y2="80%" stroke={GHOST_LINE} strokeWidth="1.5" />
      </svg>
      <div style={{ position: 'absolute', left: '5%', right: '5%', top: '84%', display: 'flex', justifyContent: 'space-between' }}>
        {months.map((m, i) => (
          <span key={m} style={{ fontSize: 10, color: MUTED, width: 0, display: 'flex', justifyContent: 'center', visibility: i % step === 0 ? 'visible' : 'hidden', whiteSpace: 'nowrap' }}>{shortMonth(m)}</span>
        ))}
      </div>
    </Stage>
  )
}

/** Unlabeled, equal rows with an optional reference marker. */
export function RankFrame({ rows = 4, marker = 'company rate' }) {
  return (
    <Stage height={rows * 32 + (marker ? 34 : 20)}>
      <div style={{ position: 'absolute', inset: '12px 18px' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 14, alignItems: 'center', height: 32 }}>
            <div style={{ height: 8, width: '70%', background: GHOST, borderRadius: 2 }} />
            <div style={{ position: 'relative', height: 14, border: `1px dashed ${GHOST_LINE}`, borderRadius: 2 }}>
              {marker && <div style={{ position: 'absolute', left: '50%', top: -6, bottom: -6, borderLeft: `2px dashed ${NAVY}`, opacity: 0.2 }} />}
            </div>
          </div>
        ))}
      </div>
      {marker && <span style={{ position: 'absolute', left: 'calc(50% + 72px)', bottom: 6, fontSize: 10, color: MUTED, transform: 'translateX(-50%)' }}>{marker}</span>}
    </Stage>
  )
}

/** Plant × shift grid; plants and shifts come from the data, so headers are ghosts. */
export function MatrixFrame({ cols = 3, rows = 3 }) {
  const ghost = w => <div style={{ height: 8, width: w, background: GHOST, borderRadius: 2, alignSelf: 'center' }} />
  return (
    <Stage height={200}>
      <div style={{ position: 'absolute', inset: 16, display: 'grid', gridTemplateColumns: `100px repeat(${cols}, 1fr)`, gridTemplateRows: `16px repeat(${rows}, 1fr)`, gap: 8 }}>
        <span style={{ fontSize: 10, color: MUTED }}>plant × shift</span>
        {Array.from({ length: cols }).map((_, i) => <div key={i} style={{ display: 'flex' }}>{ghost('40%')}</div>)}
        {Array.from({ length: rows }).map((_, r) => [
          <div key={`h${r}`} style={{ display: 'flex' }}>{ghost('70%')}</div>,
          ...Array.from({ length: cols }).map((_, c) => <div key={`${r}${c}`} style={{ border: `1px dashed ${GHOST_LINE}`, borderRadius: 3 }} />),
        ])}
      </div>
    </Stage>
  )
}

/** Difference-with-interval rows for named factors; no points drawn. */
export function ForestFrame({ rows }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '10px 16px', alignItems: 'center' }}>
      <div />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: MUTED }}>
        <span>leavers lower</span><span>no difference</span><span>leavers higher</span>
      </div>
      {rows.map(r => [
        <div key={r + 'a'} style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>{r}</div>,
        <div key={r + 'b'} className="al-stage" style={{ height: 30 }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, borderLeft: `2px dashed ${NAVY}`, opacity: 0.2 }} />
        </div>,
      ])}
    </div>
  )
}
