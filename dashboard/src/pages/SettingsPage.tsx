import { useState, type FormEvent } from 'react'
import { addMember, cancelInvite, changeMemberRole, listInvites, listMembers, removeMember, setPublished, updateSettings } from '../api/bakeries'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PhotoField } from '../components/PhotoField'
import { Icon } from '../components/Icon'
import { useBakery } from '../context/bakery-context'
import { useToast } from '../context/toast-context'
import { useAsync } from '../hooks/useAsync'
import { MAX_AMOUNT } from '../lib/format'
import type { BakerySettings, Invite, Member, MemberRole } from '../types/api'

type Form = Pick<
  BakerySettings,
  'name' | 'phone' | 'address' | 'city' | 'about' | 'imageUrl' | 'deliveryAreas' | 'deliveryFee' | 'pickupAvailable' | 'acceptsCash' | 'acceptsMobileMoney' | 'mobileMoneyNumber' | 'handoverTimes' | 'occasions' | 'quoteExpiryDays'
>

const fromSettings = (b: BakerySettings): Form => ({
  name: b.name,
  phone: b.phone,
  address: b.address,
  city: b.city,
  about: b.about,
  imageUrl: b.imageUrl,
  deliveryAreas: b.deliveryAreas ?? [],
  deliveryFee: b.deliveryFee,
  pickupAvailable: b.pickupAvailable,
  acceptsCash: b.acceptsCash,
  acceptsMobileMoney: b.acceptsMobileMoney,
  mobileMoneyNumber: b.mobileMoneyNumber,
  handoverTimes: b.handoverTimes ?? ['10:00', '14:00', '17:00'],
  occasions: b.occasions ?? ['Birthday', 'Wedding', 'Introduction', 'Graduation', 'Baby shower', 'Other'],
  quoteExpiryDays: b.quoteExpiryDays,
})

export function SettingsPage() {
  const { bakery, isOwner, refreshBakery } = useBakery()
  const toast = useToast()
  const [form, setForm] = useState<Form>(() => fromSettings(bakery))
  const [fee, setFee] = useState(String(bakery.deliveryFee))
  const [newArea, setNewArea] = useState('')
  const [newTime, setNewTime] = useState('')
  const [newOccasion, setNewOccasion] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const original = fromSettings(bakery)
  const current = { ...form, deliveryFee: Number(fee.replaceAll(',', '')) }
  const changed = (Object.keys(original) as (keyof Form)[]).filter((k) => JSON.stringify(original[k]) !== JSON.stringify(current[k]))
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))
  const disabled = !isOwner

  const addArea = () => {
    const area = newArea.trim()
    if (!area) return
    if (!form.deliveryAreas.some((a) => a.toLowerCase() === area.toLowerCase())) set('deliveryAreas', [...form.deliveryAreas, area])
    setNewArea('')
  }

  const addTime = () => {
    const time = newTime.trim()
    if (!time) return
    if (!form.handoverTimes.includes(time)) {
      set('handoverTimes', [...form.handoverTimes, time].sort())
    }
    setNewTime('')
  }

  const addOccasion = () => {
    const occ = newOccasion.trim()
    if (!occ) return
    if (!form.occasions.some((o) => o.toLowerCase() === occ.toLowerCase())) {
      set('occasions', [...form.occasions, occ])
    }
    setNewOccasion('')
  }

  const save = async () => {
    if (!Number.isInteger(current.deliveryFee) || current.deliveryFee < 0) return setError('The delivery fee must be a whole number')
    if (current.deliveryFee > MAX_AMOUNT) return setError('That delivery fee is too large')
    if (!Number.isInteger(current.quoteExpiryDays) || current.quoteExpiryDays < 1 || current.quoteExpiryDays > 30) {
      return setError('Quotes can stay open for 1 to 30 days')
    }
    if (!current.name.trim()) return setError('The bakery needs a name')
    setSaving(true)
    setError(null)
    try {
      await updateSettings(bakery.id, Object.fromEntries(changed.map((k) => [k, current[k]])))
      refreshBakery()
      toast('Settings saved. Customers see the changes straight away.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const describeChanges = () => {
    const labels: Partial<Record<keyof Form, string>> = {
      deliveryFee: 'the delivery fee',
      deliveryAreas: 'the delivery areas',
      name: 'the name',
      imageUrl: 'the photo',
      quoteExpiryDays: 'how long quotes stay open',
    }
    if (changed.length === 1) return `You changed ${labels[changed[0]!] ?? 'a setting'}.`
    return `You changed ${changed.length} settings.`
  }

  return (
    <>
      <div className="page-header">
        <div className="stack">
          <h1>Bakery settings</h1>
          <p>How your bakery appears to customers, and who can use this dashboard.</p>
        </div>
      </div>
      {!isOwner && <p className="alert alert-info">Only the bakery owner can change these settings.</p>}

      <div className="sections stack-lg" style={{ maxWidth: 760, gap: 28 }}>
        <GoLiveSection unsaved={changed.length > 0} />

        <section className="stack-lg" aria-labelledby="profile-h">
          <h2 id="profile-h">Profile</h2>
          <div className="grid-2">
            <Text id="b-name" label="Bakery name" value={form.name} onChange={(v) => set('name', v)} disabled={disabled} />
            <Text id="b-phone" label="Phone customers can call" value={form.phone ?? ''} onChange={(v) => set('phone', v || null)} disabled={disabled} />
            <Text id="b-address" label="Shop address, for pickups" value={form.address ?? ''} onChange={(v) => set('address', v || null)} disabled={disabled} />
            <Text id="b-city" label="City" value={form.city} onChange={(v) => set('city', v)} disabled={disabled} />
          </div>
          <Text id="b-about" label="One line about you" value={form.about ?? ''} onChange={(v) => set('about', v || null)} disabled={disabled} hint="Shown under your name in the app." />
          <PhotoField label="Bakery photo, shown in the list of bakeries" value={form.imageUrl} onChange={(url) => set('imageUrl', url)} disabled={disabled} />
        </section>

        <section className="stack-lg" aria-labelledby="delivery-h">
          <h2 id="delivery-h">Delivery</h2>
          <div className="stack">
            <span id="areas-label" className="strong small">
              Areas you deliver to
            </span>
            <ul className="chips" aria-labelledby="areas-label">
              {form.deliveryAreas.map((area) => (
                <li key={area} className="chip">
                  {area}
                  {!disabled && (
                    <button type="button" aria-label={`Remove ${area}`} onClick={() => set('deliveryAreas', form.deliveryAreas.filter((a) => a !== area))}>
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </li>
              ))}
              {form.deliveryAreas.length === 0 && <li className="muted">No delivery areas. Customers can only pick up.</li>}
            </ul>
            {!disabled && (
              <div className="row" style={{ maxWidth: 420 }}>
                <label htmlFor="new-area" className="visually-hidden">
                  New delivery area
                </label>
                <input
                  id="new-area"
                  className="input"
                  style={{ flex: 1 }}
                  placeholder="Add an area, for example Kira"
                  value={newArea}
                  onChange={(e) => setNewArea(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addArea()
                    }
                  }}
                />
                <button type="button" className="btn btn-outline" onClick={addArea}>
                  Add
                </button>
              </div>
            )}
            <span className="hint">Only customers in these areas see your bakery, unless they choose to send a cake here.</span>
          </div>
          <div className="row" style={{ alignItems: 'flex-end', gap: 20 }}>
            <div className="field" style={{ flex: '0 1 220px' }}>
              <label htmlFor="b-fee">Delivery fee, {bakery.currency}</label>
              <input id="b-fee" className="input" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} disabled={disabled} />
              <span className="hint">Up to {MAX_AMOUNT.toLocaleString('en-US')}.</span>
            </div>
            <label className="check">
              <input type="checkbox" checked={form.pickupAvailable} onChange={(e) => set('pickupAvailable', e.target.checked)} disabled={disabled} />
              Customers can also pick up from the shop
            </label>
          </div>
        </section>

        <section className="stack-lg" aria-labelledby="times-h">
          <h2 id="times-h">Handover & Collection Times</h2>
          <div className="stack">
            <span id="times-label" className="strong small">
              Time slots customers can choose from for pickup or delivery
            </span>
            <ul className="chips" aria-labelledby="times-label">
              {form.handoverTimes.map((time) => (
                <li key={time} className="chip">
                  {time}
                  {!disabled && (
                    <button type="button" aria-label={`Remove ${time}`} onClick={() => set('handoverTimes', form.handoverTimes.filter((t) => t !== time))}>
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </li>
              ))}
              {form.handoverTimes.length === 0 && <li className="muted">No time slots configured.</li>}
            </ul>
            {!disabled && (
              <div className="row" style={{ maxWidth: 420 }}>
                <label htmlFor="new-time" className="visually-hidden">
                  New handover time
                </label>
                <input
                  id="new-time"
                  className="input"
                  style={{ flex: 1 }}
                  placeholder="e.g. 11:30 or 15:00"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTime()
                    }
                  }}
                />
                <button type="button" className="btn btn-outline" onClick={addTime}>
                  Add time
                </button>
              </div>
            )}
            <span className="hint">These time slots appear as choices in the customer date & time picker.</span>
          </div>
        </section>

        <section className="stack-lg" aria-labelledby="occasions-h">
          <h2 id="occasions-h">Celebration Occasions</h2>
          <div className="stack">
            <span id="occasions-label" className="strong small">
              Occasions you offer custom designs for
            </span>
            <ul className="chips" aria-labelledby="occasions-label">
              {form.occasions.map((occ) => (
                <li key={occ} className="chip">
                  {occ}
                  {!disabled && (
                    <button type="button" aria-label={`Remove ${occ}`} onClick={() => set('occasions', form.occasions.filter((o) => o !== occ))}>
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </li>
              ))}
              {form.occasions.length === 0 && <li className="muted">No celebration occasions configured.</li>}
            </ul>
            {!disabled && (
              <div className="row" style={{ maxWidth: 420 }}>
                <label htmlFor="new-occasion" className="visually-hidden">
                  New occasion
                </label>
                <input
                  id="new-occasion"
                  className="input"
                  style={{ flex: 1 }}
                  placeholder="e.g. Anniversary or Baby shower"
                  value={newOccasion}
                  onChange={(e) => setNewOccasion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addOccasion()
                    }
                  }}
                />
                <button type="button" className="btn btn-outline" onClick={addOccasion}>
                  Add occasion
                </button>
              </div>
            )}
            <span className="hint">Shown to customers as quick celebration chips when customizing their cakes.</span>
          </div>
        </section>

        <section className="stack-lg" aria-labelledby="pay-h">
          <h2 id="pay-h">Payments</h2>
          <div className="row" style={{ gap: 24 }}>
            <label className="check">
              <input type="checkbox" checked={form.acceptsCash} onChange={(e) => set('acceptsCash', e.target.checked)} disabled={disabled} />
              Cash
            </label>
            <label className="check">
              <input type="checkbox" checked={form.acceptsMobileMoney} onChange={(e) => set('acceptsMobileMoney', e.target.checked)} disabled={disabled} />
              Mobile Money
            </label>
          </div>
          <div className="grid-2">
            {form.acceptsMobileMoney && (
              <Text
                id="b-momo"
                label="Mobile Money number for deposits"
                value={form.mobileMoneyNumber ?? ''}
                onChange={(v) => set('mobileMoneyNumber', v || null)}
                disabled={disabled}
                hint="Customers see it when they accept a quote."
              />
            )}
            <div className="field">
              <span className="label">Currency</span>
              <span style={{ minHeight: 46, display: 'flex', alignItems: 'center' }}>{bakery.currency}</span>
              <span className="hint">Set when your bakery joined. All prices use it.</span>
            </div>
          </div>
        </section>

        <section className="stack-lg" aria-labelledby="quotes-h">
          <h2 id="quotes-h">Quotes</h2>
          <div className="field" style={{ maxWidth: 260 }}>
            <label htmlFor="b-expiry">Cancel unanswered quotes after, in days</label>
            <input
              id="b-expiry"
              className="input"
              type="number"
              min={1}
              max={30}
              value={form.quoteExpiryDays}
              onChange={(e) => set('quoteExpiryDays', Number(e.target.value))}
              disabled={disabled}
              aria-describedby="b-expiry-hint"
            />
            <span id="b-expiry-hint" className="hint">
              An order waiting for an answer holds a custom-cake slot. After this many days it is cancelled and the slot opens again. The customer is told.
            </span>
          </div>
        </section>

        <StaffSection />
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {isOwner && changed.length > 0 && (
        <div className="save-bar" role="region" aria-label="Unsaved changes">
          <span>{describeChanges()} Save to update the app.</span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setForm(original)
              setFee(String(bakery.deliveryFee))
              setError(null)
            }}
          >
            Discard
          </button>
          <button type="button" className="btn btn-light" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </>
  )
}

function Text({ id, label, value, onChange, disabled, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; disabled?: boolean; hint?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-describedby={hint ? `${id}-hint` : undefined} />
      {hint && (
        <span id={`${id}-hint`} className="hint">
          {hint}
        </span>
      )}
    </div>
  )
}

const ROLE_TEXT: Record<MemberRole, string> = {
  OWNER: 'Owner · can change settings and staff',
  STAFF: 'Staff · can handle orders, products and stock',
}

function StaffSection() {
  const { bakery, me, isOwner } = useBakery()
  const toast = useToast()
  const members = useAsync(() => listMembers(bakery.id), [bakery.id])
  const invites = useAsync(() => listInvites(bakery.id), [bakery.id])
  const [inviting, setInviting] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('STAFF')
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<Member | null>(null)
  const [demoting, setDemoting] = useState<Member | null>(null)
  const [cancelling, setCancelling] = useState<Invite | null>(null)

  const invite = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const result = await addMember(bakery.id, email.trim(), role)
      members.reload()
      invites.reload()
      setInviting(false)
      setEmail('')
      toast(
        result.status === 'ADDED'
          ? `${result.member.user.name ?? result.member.user.email} can now use this dashboard.`
          : `${result.invite.email} is invited. They join as soon as they sign in to this dashboard with that email confirmed.`,
      )
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const setRoleOf = async (member: Member, next: MemberRole) => {
    try {
      await changeMemberRole(bakery.id, member.id, next)
      members.reload()
      toast(`${member.user.name ?? member.user.email} is now ${next === 'OWNER' ? 'an owner' : 'staff'}.`)
    } catch (err) {
      toast((err as Error).message, { tone: 'error' })
    }
  }

  return (
    <section className="stack-lg" aria-labelledby="staff-h">
      <div className="row-between">
        <h2 id="staff-h">Staff</h2>
        {isOwner && !inviting && (
          <button type="button" className="btn btn-secondary" onClick={() => setInviting(true)}>
            Add someone
          </button>
        )}
      </div>
      {inviting && (
        <form className="panel" onSubmit={invite} style={{ gap: 14 }}>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="m-email">Their email</label>
              <input id="m-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby="m-email-hint" />
            </div>
            <div className="field">
              <label htmlFor="m-role">Role</label>
              <select id="m-role" value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
                <option value="STAFF">Staff</option>
                <option value="OWNER">Owner</option>
              </select>
            </div>
          </div>
          <span id="m-email-hint" className="hint">
            If they don't have an account yet, send them to {window.location.origin}/signin to create one with this email. They join once they confirm it.
          </span>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="row">
            <button type="submit" className="btn btn-primary">
              Add to staff
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setInviting(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {members.error && <p className="form-error">{members.error}</p>}
      <ul className="list">
        {(members.data ?? []).map((m) => (
          <li key={m.id} className="row-between">
            <span className="stack" style={{ gap: 2 }}>
              <span className="strong">
                {m.user.name ?? m.user.email}
                {m.user.id === me.id ? ' (you)' : ''}
              </span>
              <span className="small muted">{ROLE_TEXT[m.role]}</span>
            </span>
            {isOwner && (
              <span className="row">
                <label className="visually-hidden" htmlFor={`role-${m.id}`}>
                  Role for {m.user.name ?? m.user.email}
                </label>
                <select
                  id={`role-${m.id}`}
                  className="select-inline"
                  value={m.role}
                  onChange={(e) => {
                    const next = e.target.value as MemberRole
                    if (next === 'STAFF') setDemoting(m)
                    else void setRoleOf(m, next)
                  }}
                >
                  <option value="OWNER">Owner</option>
                  <option value="STAFF">Staff</option>
                </select>
                {m.user.id !== me.id && (
                  <button type="button" className="btn btn-sm btn-quiet-danger" onClick={() => setRemoving(m)}>
                    Remove
                  </button>
                )}
              </span>
            )}
          </li>
        ))}
        {(invites.data ?? []).map((i) => (
          <li key={i.id} className="row-between">
            <span className="stack" style={{ gap: 2 }}>
              <span className="strong">{i.email}</span>
              <span className="small muted">
                Invited as {i.role === 'OWNER' ? 'owner' : 'staff'} · joins when they sign in with this email confirmed
              </span>
            </span>
            {isOwner && (
              <button type="button" className="btn btn-sm btn-quiet-danger" onClick={() => setCancelling(i)}>
                Cancel invite
              </button>
            )}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.user.name ?? removing?.user.email ?? 'them'} from your staff?`}
        confirmLabel="Remove"
        tone="danger"
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return
          await removeMember(bakery.id, removing.id)
          members.reload()
          toast(`${removing.user.name ?? removing.user.email} no longer has access.`)
        }}
      >
        <p>They lose access to this dashboard straight away. Their past work on orders stays.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={demoting !== null}
        title={demoting?.user.id === me.id ? 'Stop being an owner?' : `Make ${demoting?.user.name ?? demoting?.user.email ?? 'them'} staff?`}
        confirmLabel="Change to staff"
        tone="danger"
        onClose={() => setDemoting(null)}
        onConfirm={async () => {
          if (!demoting) return
          await changeMemberRole(bakery.id, demoting.id, 'STAFF')
          members.reload()
          toast(`${demoting.user.name ?? demoting.user.email} is now staff.`)
          if (demoting.user.id === me.id) window.location.reload()
        }}
      >
        <p>
          {demoting?.user.id === me.id ? 'You' : 'They'} can still handle orders, products and stock, but not settings or staff. A bakery always keeps at
          least one owner.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={cancelling !== null}
        title={`Cancel the invite for ${cancelling?.email ?? ''}?`}
        confirmLabel="Cancel invite"
        cancelLabel="Keep invite"
        tone="danger"
        onClose={() => setCancelling(null)}
        onConfirm={async () => {
          if (!cancelling) return
          await cancelInvite(bakery.id, cancelling.id)
          invites.reload()
          toast(`${cancelling.email} won't be added.`)
        }}
      >
        <p>They won't join when they sign in. You can invite them again later.</p>
      </ConfirmDialog>
    </section>
  )
}

// Whether customers can see the bakery, what is missing before they can, and the switch.
function GoLiveSection({ unsaved }: { unsaved: boolean }) {
  const { bakery, isOwner, refreshBakery } = useBakery()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const problems = bakery.publishProblems
  const live = bakery.isPublished

  return (
    <section id="go-live" className="stack-lg" aria-labelledby="live-h">
      <div className="row-between">
        <h2 id="live-h">Visible to customers</h2>
        <span className={`status ${live ? 'status-approved' : 'status-pending'}`}>{live ? 'Live' : 'Hidden'}</span>
      </div>
      {live ? (
        <p>Customers can find {bakery.name} in the app and order.</p>
      ) : problems.length > 0 ? (
        <div className="stack">
          <p>Before customers can see {bakery.name}:</p>
          <ul className="stack" style={{ margin: 0, paddingLeft: 20 }}>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p>Everything customers need is in place. Publish when you're ready to take orders.</p>
      )}
      {!bakery.isActive && <p className="small strong">The platform has suspended this bakery, so it stays hidden even when published.</p>}
      {isOwner && (
        <div className="row">
          <button
            type="button"
            className={live ? 'btn btn-outline' : 'btn btn-primary'}
            disabled={!live && (problems.length > 0 || unsaved)}
            onClick={() => setConfirming(true)}
          >
            {live ? 'Hide from customers' : 'Publish bakery'}
          </button>
          {!live && unsaved && <span className="hint">Save your changes first.</span>}
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title={live ? `Hide ${bakery.name} from customers?` : `Publish ${bakery.name}?`}
        confirmLabel={live ? 'Hide bakery' : 'Publish'}
        tone={live ? 'danger' : 'primary'}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          await setPublished(bakery.id, !live)
          refreshBakery()
          toast(live ? `${bakery.name} is hidden. Open orders carry on as usual.` : `${bakery.name} is live. Customers can order now.`)
        }}
      >
        <p>
          {live
            ? "Customers can't find it or place new orders until you publish again, for example after a holiday. Orders you already have stay as they are."
            : 'Customers in your delivery areas can find it and order straight away. Check your products and prices once more.'}
        </p>
      </ConfirmDialog>
    </section>
  )
}
