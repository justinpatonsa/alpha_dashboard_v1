/* Sign-in page: the landing page until a session exists. Accounts live in the
   team's own database on the VPS; there is no self-service sign-up. */
import { useEffect, useState } from 'react'
import { AlertTriangle, Info as InfoIcon } from 'lucide-react'
import { API } from './live'
import { AlphaMark } from './Layout'
import { brand } from './config'

const MESSAGES = {
  401: 'Incorrect username or password.',
  429: 'Too many attempts. Wait a minute and try again.',
  503: 'Sign-in is unavailable right now. Try again shortly.',
}

export default function Login({ notice, onSignedIn }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { document.title = 'Sign in · Alpha Retention Dashboard' }, [])

  const submit = e => {
    e.preventDefault()
    setBusy(true)
    setError('')
    API.post('/login', { username, password })
      .then(r => onSignedIn(r.data.user))
      .catch(err => {
        setError(MESSAGES[err.response?.status] || 'Couldn\'t reach the server. Check your connection and try again.')
        setPassword('')
        setBusy(false)
      })
  }

  return (
    <div className="al-login">
      <main className="al-login-card">
        <header className="al-login-brand">
          <AlphaMark size={34} />
          <div><strong>{brand.name}</strong><span>{brand.workspace}</span></div>
        </header>
        <form className="al-login-form" onSubmit={submit}>
          <h1>Sign in</h1>
          {notice && !error && <div className="ds-message" role="status"><InfoIcon size={14} /> {notice}</div>}
          <label className="ds-field">
            Username
            <input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus
              value={username} onChange={e => setUsername(e.target.value)} />
          </label>
          <label className="ds-field">
            Password
            <input name="password" type="password" autoComplete="current-password" required
              value={password} onChange={e => setPassword(e.target.value)} />
          </label>
          {error && <div className="al-login-error" role="alert"><AlertTriangle size={14} /> {error}</div>}
          <button type="submit" className="ds-button ds-button--primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </main>
      <p className="al-login-foot">{brand.builtBy}</p>
    </div>
  )
}
