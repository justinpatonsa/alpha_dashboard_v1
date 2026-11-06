/* Live data plumbing.

   Every view load, filter change and 15-second tick goes to the API, which
   queries the database fresh (no cache anywhere). A failed request clears the
   view: the proposal promises an explicit error and no data, never stale
   numbers. */
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import axios from 'axios'

export const POLL_MS = 15_000

export const API = axios.create({ baseURL: '/api', timeout: 8000 })

// A 401 on any data request means the session ended (expired or signed out
// elsewhere); App registers a handler that returns to the sign-in page.
const SIGN_IN_ROUTES = ['/login', '/logout', '/me']
let unauthorized = () => {}
export function onUnauthorized(fn) {
  unauthorized = fn
  return () => { unauthorized = () => {} }
}
API.interceptors.response.use(r => r, e => {
  if (e.response?.status === 401 && !SIGN_IN_ROUTES.includes(e.config?.url)) unauthorized()
  return Promise.reject(e)
})

export const LiveContext = createContext(null)
export const useLiveContext = () => useContext(LiveContext)

export function filterParams(filters) {
  const p = {}
  for (const k of ['plant', 'department', 'role', 'shift', 'start', 'end']) if (filters[k]) p[k] = filters[k]
  return p
}

/** Fetch `path` with the global filters, or with the page's own `params` when it
    has them; refetch when those change and on each poll tick. */
export function useLive(path, params) {
  const { filters, tick, report } = useLiveContext()
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const seq = useRef(0)
  const query = params ?? filterParams(filters)
  const key = JSON.stringify(query)

  useEffect(() => {
    const id = ++seq.current
    setState(s => ({ ...s, loading: true }))
    API.get(path, { params: { ...query, _: Date.now() } })
      .then(r => {
        if (id !== seq.current) return
        setState({ data: r.data, error: null, loading: false })
        report({ ok: true, at: r.data.queried_at })
      })
      .catch(e => {
        if (id !== seq.current) return
        const msg = e.response?.data?.detail || e.message || 'Request failed'
        setState({ data: null, error: msg, loading: false })
        report({ ok: false, error: msg })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, tick])

  return state
}
