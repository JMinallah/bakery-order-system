import { Link, NavLink, Outlet } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { useState } from 'react'
import { useBakery } from '../context/bakery-context'
import { firebaseAuth, firebaseEnabled } from '../lib/firebase'
import { Icon, type IconName } from './Icon'

const GROUPS: { label: string; links: { to: string; label: string; icon: IconName }[] }[] = [
  { label: 'Work', links: [
  { to: '/orders', label: 'Orders', icon: 'orders' },
  { to: '/schedule', label: 'Schedule', icon: 'schedule' },
  ] },
  { label: 'Catalogue', links: [
  { to: '/products', label: 'Products', icon: 'products' },
  { to: '/builder', label: 'Builder options', icon: 'options' },
  { to: '/stock', label: 'Stock', icon: 'stock' },
  ] },
  { label: 'Workspace', links: [
  { to: '/settings', label: 'Settings', icon: 'settings' },
  ] },
]

export function Layout() {
  const { me, bakery, isOwner, newOrders, stockAlerts, switchBakery } = useBakery()
  const [menuOpen, setMenuOpen] = useState(false)

  const badge = (to: string) => {
    if (to === '/orders' && newOrders > 0) return <span className="nav-badge">{newOrders} new</span>
    if (to === '/stock' && stockAlerts > 0) return <span className="nav-badge nav-badge-warn">{stockAlerts} low</span>
    return null
  }

  const nav = (
    <nav className="nav" aria-label="Dashboard">
      {GROUPS.map((group) => (
        <div className="nav-group" key={group.label}>
          <span className="nav-group-label">{group.label}</span>
          {group.links.map((link) => (
            <NavLink key={link.to} to={link.to} onClick={() => setMenuOpen(false)}>
              <Icon name={link.icon} />
              <span>{link.label}</span>
              {badge(link.to)}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )

  const handleSignOut = async () => {
    try {
      if (firebaseEnabled) {
        await signOut(firebaseAuth())
      }
    } catch (err) {
      console.error('Sign out error', err)
    } finally {
      localStorage.clear()
      sessionStorage.clear()
      window.location.href = '/signin'
    }
  }

  return (
    <div className="app">
      <header className="mobile-topbar">
        <strong>Bakery Orders<span aria-hidden="true">.</span></strong>
        <button type="button" className="menu-button" aria-label={menuOpen ? 'Close dashboard navigation' : 'Open dashboard navigation'} aria-expanded={menuOpen} aria-controls="dashboard-sidebar" onClick={() => setMenuOpen((open) => !open)}>
          <span aria-hidden="true" className={`menu-icon${menuOpen ? ' is-open' : ''}`}>
            <span />
            <span />
            <span />
          </span>
        </button>
      </header>
      <aside id="dashboard-sidebar" className={`sidebar${menuOpen ? ' is-open' : ''}`}>
        <div className="sidebar-brand">
          <strong>Bakery Orders</strong>
          {me.bakeries.length > 1 ? (
            <label>
              <span className="visually-hidden">Bakery</span>
              <select value={bakery.id} onChange={(e) => switchBakery(e.target.value)}>
                {me.bakeries.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span>{bakery.name}</span>
          )}
        </div>
        {nav}
        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <strong title={me.name ?? me.email ?? 'Signed in'}>{me.name ?? me.email ?? 'Signed in'}</strong>
            <span className="sidebar-user-role">{isOwner ? 'Owner' : 'Staff'}</span>
          </div>
          <button type="button" className="sidebar-sign-out" onClick={handleSignOut} aria-label="Sign out">
            <Icon name="logout" size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      <main className="main">
        <BakeryNotice />
        <Outlet />
      </main>
    </div>
  )
}

// Why customers can't see the bakery right now, on every page until it's sorted.
function BakeryNotice() {
  const { bakery, isOwner } = useBakery()
  if (!bakery.isActive) {
    return (
      <p className="alert alert-danger" role="status">
        <span>
          <strong>{bakery.name} is suspended by the platform.</strong> Customers can't find it or place new orders. Finish your open orders as usual, and
          contact the platform team if you think this is a mistake.
        </span>
      </p>
    )
  }
  if (!bakery.isPublished) {
    return (
      <p className="alert alert-info" role="status">
        <span>
          <strong>Customers can't see {bakery.name} yet.</strong>{' '}
          {isOwner ? 'Add your products and delivery details, then publish it.' : 'The owner publishes it from Settings once setup is done.'}
        </span>
        {isOwner && <Link to="/settings#go-live">Finish setup</Link>}
      </p>
    )
  }
  return null
}
