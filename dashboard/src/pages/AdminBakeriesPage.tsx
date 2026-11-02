import { useEffect, useState } from 'react'
import { assignBakeryOwner, listPlatformBakeries, updateBakeryStatus, type PlatformBakery } from '../api/admin'
import { ApiError } from '../api/client'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../context/toast-context'

function visibility(bakery: PlatformBakery) {
  if (!bakery.isActive) return { label: 'Suspended', className: 'status-declined' }
  if (!bakery.isPublished) return { label: 'Setting up, hidden', className: 'status-pending' }
  return { label: 'Live on the marketplace', className: 'status-approved' }
}

export function AdminBakeriesPage() {
  const toast = useToast()
  const [bakeries, setBakeries] = useState<PlatformBakery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<PlatformBakery | null>(null)
  const [assigning, setAssigning] = useState<PlatformBakery | null>(null)
  const [ownerEmail, setOwnerEmail] = useState('')

  const load = () =>
    listPlatformBakeries()
      .then(setBakeries)
      .catch((cause) => setError(cause instanceof ApiError ? cause.message : 'Could not load bakeries.'))
      .finally(() => setLoading(false))

  useEffect(() => {
    void load()
  }, [])

  return (
    <>
      <header className="page-header">
        <div className="stack">
          <p className="eyebrow">Platform Governance</p>
          <h1>Bakeries Directory</h1>
          <p>Supervise bakeries operating on the marketplace. Suspended bakeries cannot receive new customer orders.</p>
        </div>
      </header>

      {error && <p className="form-error" role="alert">{error}</p>}

      {loading ? (
        <p className="loading">Loading bakeries directory…</p>
      ) : bakeries.length === 0 ? (
        <div className="empty">
          <h2>No bakeries registered yet</h2>
          <p>Onboarded bakeries from the applications tab will appear here.</p>
        </div>
      ) : (
        <div className="application-list">
          {bakeries.map((bakery) => {
            const state = visibility(bakery)
            return (
              <article key={bakery.id} className="application-card">
                <div className="application-card-header">
                  <div className="stack">
                    <h2>{bakery.name}</h2>
                    <p className="muted small">
                      <code>{bakery.slug}</code> · {bakery.city} · Joined {new Date(bakery.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`status ${state.className}`}>{state.label}</span>
                </div>
                <div className="application-card-details">
                  <p><strong>Phone</strong> {bakery.phone || 'None given'}</p>
                  <p><strong>Staff</strong> {bakery._count.members}</p>
                  <p><strong>Products</strong> {bakery._count.products}</p>
                  <p><strong>Orders</strong> {bakery._count.orders}, {bakery.openOrders} open</p>
                </div>
                {bakery.owners === 0 && (
                  <p className="alert">
                    <span>
                      {bakery._count.invites > 0
                        ? 'No owner yet. Someone has been invited and becomes the owner once they sign in with a verified email.'
                        : "No owner. Nobody can change this bakery's settings or staff until you assign one."}
                    </span>
                  </p>
                )}
                <div className="row">
                  <button
                    type="button"
                    className={`btn btn-sm ${bakery.isActive ? 'btn-danger-outline' : 'btn-primary'}`}
                    onClick={() => setToggling(bakery)}
                  >
                    {bakery.isActive ? 'Suspend bakery' : 'Reactivate bakery'}
                  </button>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => setAssigning(bakery)}>
                    Assign an owner
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={toggling !== null}
        title={toggling?.isActive ? `Suspend ${toggling.name}?` : `Reactivate ${toggling?.name ?? ''}?`}
        confirmLabel={toggling?.isActive ? 'Suspend bakery' : 'Reactivate bakery'}
        tone={toggling?.isActive ? 'danger' : 'primary'}
        onClose={() => setToggling(null)}
        onConfirm={async () => {
          if (!toggling) return
          const updated = await updateBakeryStatus(toggling.id, !toggling.isActive)
          setBakeries((current) => current.map((b) => (b.id === updated.id ? { ...b, isActive: updated.isActive } : b)))
          toast(updated.isActive ? `${toggling.name} is active again.` : `${toggling.name} is suspended.`)
        }}
      >
        {toggling?.isActive ? (
          <>
            <p>Customers stop seeing it and can't place new orders. Its staff see a notice in their dashboard.</p>
            {toggling.openOrders > 0 && (
              <p className="strong">
                It has {toggling.openOrders} open {toggling.openOrders === 1 ? 'order' : 'orders'}. They stay with the bakery to finish, and customers are not told
                automatically.
              </p>
            )}
          </>
        ) : (
          <p>Customers can find it and order again{toggling?.isPublished ? '' : ' once its owner publishes it'}.</p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={assigning !== null}
        title={`Assign an owner to ${assigning?.name ?? ''}`}
        confirmLabel="Assign owner"
        onClose={() => {
          setAssigning(null)
          setOwnerEmail('')
        }}
        onConfirm={async () => {
          if (!assigning) return
          if (!/^\S+@\S+\.\S+$/.test(ownerEmail.trim())) throw new Error('Enter their email address')
          const result = await assignBakeryOwner(assigning.id, ownerEmail.trim())
          await load()
          toast(
            result.status === 'ADDED'
              ? `${ownerEmail.trim()} is now an owner of ${assigning.name}.`
              : `${ownerEmail.trim()} becomes an owner when they sign in with that email verified.`,
          )
        }}
      >
        <p>Use this when a bakery has lost its owner. You still won't see the bakery's orders or stock yourself.</p>
        <div className="field">
          <label htmlFor="owner-email">Their email</label>
          <input id="owner-email" type="email" className="input" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
          <span className="hint">If they don't have a verified account yet, they become the owner the first time they sign in.</span>
        </div>
      </ConfirmDialog>
    </>
  )
}
