/* ──────────────────────────────────────────────────────────────────────────────
   Shared primitives in the Version 1 design language (theme/): white title band,
   flat bordered panels with sentence-case headings, one joined KPI strip, blue
   for actions, red only for problems. Layout comes from the theme's ds- classes;
   the constants below mirror theme/tokens.css for inline and chart colors.
   ────────────────────────────────────────────────────────────────────────────── */
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info as InfoIcon } from 'lucide-react'

export const NAVY = '#1d2d3e'      // primary text
export const DIM = '#526579'       // secondary text
export const MUTED = '#607487'     // supporting labels
export const HAIRLINE = '#e5e9ed'  // fine rule
export const LINK = '#0064d9'
export const RED = '#b63c38'
export const GREEN = '#256f3a'
export const AMBER = '#936c20'

// One blue family for series; red only where the problem is.
export const CHART = {
  deep: '#1e4668',
  navy: '#397ebc',
  mid: '#6fa3d3',
  pale: '#a8c9e9',
  red: '#b63c38',
  slate: '#899eaf',
  grid: '#e5e9ed',
}

export const fmtInt = v => v == null ? '—' : Math.round(v).toLocaleString('en-US')
export const fmtPct = (v, d = 1) => v == null ? '—' : `${(v * 100).toFixed(d)}%`
export const fmtUSD = v => {
  if (v == null) return '—'
  const a = Math.abs(v)
  if (a >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (a >= 10_000) return `$${(v / 1_000).toFixed(0)}K`
  if (a >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  return `$${Math.round(v)}`
}
export const fmtUSDFull = v => v == null ? '—' : `$${Math.round(v).toLocaleString('en-US')}`

/** White band at the top of every page: title, description, context and filters. */
export const PageHeading = ({ title, description, action, children }) => (
  <div className="ds-page-heading">
    <div className="ds-title-row">
      <div><h1>{title}</h1>{description && <p>{description}</p>}</div>
      {action}
    </div>
    {children}
  </div>
)

export const SectionHeading = ({ title, context }) => (
  <div className="ds-section-heading"><h2>{title}</h2>{context && <span>{context}</span>}</div>
)

export const Surface = ({ className = '', children, ...rest }) => (
  <section className={`ds-panel ${className}`} {...rest}>{children}</section>
)

export const CardHeader = ({ title, note, right }) => (
  <div className="ds-panel-head">
    <div><h2>{title}</h2>{note && <p>{note}</p>}</div>
    {right}
  </div>
)

/** One bordered unit of work. */
export const Card = ({ title, note, right, children, pad, style }) => (
  <Surface style={style}>
    <CardHeader title={title} note={note} right={right} />
    <div className="al-panel-body" style={pad ? { padding: pad } : undefined}>{children}</div>
  </Surface>
)

/** Info icon that explains how a number is defined; opens on hover or keyboard focus.
    The tip is portalled to <body> so panels (which clip their overflow) can't cut it off. */
export function Info({ text, width = 260 }) {
  const [pos, setPos] = useState(null)
  const button = useRef(null)
  const id = useId()
  const show = () => {
    const r = button.current.getBoundingClientRect()
    const w = Math.min(width, window.innerWidth - 16)
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8)), width: w })
  }
  const hide = () => setPos(null)

  useEffect(() => {
    if (!pos) return
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [pos])

  return (
    <span className="al-info" onMouseEnter={show} onMouseLeave={hide}>
      <button ref={button} type="button" aria-label="Definition" aria-describedby={pos ? id : undefined}
        onFocus={show} onBlur={hide} onKeyDown={e => { if (e.key === 'Escape') hide() }}>
        <InfoIcon size={14} />
      </button>
      {pos && createPortal(<span id={id} role="tooltip" className="al-tip" style={pos}>{text}</span>, document.body)}
    </span>
  )
}

/** Bumps a counter whenever `value` changes after first render — used to
    replay the flash animation when a poll brings back a different number. */
export function useFlash(value) {
  const prev = useRef(value)
  const [n, setN] = useState(0)
  useEffect(() => {
    if (prev.current != null && value != null && prev.current !== value) setN(x => x + 1)
    prev.current = value
  }, [value])
  return n
}

/** Joined strip of related measures, divided by fine rules. */
export const KpiStrip = ({ label = 'Key measures', children }) => {
  const count = [children].flat().filter(Boolean).length
  return <section className="ds-kpis al-kpis" aria-label={label} style={{ '--al-kpi-count': count }}>{children}</section>
}

/** One measure in a KpiStrip. `keyMeasure` gives the primary outcome the pale-blue emphasis. */
export function Stat({ label, value, sub, delta, deltaGoodWhenDown = true, info, keyMeasure }) {
  const flash = useFlash(value)
  let deltaEl = null
  if (delta != null && isFinite(delta)) {
    const up = delta >= 0
    const good = deltaGoodWhenDown ? !up : up
    deltaEl = (
      <span style={{ color: good ? GREEN : RED, fontWeight: 600, marginRight: 6 }}>
        {up ? '▲' : '▼'} {Math.abs(delta * 100).toFixed(1)}%
      </span>
    )
  }
  return (
    <div key={flash} className={`ds-kpi ${keyMeasure ? 'ds-kpi--key' : ''} ${flash ? 'flash' : ''}`}>
      <span>{label}{info && <Info text={info} />}</span>
      <strong>{value}</strong>
      <small>{deltaEl}{sub}</small>
    </div>
  )
}

export const Grid = ({ cols, gap = 19, children, style }) => (
  <div className="al-grid" style={{ gridTemplateColumns: cols, gap, ...style }}>{children}</div>
)

/** Segmented switch (period / scenario level). */
export function Pills({ value, options, onChange, small = false }) {
  return (
    <div className={`al-switch ${small ? 'al-switch--small' : ''}`} role="group">
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  )
}

/** Recharts tooltip in the house style. */
export function ChartTip({ active, payload, label, fmt = v => v, labelFmt = l => l }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'white', color: NAVY, border: '1px solid #d9e1e7', borderRadius: 8, padding: '9px 12px',
      fontSize: 11, boxShadow: '0 8px 28px #172c4230', minWidth: 150,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 5 }}>{labelFmt(label)}</div>
      {payload.filter(p => p.value != null).map(p => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.fill }} />
          <span style={{ color: MUTED }}>{p.name}</span>
          <span style={{ marginLeft: 'auto', paddingLeft: 10, fontVariantNumeric: 'tabular-nums' }}>{fmt(p.value, p.dataKey)}</span>
        </div>
      ))}
    </div>
  )
}

export const Legend = ({ items }) => (
  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
    {items.map(i => (
      <span key={i.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: DIM }}>
        <span style={{ width: i.line ? 14 : 9, height: i.line ? 2 : 9, borderRadius: i.line ? 1 : 2, background: i.color }} />
        {i.label}
      </span>
    ))}
  </div>
)

/** Coverage tag — risk register says "show coverage on every chart". */
export const Coverage = ({ pct, label = 'coverage' }) => (
  <span className="al-tag" style={{ color: pct < 0.6 ? AMBER : DIM }}
    title="Share of the filtered population this chart's data source covers">
    {fmtPct(pct, 0)} {label}
  </span>
)

export const Note = ({ children }) => (
  <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6, marginTop: 10 }}>{children}</div>
)
