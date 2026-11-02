import { sendEmailVerification, signOut } from 'firebase/auth'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { getMe, getSettings } from '../api/bakeries'
import { getOrdersSummary } from '../api/orders'
import { listStock } from '../api/stock'
import type { BakerySettings, Me } from '../types/api'
import { authMessage, firebaseAuth, firebaseEnabled } from '../lib/firebase'
import { BakeryContext } from './bakery-context'
import { useToast } from './toast-context'

const STORAGE_KEY = 'dashboard.bakeryId'
// How often an open dashboard checks for new orders. The dashboard gets no push notifications.
const POLL_MS = 60_000

function remembered() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function remember(bakeryId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, bakeryId)
  } catch {
    // Private windows can refuse storage; the dashboard still works.
  }
}

// Loads who is signed in and which bakery they work for, before showing any page.
export function BakeryProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  // Kept in a ref: navigate changes on every route change, which would restart the polling.
  const navigate = useRef(useNavigate())
  const [me, setMe] = useState<Me | null>(null)
  const [bakery, setBakery] = useState<BakerySettings | null>(null)
  const [bakeryId, setBakeryId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [counts, setCounts] = useState({ newOrders: 0, stockAlerts: 0 })
  const lastNewOrders = useRef<number | null>(null)

  // Also turns invites for a verified email into memberships, on the backend.
  const loadMe = useCallback(
    () =>
      getMe()
        .then((user) => {
          setMe(user)
          const saved = remembered()
          const choice = user.bakeries.find((b) => b.id === saved) ?? user.bakeries[0]
          setBakeryId(choice?.id ?? null)
        })
        .catch((e: Error) => setError(e.message)),
    [],
  )

  useEffect(() => {
    void loadMe()
  }, [loadMe])

  const refreshBakery = useCallback(() => {
    if (!bakeryId) return
    getSettings(bakeryId)
      .then(setBakery)
      .catch((e: Error) => setError(e.message))
  }, [bakeryId])

  const refreshCounts = useCallback(() => {
    if (!bakeryId) return
    Promise.all([getOrdersSummary(bakeryId), listStock(bakeryId)])
      .then(([summary, stock]) => {
        const newOrders = summary.counts.SUBMITTED ?? 0
        const arrived = lastNewOrders.current === null ? 0 : newOrders - lastNewOrders.current
        lastNewOrders.current = newOrders
        if (arrived > 0) {
          toast(arrived === 1 ? 'A new order just came in.' : `${arrived} new orders just came in.`, {
            action: { label: 'View', onClick: () => navigate.current('/orders') },
          })
        }
        setCounts({
          newOrders,
          stockAlerts: stock.filter((s) => s.level !== 'OK' && s.options.length > 0).length,
        })
      })
      .catch(() => {
        // Counts are a convenience; pages show their own errors.
      })
  }, [bakeryId, toast])

  useEffect(() => {
    lastNewOrders.current = null
    refreshBakery()
  }, [refreshBakery])

  // Check now, then every minute while the tab is in view, and as soon as it comes back.
  useEffect(() => {
    refreshCounts()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refreshCounts()
    }, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshCounts()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refreshCounts])

  // "(2) Bakery Orders" in the browser tab, so new orders show from another tab.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, '')
    document.title = counts.newOrders > 0 ? `(${counts.newOrders}) ${base}` : base
    return () => {
      document.title = base
    }
  }, [counts.newOrders])

  const switchBakery = useCallback((id: string) => {
    remember(id)
    setBakery(null)
    setBakeryId(id)
  }, [])

  if (error) {
    return (
      <main className="main">
        <h1>Couldn't open the dashboard</h1>
        <p className="form-error">{error}</p>
        <p className="muted">Check that the backend is running and that you're signed in.</p>
      </main>
    )
  }
  if (me && me.role === 'ADMIN') {
    return <Navigate to="/admin/overview" replace />
  }
  if (me && !bakeryId) {
    if (firebaseEnabled && !me.emailVerified) return <VerifyEmail me={me} onVerified={loadMe} />
    return (
      <main className="main">
        <h1>You're not on a bakery's staff yet</h1>
        <p className="muted">
          Ask the bakery owner to add {me.email ?? 'your email'} in Settings. If you applied for a new bakery, it appears here once it is approved.
          Then reload this page.
        </p>
        {firebaseEnabled && (
          <button type="button" className="btn btn-outline" style={{ alignSelf: 'flex-start' }} onClick={() => void signOut(firebaseAuth())}>
            Sign in with another account
          </button>
        )}
      </main>
    )
  }
  if (!me || !bakery) return <p className="loading main">Loading…</p>

  const membership = me.bakeries.find((b) => b.id === bakery.id)
  return (
    <BakeryContext.Provider
      value={{
        me,
        bakery,
        isOwner: membership?.memberRole === 'OWNER',
        ...counts,
        switchBakery,
        refreshBakery,
        refreshCounts,
      }}
    >
      {children}
    </BakeryContext.Provider>
  )
}

// Bakeries only add staff and owners by a verified email, so this comes first.
function VerifyEmail({ me, onVerified }: { me: Me; onVerified: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
    } catch (e) {
      setError(authMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const resend = () =>
    run(async () => {
      const user = firebaseAuth().currentUser
      if (!user) return
      await sendEmailVerification(user, { url: `${window.location.origin}/orders` })
      setNotice(`Sent to ${me.email}. Check the inbox and the spam folder.`)
    })

  const check = () =>
    run(async () => {
      const user = firebaseAuth().currentUser
      if (!user) return
      await user.reload()
      if (!user.emailVerified) {
        setError("That email isn't verified yet. Open the link in the email first, then try again.")
        return
      }
      // A fresh token carries the verified flag to the backend.
      await user.getIdToken(true)
      await onVerified()
    })

  return (
    <main className="main stack-lg" style={{ maxWidth: 560 }}>
      <h1>Check your email</h1>
      <p>
        We sent a link to <strong>{me.email}</strong>. Open it to confirm the address is yours. Bakeries can only add you to their staff once it's
        confirmed.
      </p>
      {notice && (
        <p className="alert alert-ok" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void check()}>
          I've confirmed it
        </button>
        <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void resend()}>
          Send the email again
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => void signOut(firebaseAuth())}>
          Use another account
        </button>
      </div>
    </main>
  )
}
