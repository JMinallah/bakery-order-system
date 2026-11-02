import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMe } from '../api/bakeries'
import { send } from '../api/client'
import { authMessage, firebaseAuth } from '../lib/firebase'
import { PublicNav } from '../components/PublicNav'

type Mode = 'sign-in' | 'create' | 'reset'

export function SignInPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth(), (user) => {
      if (user) {
        getMe()
          .then((me) => {
            if (me.role === 'ADMIN' && me.bakeries.length === 0) {
              navigate('/admin/overview', { replace: true })
            } else {
              navigate('/orders', { replace: true })
            }
          })
          .catch(() => undefined)
      }
    })
  }, [navigate])

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
    } catch (e) {
      // Closing the Google window isn't an error worth showing.
      if ((e as { code?: string }).code !== 'auth/popup-closed-by-user') setError(authMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const auth = firebaseAuth()
    if (mode === 'reset') {
      return run(async () => {
        await sendPasswordResetEmail(auth, email.trim())
        setNotice(`If ${email.trim()} has an account, a reset link is on its way. Check the inbox and spam folder.`)
        setMode('sign-in')
      })
    }
    if (mode === 'create') {
      if (!name.trim()) return setError('Add your name, so the bakery knows who you are')
      return run(async () => {
        const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password)
        await updateProfile(user, { displayName: name.trim() })
        // A bakery only links someone by a verified email, so ask Firebase to send the check now.
        await sendEmailVerification(user, { url: `${window.location.origin}/orders` }).catch(() => undefined)
        // The account may already exist on the backend without a name, so save it there too.
        await user.getIdToken(true)
        await send('PATCH', '/users/me', { name: name.trim() }).catch(() => undefined)
      })
    }
    return run(async () => {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
      await cred.user.getIdToken(true)
      const me = await getMe().catch(() => null)
      if (me && me.role === 'ADMIN' && me.bakeries.length === 0) {
        navigate('/admin/overview', { replace: true })
      } else {
        navigate('/orders', { replace: true })
      }
    })
  }

  const titles: Record<Mode, string> = { 'sign-in': 'Sign in', create: 'Create your account', reset: 'Reset your password' }

  return (
    <main className="auth-page">
      <PublicNav />
      <div className="auth-shell">
        <section className="auth-panel">
        <div className="auth-form-wrap">
          <div className="stack">
            <h2>{titles[mode]}</h2>
            {mode === 'sign-in' && <p className="muted">Pick up where your bakery left off.</p>}
            {mode === 'create' && <p className="muted">After you create it, the bakery owner adds you to their staff from Settings.</p>}
            {mode === 'reset' && <p className="muted">We'll email you a link to choose a new password.</p>}
          </div>

          {notice && (
            <p className="alert alert-ok" role="status">
              {notice}
            </p>
          )}

          <form className="stack-lg" onSubmit={submit} noValidate>
          {mode === 'create' && (
            <div className="field">
              <label htmlFor="name">Your name</label>
              <input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" className="input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode !== 'reset' && (
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input"
                autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby={mode === 'create' ? 'password-hint' : undefined}
              />
              {mode === 'create' && (
                <span id="password-hint" className="hint">
                  At least 6 characters.
                </span>
              )}
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : mode === 'create' ? 'Create account' : 'Send reset link'}
          </button>
          </form>

          {mode !== 'reset' && (
            <>
              <div className="row" style={{ gap: 12, color: 'var(--muted)' }}>
                <span style={{ flex: 1, height: 1, background: 'var(--line-strong)' }} />
                or
                <span style={{ flex: 1, height: 1, background: 'var(--line-strong)' }} />
              </div>
              <button type="button" className="btn btn-outline btn-block" disabled={busy} onClick={() => run(() => signInWithPopup(firebaseAuth(), new GoogleAuthProvider()))}>
                Continue with Google
              </button>
            </>
          )}

          <div className="stack auth-links">
            {mode === 'sign-in' && (
              <>
                <button type="button" className="btn btn-quiet" onClick={() => setMode('reset')}>
                  Forgot your password?
                </button>
                <button type="button" className="btn btn-quiet" onClick={() => setMode('create')}>
                  New to the team? Create an account
                </button>
              </>
            )}
            {mode !== 'sign-in' && (
              <button type="button" className="btn btn-quiet" onClick={() => setMode('sign-in')}>
                Back to sign in
              </button>
            )}
          </div>
        </div>
        </section>
      </div>
    </main>
  )
}
