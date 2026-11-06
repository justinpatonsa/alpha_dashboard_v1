import { useCallback, useEffect, useMemo, useState } from 'react'
import Layout from './Layout'
import { NAV_ITEMS } from './config'
import { FilterBar, StatusLine, addMonths } from './filters'
import { PageHeading } from './ui'
import { API, LiveContext, POLL_MS, onUnauthorized } from './live'
import Login from './Login'
import { Unavailable, Loading } from './states'
import Overview from './pages/Overview'
import Where from './pages/Where'
import Factors from './pages/Factors'
import Voice from './pages/Voice'
import Cost from './pages/Cost'
import Employees from './pages/Employees'
import Discovery from './pages/Discovery'
import Definitions from './pages/Definitions'
import Readiness from './pages/Readiness'

const PAGES = {
  overview: Overview, where: Where, factors: Factors, voice: Voice, cost: Cost,
  employees: Employees, discovery: Discovery, definitions: Definitions, readiness: Readiness,
}
const pageFromHash = () => {
  const h = window.location.hash.replace('#/', '').replace('#', '')
  return PAGES[h] ? h : 'overview'
}

/** Sign-in gate: the dashboard mounts only with a live session, and a 401 from
    any request (session expired or ended) returns to the sign-in page. */
export default function App() {
  const [user, setUser] = useState(undefined)      // undefined while checking the cookie
  const [notice, setNotice] = useState('')

  useEffect(() => {
    API.get('/me', { params: { _: Date.now() } })
      .then(r => setUser(r.data.user))
      .catch(() => setUser(null))
  }, [])
  useEffect(() => onUnauthorized(() => { setNotice('Your session ended. Sign in again.'); setUser(null) }), [])

  const signOut = () => API.post('/logout').catch(() => {}).finally(() => { setNotice(''); setUser(null) })

  if (user === undefined) return null
  if (!user) return <Login notice={notice} onSignedIn={u => { setNotice(''); setUser(u) }} />
  return <Dashboard user={user} onSignOut={signOut} />
}

function Dashboard({ user, onSignOut }) {
  const [page, setPage] = useState(pageFromHash)
  const [meta, setMeta] = useState(null)
  const [filters, setFilters] = useState({ plant: '', department: '', role: '', shift: '', start: '', end: '' })
  const [tick, setTick] = useState(0)
  const [countdown, setCountdown] = useState(POLL_MS / 1000)
  const [conn, setConn] = useState(null)          // live state of the database link
  const [lastQuery, setLastQuery] = useState(null)

  useEffect(() => {
    // The skip link moves focus to the content without changing the view.
    const onHash = () => { if (window.location.hash !== '#main-content') setPage(pageFromHash()) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const item = NAV_ITEMS.find(i => i.id === page)
  useEffect(() => { document.title = `${item.label} · Alpha Retention Dashboard` }, [item])

  // Connection check: on load, on every filter or view change, and every 15 seconds.
  useEffect(() => {
    API.get('/status', { params: { _: Date.now() } })
      .then(r => { setConn(r.data); setLastQuery(r.data.queried_at) })
      .catch(e => setConn({ state: 'api_down', message: e.response?.data?.detail || e.message }))
  }, [tick, filters, page])

  // Period range is a calendar, not data; retried until the API answers.
  useEffect(() => {
    if (meta) return
    API.get('/meta', { params: { _: Date.now() } })
      .then(r => {
        setMeta(r.data)
        setFilters(f => ({ ...f, start: addMonths(r.data.last_month, -11), end: r.data.last_month }))
      })
      .catch(() => {})
  }, [meta, tick])

  useEffect(() => { setCountdown(POLL_MS / 1000) }, [filters, page])
  useEffect(() => {
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { setTick(x => x + 1); return POLL_MS / 1000 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [])

  const report = useCallback(s => { if (s.ok) setLastQuery(s.at) }, [])
  const ctx = useMemo(() => ({ filters, setFilters, tick, report, meta, conn }), [filters, tick, report, meta, conn])
  const View = PAGES[page]
  const apiDown = conn?.state === 'api_down'

  return (
    <LiveContext.Provider value={ctx}>
      <Layout page={page} user={user} onSignOut={onSignOut}>
        <PageHeading title={item.title || item.label} description={item.description}
          action={<StatusLine conn={conn} lastQuery={lastQuery} countdown={countdown} />}>
          {item.filters && meta && filters.start && <FilterBar meta={meta} filters={filters} setFilters={setFilters} />}
        </PageHeading>
        <div className="ds-page-body">
          {apiDown ? <Unavailable detail={conn.message} /> : meta && filters.start ? <View key={page} /> : <Loading />}
        </div>
      </Layout>
    </LiveContext.Provider>
  )
}
