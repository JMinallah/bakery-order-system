import { sendPasswordResetEmail } from 'firebase/auth'
import { useEffect, useState } from 'react'
import {
  listBakeryApplications,
  onboardBakeryApplication,
  updateBakeryApplicationStatus,
  type BakeryApplication,
  type BakeryApplicationStatus,
  type OnboardResult,
} from '../api/applications'
import { ApiError } from '../api/client'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../context/toast-context'
import { authMessage, firebaseAuth, firebaseEnabled } from '../lib/firebase'

const STATUS_LABELS: Record<BakeryApplicationStatus, string> = {
  PENDING: 'Pending review',
  CONTACTED: 'Contacted',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
}

const signInUrl = () => `${window.location.origin}/signin`

// Firebase sends it, so no email service is needed. The link lets them choose a password.
async function emailPasswordLink(email: string) {
  await sendPasswordResetEmail(firebaseAuth(), email, { url: signInUrl() })
}

function invitationMessage(application: BakeryApplication, account?: OnboardResult['account']) {
  const howToSignIn =
    account === 'CREATED'
      ? "We've emailed you a link to choose your password."
      : account === 'EXISTING'
        ? 'Use the password you already have.'
        : `If you don't have a password yet, choose "Create account" on that page with this same email.`
  return [
    `Hi ${application.contactName}, ${application.bakeryName} has been approved on Bakery Orders.`,
    `Sign in at ${signInUrl()} with ${application.email}. ${howToSignIn}`,
    "Your bakery stays hidden from customers while you add your products, prices and delivery areas. Press Publish in Settings when you're ready.",
  ].join('\n\n')
}

const declineMessage = (application: BakeryApplication) =>
  `Hi ${application.contactName}, thank you for applying to list ${application.bakeryName} on Bakery Orders. We aren't able to take it on right now. You're welcome to apply again later.`

type Pending = { application: BakeryApplication; action: 'approve' | 'decline' }

export function BakeryApplicationsPage() {
  const toast = useToast()
  const [applications, setApplications] = useState<BakeryApplication[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  // What onboarding said, so the invitation can say how they sign in.
  const [results, setResults] = useState<Record<string, OnboardResult['account']>>({})

  const load = () =>
    listBakeryApplications()
      .then(setApplications)
      .catch((cause) => setError(cause instanceof ApiError ? cause.message : 'Could not load applications.'))
      .finally(() => setLoading(false))

  useEffect(() => {
    void load()
  }, [])

  async function setStatus(application: BakeryApplication, status: Exclude<BakeryApplicationStatus, 'APPROVED'>) {
    setSavingId(application.id)
    setError(null)
    try {
      const updated = await updateBakeryApplicationStatus(application.id, status)
      setApplications((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)))
      toast(`${application.bakeryName} marked as ${STATUS_LABELS[status].toLowerCase()}.`)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not update this application.')
    } finally {
      setSavingId(null)
    }
  }

  async function approve(application: BakeryApplication) {
    const result = await onboardBakeryApplication(application.id)
    setResults((current) => ({ ...current, [application.id]: result.account }))
    let emailed = false
    if (result.account === 'CREATED' && firebaseEnabled) {
      try {
        await emailPasswordLink(application.email)
        emailed = true
      } catch (cause) {
        toast(`Bakery created, but the email didn't send: ${authMessage(cause)}`, { tone: 'error' })
      }
    }
    await load()
    toast(
      emailed
        ? `${result.bakery.name} created. ${application.contactName} has been emailed a link to set their password.`
        : `${result.bakery.name} created. Send ${application.contactName} the invitation below.`,
    )
  }

  async function resendEmail(application: BakeryApplication) {
    setSavingId(application.id)
    try {
      await emailPasswordLink(application.email)
      toast(`Sent to ${application.email}. Ask them to check their spam folder too.`)
    } catch (cause) {
      toast(authMessage(cause), { tone: 'error' })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <>
      <header className="page-header">
        <div className="stack">
          <p className="eyebrow">Platform admin</p>
          <h1>Bakery applications</h1>
          <p>Review new bakeries, record contact, and approve the ones ready for setup.</p>
        </div>
      </header>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? <p className="loading">Loading applications…</p> : applications.length === 0 ? (
        <div className="empty">
          <h2>No applications yet</h2>
          <p>New bakery applications will appear here after they submit the public form.</p>
        </div>
      ) : (
        <div className="application-list">
          {applications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              account={results[application.id]}
              busy={savingId === application.id}
              onStatus={(status) => void setStatus(application, status)}
              onApprove={() => setPending({ application, action: 'approve' })}
              onDecline={() => setPending({ application, action: 'decline' })}
              onResend={() => void resendEmail(application)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pending?.action === 'approve'}
        title={`Approve ${pending?.application.bakeryName ?? ''}?`}
        confirmLabel="Approve and create bakery"
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (pending) await approve(pending.application)
        }}
      >
        {pending && (
          <>
            <p>
              This creates the bakery and makes <strong>{pending.application.email}</strong> its owner. Customers can't see it until{' '}
              {pending.application.contactName} finishes setup and publishes it.
            </p>
            <p className="muted">
              {firebaseEnabled
                ? "If they don't have an account yet, we'll email them a link to choose a password."
                : 'Firebase isn’t set up here, so no email is sent. You will get a message to send them yourself.'}
            </p>
          </>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={pending?.action === 'decline'}
        title={`Decline ${pending?.application.bakeryName ?? ''}?`}
        confirmLabel="Decline"
        tone="danger"
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (pending) await setStatus(pending.application, 'DECLINED')
        }}
      >
        <p>Nothing is sent automatically. Afterwards you can copy a short message to let them know. You can reopen it later.</p>
      </ConfirmDialog>
    </>
  )
}

function ApplicationCard({
  application,
  account,
  busy,
  onStatus,
  onApprove,
  onDecline,
  onResend,
}: {
  application: BakeryApplication
  account?: OnboardResult['account']
  busy: boolean
  onStatus: (status: 'PENDING' | 'CONTACTED') => void
  onApprove: () => void
  onDecline: () => void
  onResend: () => void
}) {
  const open = application.status === 'PENDING' || application.status === 'CONTACTED'
  const message = application.bakery
    ? application.owner === 'LINKED'
      ? null
      : invitationMessage(application, account)
    : application.status === 'DECLINED'
      ? declineMessage(application)
      : null

  return (
    <article className="application-card">
      <div className="application-card-header">
        <div className="stack">
          <h2>{application.bakeryName}</h2>
          <p className="muted">{application.city} · Applied {new Date(application.createdAt).toLocaleDateString()}</p>
        </div>
        <span className={`status status-${application.status.toLowerCase()}`}>{STATUS_LABELS[application.status]}</span>
      </div>
      <div className="application-card-details">
        <p><strong>Contact</strong> {application.contactName}</p>
        <p><strong>Email</strong> <a href={`mailto:${application.email}`}>{application.email}</a></p>
        <p><strong>Phone</strong> <a href={`tel:${application.phone}`}>{application.phone}</a></p>
      </div>
      {application.notes && <p className="application-card-notes">“{application.notes}”</p>}

      {application.bakery && (
        <p className={`alert ${application.owner === 'LINKED' ? 'alert-ok' : 'alert-info'}`}>
          <span>
            {application.owner === 'LINKED'
              ? `${application.contactName} owns ${application.bakery.name} and can sign in.`
              : `Waiting for ${application.email} to sign in with a verified email. They become the owner when they do.`}{' '}
            {application.bakery.isPublished ? 'Customers can see it.' : 'Hidden from customers until they publish it.'}
          </span>
        </p>
      )}

      <div className="row">
        {application.status === 'PENDING' && (
          <button className="btn btn-outline btn-sm" type="button" disabled={busy} onClick={() => onStatus('CONTACTED')}>
            Mark as contacted
          </button>
        )}
        {open && (
          <>
            <button className="btn btn-danger-outline btn-sm" type="button" disabled={busy} onClick={onDecline}>
              Decline
            </button>
            <button className="btn btn-dark btn-sm" type="button" disabled={busy} onClick={onApprove}>
              Approve and create bakery
            </button>
          </>
        )}
        {application.status === 'DECLINED' && (
          <button className="btn btn-outline btn-sm" type="button" disabled={busy} onClick={() => onStatus('PENDING')}>
            Reopen
          </button>
        )}
        {application.bakery && application.owner !== 'LINKED' && firebaseEnabled && (
          <button className="btn btn-outline btn-sm" type="button" disabled={busy} onClick={onResend}>
            Email the set-password link again
          </button>
        )}
      </div>

      {message && <MessageToSend label={application.bakery ? 'Invitation to send them' : 'Message to let them know'} text={message} />}
    </article>
  )
}

// A ready message the admin can paste into WhatsApp or email, for anything the system doesn't send itself.
function MessageToSend({ label, text }: { label: string; text: string }) {
  const toast = useToast()
  const [shown, setShown] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast('Copied. Paste it into WhatsApp or an email.')
    } catch {
      setShown(true)
      toast("Couldn't copy automatically. Select the message and copy it.", { tone: 'error' })
    }
  }
  return (
    <div className="stack">
      <div className="row">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copy()}>
          Copy {label.toLowerCase()}
        </button>
        <button type="button" className="btn btn-quiet btn-sm" aria-expanded={shown} onClick={() => setShown((s) => !s)}>
          {shown ? 'Hide message' : 'Show message'}
        </button>
      </div>
      {shown && (
        <textarea readOnly rows={6} value={text} aria-label={label} onFocus={(e) => e.currentTarget.select()} />
      )}
    </div>
  )
}
