/* Application shell, Version 1: navy top bar with the brand and workspace name,
   a white navigation column the hamburger fully opens and closes (an overlay
   on narrow screens), and the account popover. */
import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, LogOut, Menu } from 'lucide-react'
import { brand, NAV_GROUPS } from './config'

const WIDE = '(min-width: 851px)'

export const AlphaMark = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flexShrink: 0, display: 'block' }}>
    <rect width="32" height="32" rx="8" fill="#1B3A5C" />
    <path d="M9 23 16 8l7 15M11.6 17.6h8.8" stroke="#D91E2A" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const initials = name => name.split(/[\s._-]+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()

function AccountMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false)
  const anchor = useRef(null)
  const button = useRef(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const outside = e => { if (!anchor.current?.contains(e.target)) setOpen(false) }
    const keyboard = e => { if (e.key === 'Escape') { setOpen(false); button.current?.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', keyboard)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', keyboard)
    }
  }, [open])

  return (
    <div className="ds-anchor" ref={anchor} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false) }}>
      <button ref={button} type="button" className="ds-account" aria-label={`${user.name} account`}
        aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(o => !o)}>
        <span className="ds-user-name">{user.name}</span>
        <span className="ds-avatar">{initials(user.name)}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <section id={id} className="ds-popover" aria-label="Account">
          <div className="ds-identity">
            <span className="ds-avatar">{initials(user.name)}</span>
            <div><strong>{user.name}</strong><small>Signed in as {user.username}</small></div>
          </div>
          <button type="button" className="ds-button al-signout" onClick={onSignOut}><LogOut size={14} /> Sign out</button>
        </section>
      )}
    </div>
  )
}

export default function Layout({ page, user, onSignOut, children }) {
  const [navOpen, setNavOpen] = useState(() => window.matchMedia(WIDE).matches)

  useEffect(() => {
    const media = window.matchMedia(WIDE)
    const changed = e => setNavOpen(e.matches)
    media.addEventListener('change', changed)
    return () => media.removeEventListener('change', changed)
  }, [])

  // Links set the hash themselves; on narrow screens the overlay closes after a choice.
  const closeIfNarrow = () => { if (!window.matchMedia(WIDE).matches) setNavOpen(false) }

  return (
    <>
      <a href="#main-content" className="ds-skip">Skip to content</a>
      <header className="ds-shell">
        <button type="button" className="ds-icon" aria-label="Toggle navigation" aria-expanded={navOpen}
          aria-controls="primary-navigation" onClick={() => setNavOpen(o => !o)}><Menu size={19} /></button>
        <a className="ds-brand" href="#/overview" aria-label={`${brand.name} home`}>
          <AlphaMark /><span className="al-brand-name">{brand.name}</span>
        </a>
        <span className="ds-workspace">{brand.workspace}</span>
        <div className="ds-spacer" />
        <div className="ds-shell-actions"><AccountMenu user={user} onSignOut={onSignOut} /></div>
      </header>

      <div className="ds-layout">
        {navOpen && (
          <>
            <button type="button" className="ds-nav-shade" aria-label="Close navigation" onClick={() => setNavOpen(false)} />
            <nav id="primary-navigation" className="ds-nav al-nav" aria-label="Main navigation">
              {NAV_GROUPS.map(g => (
                <div key={g.label} className="al-nav-group">
                  <div className="ds-nav-heading">{g.label}</div>
                  {g.items.map(({ id, label, icon: Icon }) => (
                    <a key={id} href={`#/${id}`} onClick={closeIfNarrow} aria-current={page === id ? 'page' : undefined}>
                      <Icon size={17} />{label}{page === id && <ChevronRight size={13} />}
                    </a>
                  ))}
                </div>
              ))}
              <div className="al-nav-foot">{brand.builtBy}</div>
            </nav>
          </>
        )}
        <main className="ds-main" id="main-content" tabIndex={-1}>{children}</main>
      </div>
    </>
  )
}
