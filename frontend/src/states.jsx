import { AlertTriangle, Loader2 } from 'lucide-react'
import { Surface } from './ui'

export function Unavailable({ detail }) {
  return (
    <Surface className="fade-in" role="alert">
      <div className="ds-empty al-inline-icon" style={{ alignItems: 'flex-start', gap: 12 }}>
        <AlertTriangle size={20} color="var(--ds-negative)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong>Data unavailable</strong>
          The dashboard can't reach the database{detail ? ` (${detail})` : ''}. No figures are shown until the
          connection is back, so nobody reads stale numbers. Retrying every 15 seconds.
        </div>
      </div>
    </Surface>
  )
}

export function Loading() {
  return (
    <div className="al-inline-icon" style={{ gap: 10, color: 'var(--ds-subtle)', fontSize: 12, padding: '32px 4px' }}>
      <Loader2 size={16} style={{ animation: 'al-spin 1s linear infinite' }} /> Querying the database…
      <style>{'@keyframes al-spin { to { transform: rotate(360deg) } }'}</style>
    </div>
  )
}
