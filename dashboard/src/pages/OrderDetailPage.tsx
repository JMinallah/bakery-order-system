import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { addComment, cancelOrder, getOrder, recordPayment, removePayment, sendQuotation, updateOrderStatus } from '../api/orders'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Icon } from '../components/Icon'
import { PaymentBadge, StatusBadge } from '../components/StatusBadge'
import { useBakery } from '../context/bakery-context'
import { useToast } from '../context/toast-context'
import { useAsync } from '../hooks/useAsync'
import { formatDateTime, formatMoney, MAX_AMOUNT, orderRef } from '../lib/format'
import { resolveImageUrl } from '../lib/image'
import {
  CANCELLED_BY_LABELS,
  canQuote,
  canRecordPayment,
  isOpen,
  needsQuote,
  nextAction,
  orderTitle,
  quoteExpiresAt,
  STATUS_LABELS,
  stepsFor,
  TYPE_LABELS,
} from '../lib/order-flow'
import type { Order, Payment, PaymentMethod } from '../types/api'

export function OrderDetailPage() {
  const { id = '' } = useParams()
  const { data: order, error, loading, setData, reload } = useAsync(() => getOrder(id), [id])

  if (loading && !order) return <p className="loading">Loading the order…</p>
  if (error || !order) {
    return (
      <>
        <Link to="/orders" className="back-link">
          <Icon name="back" size={18} /> All orders
        </Link>
        <p className="form-error">{error ?? 'Order not found'}</p>
      </>
    )
  }
  return <OrderView order={order} onChange={setData} reload={reload} />
}

function OrderView({ order, onChange, reload }: { order: Order; onChange: (o: Order) => void; reload: () => void }) {
  const { bakery, refreshCounts } = useBakery()
  const toast = useToast()
  const tz = bakery.timezone
  const [cancelling, setCancelling] = useState(false)
  const [moving, setMoving] = useState(false)
  const [completingUnpaid, setCompletingUnpaid] = useState(false)
  const customerName = order.customer.name ?? 'The customer'
  const owed = order.total != null ? order.total - order.amountPaid : 0

  const updated = (next: Order, message?: string) => {
    onChange(next)
    refreshCounts()
    if (message) toast(message)
  }

  // Someone else changed the order first. Show what it is now rather than the stale page.
  const reloadOnConflict = (e: unknown) => {
    if (e instanceof ApiError && e.status === 409) reload()
  }

  const next = nextAction(order)
  const move = async () => {
    if (!next) return
    const result = await updateOrderStatus(order.id, next.status)
    updated(result, `Order moved to ${STATUS_LABELS[next.status].toLowerCase()}. ${customerName} has been notified.`)
  }
  const moveOn = async () => {
    if (!next) return
    if (next.status === 'COMPLETED' && owed > 0) return setCompletingUnpaid(true)
    setMoving(true)
    try {
      await move()
    } catch (e) {
      reloadOnConflict(e)
      toast((e as Error).message, { tone: 'error' })
    } finally {
      setMoving(false)
    }
  }

  return (
    <>
      <Link to="/orders" className="back-link">
        <Icon name="back" size={18} /> All orders
      </Link>

      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div className="stack">
          <div className="row" style={{ gap: 12 }}>
            <h1 style={{ fontSize: 32 }}>{orderTitle(order)}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p style={{ color: 'var(--ink-2)' }}>
            {orderRef(order)} · {TYPE_LABELS[order.type]} · Due {formatDateTime(order.dueDate, tz)} ·{' '}
            {order.fulfilment === 'PICKUP' ? 'Pickup' : `Delivery to ${order.deliveryArea}`}
          </p>
        </div>
        <div className="row">
          {isOpen(order.status) && (
            <button type="button" className="btn btn-danger-outline" onClick={() => setCancelling(true)}>
              Cancel order
            </button>
          )}
          {next && (
            <button type="button" className="btn btn-primary" onClick={moveOn} disabled={moving}>
              {moving ? 'Saving…' : `${next.label} →`}
            </button>
          )}
        </div>
      </div>

      {order.status === 'CANCELLED' && (
        <div className="alert alert-danger">
          <span>
            <strong>{order.cancelledBy ? CANCELLED_BY_LABELS[order.cancelledBy] : 'Cancelled'}.</strong>
            {order.cancelReason ? ` Reason: ${order.cancelReason}` : ''}
          </span>
        </div>
      )}

      <Progress order={order} />

      <div className="split">
        <div className="split-main sections">
          <DesignSection order={order} />
          <MessagesSection order={order} onSent={reload} />
        </div>
        <div className="split-side panel">
          <section className="stack" aria-labelledby="customer-h">
            <h4 id="customer-h">Customer</h4>
            <span className="strong">{order.customer.name ?? 'No name given'}</span>
            {order.customer.phone ? (
              <a href={`tel:${order.customer.phone.replaceAll(' ', '')}`}>{order.customer.phone}</a>
            ) : (
              <span className="small strong" style={{ color: 'var(--warn)' }}>
                No phone number. Use Messages to reach them.
              </span>
            )}
            {order.customer.email && <span className="muted">{order.customer.email}</span>}
            {order.deliveryAddress && <span>{order.deliveryAddress}</span>}
          </section>
          {needsQuote(order.type) && <QuoteSection order={order} onQuoted={reload} onConflict={reloadOnConflict} />}
          <PaymentSection order={order} onChange={updated} onConflict={reloadOnConflict} />
        </div>
      </div>

      <CancelDialog
        open={cancelling}
        order={order}
        onClose={() => setCancelling(false)}
        onCancelled={(o) => updated(o, `Order cancelled. ${customerName} has been told why.`)}
        onConflict={reloadOnConflict}
      />

      <ConfirmDialog
        open={completingUnpaid}
        title={`${next?.label ?? 'Complete'} with ${formatMoney(owed, order.currency)} still owed?`}
        confirmLabel={next?.label ?? 'Complete'}
        cancelLabel="Record the payment first"
        onClose={() => setCompletingUnpaid(false)}
        onConfirm={async () => {
          try {
            await move()
          } catch (e) {
            reloadOnConflict(e)
            throw e
          }
        }}
      >
        <p>
          {customerName} has paid {formatMoney(order.amountPaid, order.currency)} of {formatMoney(order.total, order.currency)}. If they paid the rest at
          handover, record it in Payment first so your records add up. You can still record it afterwards.
        </p>
      </ConfirmDialog>
    </>
  )
}

function Progress({ order }: { order: Order }) {
  if (order.status === 'CANCELLED') return null
  const steps = stepsFor(order.type)
  const current = steps.indexOf(order.status)
  return (
    <ol className="steps" aria-label="Order progress">
      {steps.map((s, i) => (
        <li key={s} className={i < current ? 'done' : i === current ? 'current' : undefined} aria-current={i === current ? 'step' : undefined}>
          <span className="dot">{i + 1}</span>
          {STATUS_LABELS[s]}
        </li>
      ))}
    </ol>
  )
}

function DesignSection({ order }: { order: Order }) {
  const { bakery } = useBakery()
  const described: [string, string | null][] = [
    ['Occasion', order.occasion],
    ['Flavour', order.flavour],
    ['Icing', order.icing],
    ['Size', order.size],
    ['Colours', order.colours],
    ['Theme', order.theme],
  ]
  // Several decorations come as several selections in one group.
  const chosen = new Map<string, string[]>()
  for (const s of order.selections) chosen.set(s.groupName, [...(chosen.get(s.groupName) ?? []), s.optionName])

  return (
    <section className="stack-lg" aria-labelledby="design-h">
      <h2 id="design-h">{order.type === 'STANDARD' ? 'What they ordered' : 'What they asked for'}</h2>

      {order.items.length > 0 && (
        <ul className="list">
          {order.items.map((item) => (
            <li key={item.id} className="row-between">
              <span>
                {item.quantity} × {item.product.name}
                {order.type !== 'STANDARD' && <span className="muted"> (starting point)</span>}
              </span>
              <span className="muted">{formatMoney(item.unitPrice * item.quantity, order.currency)}</span>
            </li>
          ))}
        </ul>
      )}

      {order.designImageUrl && (
        <div style={{ padding: '16px', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--line)', marginBottom: 20 }}>
          <div className="row-between" style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '4px 10px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              ✨ {chosen.size > 0 ? 'Cake Builder Design' : 'Custom AI Cake Concept'}
            </span>
            {resolveImageUrl(order.designImageUrl) && (
              <a
                href={resolveImageUrl(order.designImageUrl)}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}
              >
                Open full photo ↗
              </a>
            )}
          </div>
          <div className="row" style={{ alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
            {resolveImageUrl(order.designImageUrl) ? (
              <a href={resolveImageUrl(order.designImageUrl)} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                <img
                  className="design-image"
                  style={{ width: '280px', height: '210px', objectFit: 'cover', borderRadius: '14px', display: 'block' }}
                  src={resolveImageUrl(order.designImageUrl)}
                  alt="Customer's bespoke cake design"
                  onError={(e) => {
                    const target = e.currentTarget
                    target.style.display = 'none'
                  }}
                />
              </a>
            ) : (
              <div
                style={{
                  width: '280px',
                  height: '160px',
                  background: 'var(--sand)',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--muted)',
                  fontSize: 13,
                  textAlign: 'center',
                  padding: 16,
                }}
              >
                AI Design Concept Attached
              </div>
            )}
            {chosen.size > 0 && (
              <dl className="dl" style={{ flex: '1 1 260px' }}>
                {[...chosen].map(([group, names]) => (
                  <div key={group}>
                    <dt>{group}</dt>
                    <dd>{names.join(', ')}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      )}

      {chosen.size > 0 && !order.designImageUrl && (
        <dl className="dl" style={{ marginBottom: 20 }}>
          {[...chosen].map(([group, names]) => (
            <div key={group}>
              <dt>{group}</dt>
              <dd>{names.join(', ')}</dd>
            </div>
          ))}
        </dl>
      )}

      <dl className="dl-rows">
        {described
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <Row key={label} label={label} value={value!} />
          ))}
        {order.inscription && <Row label="Writing" value={`“${order.inscription}”`} />}
        {order.notes && <Row label="Notes" value={order.notes} strong />}
        {order.budget != null && <Row label="Budget" value={formatMoney(order.budget, order.currency)} />}
        <Row
          label={order.fulfilment === 'PICKUP' ? 'Pickup' : 'Delivery'}
          value={`${formatDateTime(order.dueDate, bakery.timezone)}${order.deliveryAddress ? `, ${order.deliveryAddress}` : ''}`}
        />
        <Row label="Ordered" value={formatDateTime(order.createdAt, bakery.timezone)} />
      </dl>

      {order.images.length > 0 && (
        <div className="stack">
          <span className="muted small">Inspiration photos</span>
          <div className="photos">
            {order.images.map((img, i) => (
              <a key={img.id} href={resolveImageUrl(img.url)} target="_blank" rel="noreferrer">
                <img src={resolveImageUrl(img.url)} alt={`Inspiration photo ${i + 1}`} />
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className={strong ? 'strong' : undefined}>{value}</dd>
    </>
  )
}

function MessagesSection({ order, onSent }: { order: Order; onSent: () => void }) {
  const { bakery } = useBakery()
  const toast = useToast()
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    try {
      await addComment(order.id, body.trim())
      setBody('')
      onSent()
    } catch (err) {
      toast((err as Error).message, { tone: 'error' })
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="stack-lg" aria-labelledby="messages-h">
      <h2 id="messages-h">Messages</h2>
      {order.comments.length === 0 ? (
        <p className="muted">No messages yet. Anything you send here reaches the customer as a notification.</p>
      ) : (
        <div className="thread">
          {order.comments.map((c) => (
            <div key={c.id} className={`bubble ${c.fromBakery ? 'own' : ''}`}>
              <span>{c.body}</span>
              <span className="meta">
                {c.fromBakery ? (c.author.name ?? bakery.name) : (order.customer.name ?? 'Customer')} · {formatDateTime(c.createdAt, bakery.timezone)}
              </span>
            </div>
          ))}
        </div>
      )}
      <form className="row" onSubmit={submit}>
        <label htmlFor="reply" className="visually-hidden">
          Reply to the customer
        </label>
        <input id="reply" className="input" style={{ flex: '1 1 260px' }} placeholder="Reply to the customer" value={body} onChange={(e) => setBody(e.target.value)} />
        <button type="submit" className="btn btn-dark" disabled={sending || !body.trim()}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </section>
  )
}

function QuoteSection({ order, onQuoted, onConflict }: { order: Order; onQuoted: () => void; onConflict: (e: unknown) => void }) {
  const { bakery } = useBakery()
  const toast = useToast()
  const latest = order.quotations[0]
  const accepted = order.quotations.find((q) => q.acceptedAt)
  const [amount, setAmount] = useState(String(latest?.amount ?? order.estimate ?? ''))
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!canQuote(order.status)) {
    return (
      <section className="stack" aria-labelledby="quote-h">
        <h2 id="quote-h">Quote</h2>
        {accepted ? (
          <p>
            <strong>{formatMoney(accepted.amount, order.currency)}</strong> accepted on {formatDateTime(accepted.acceptedAt!, bakery.timezone)}.
          </p>
        ) : (
          <p className="muted">No quote was accepted for this order.</p>
        )}
      </section>
    )
  }

  const priced = order.selections.filter((s) => s.price > 0)
  const value = Number(amount.replaceAll(',', ''))
  const valid = Number.isInteger(value) && value > 0

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) {
      setError('Enter the price as a whole number, for example 165000')
      return
    }
    if (value > MAX_AMOUNT) {
      setError('That price is too large')
      return
    }
    setSending(true)
    setError(null)
    try {
      await sendQuotation(order.id, value, note.trim())
      setNote('')
      toast(`Quote sent. ${order.customer.name ?? 'The customer'} can now accept it in the app.`)
      onQuoted()
    } catch (err) {
      onConflict(err)
      setError((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="stack-lg" aria-labelledby="quote-h">
      <h2 id="quote-h">{order.status === 'QUOTED' ? 'Quote sent' : 'Send a quote'}</h2>

      {order.status === 'QUOTED' && latest && (
        <p className="alert alert-info" style={{ display: 'block' }}>
          <strong>{formatMoney(latest.amount, order.currency)}</strong> sent {formatDateTime(latest.createdAt, bakery.timezone)}. Waiting for{' '}
          {order.customer.name ?? 'the customer'} to accept. Sending a new quote replaces it. If there's no answer by{' '}
          {formatDateTime(quoteExpiresAt(latest.createdAt, bakery.quoteExpiryDays).toISOString(), bakery.timezone)}, the order is cancelled and the day
          opens up again.
        </p>
      )}

      {order.estimate != null && (
        <div className="sums">
          <span className="strong" style={{ color: 'var(--ink)' }}>
            Estimate from your builder prices
          </span>
          {priced.map((s) => (
            <div key={s.id}>
              <span>{s.optionName}</span>
              <span>{formatMoney(s.price, order.currency)}</span>
            </div>
          ))}
          <div className="total">
            <span>Estimate</span>
            <span>{formatMoney(order.estimate, order.currency)}</span>
          </div>
        </div>
      )}
      {order.budget != null && (
        <p className="small strong" style={{ color: order.estimate != null && order.estimate > order.budget ? 'var(--warn)' : 'var(--ink-2)' }}>
          The customer's budget is {formatMoney(order.budget, order.currency)}.
        </p>
      )}

      <form className="stack-lg" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="quote-amount">{order.status === 'QUOTED' ? 'New quote amount' : 'Quote amount'}</label>
          <div className="input-group">
            <span>{order.currency}</span>
            <input id="quote-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!error} aria-describedby="quote-error" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="quote-note">
            Note to the customer <span className="optional">· optional</span>
          </label>
          <textarea id="quote-note" rows={3} placeholder="What the price includes, or a cheaper option" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && (
          <p id="quote-error" className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={sending}>
          {sending ? 'Sending…' : order.status === 'QUOTED' ? 'Send new quote' : 'Send quote'}
        </button>
        <span className="hint">
          The customer gets a notification and can accept it or ask for changes. Unanswered quotes are cancelled after {bakery.quoteExpiryDays}{' '}
          {bakery.quoteExpiryDays === 1 ? 'day' : 'days'}.
        </span>
      </form>
    </section>
  )
}

function PaymentSection({
  order,
  onChange,
  onConflict,
}: {
  order: Order
  onChange: (o: Order, message?: string) => void
  onConflict: (e: unknown) => void
}) {
  const { bakery } = useBakery()
  const methods: PaymentMethod[] = [...(bakery.acceptsMobileMoney ? ['MOBILE_MONEY' as const] : []), ...(bakery.acceptsCash ? ['CASH' as const] : [])]
  const owed = order.total != null ? Math.max(order.total - order.amountPaid, 0) : null
  const [amount, setAmount] = useState(owed ? String(owed) : '')
  const [method, setMethod] = useState<PaymentMethod>(methods[0] ?? 'CASH')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState<Payment | null>(null)

  const value = Number(amount.replaceAll(',', ''))
  const completes = owed != null && value === owed
  const money = (n: number) => formatMoney(n, order.currency)

  const ask = (e: FormEvent) => {
    e.preventDefault()
    if (!Number.isInteger(value) || value <= 0) {
      setError('Enter the amount received as a whole number')
      return
    }
    if (owed != null && value > owed) {
      setError(`That's more than the ${money(owed)} still owed`)
      return
    }
    setError(null)
    setConfirming(true)
  }

  return (
    <section className="stack-lg" aria-labelledby="payment-h">
      <div className="row-between">
        <h2 id="payment-h">Payment</h2>
        <PaymentBadge status={order.paymentStatus} />
      </div>

      {order.total != null && (
        <div className="sums">
          <div>
            <span>Total</span>
            <span>{money(order.total)}</span>
          </div>
          <div>
            <span>Received</span>
            <span>{money(order.amountPaid)}</span>
          </div>
          <div className="total">
            <span>Still owed</span>
            <span>{money(owed ?? 0)}</span>
          </div>
        </div>
      )}

      {order.payments.length > 0 && (
        <ul className="list">
          {order.payments.map((p) => (
            <li key={p.id} className="row-between">
              <span className="stack" style={{ gap: 0 }}>
                <span className="strong">{money(p.amount)}</span>
                <span className="small muted">
                  {p.method === 'CASH' ? 'Cash' : 'Mobile Money'} · {formatDateTime(p.createdAt, bakery.timezone)}
                  {p.note ? ` · ${p.note}` : ''}
                </span>
              </span>
              <button type="button" className="btn btn-sm btn-quiet-danger" onClick={() => setRemoving(p)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {!canRecordPayment(order.status) ? (
        <p className="small muted">
          {order.status === 'CANCELLED'
            ? 'This order is cancelled.'
            : needsQuote(order.type)
              ? 'You can record a deposit once you have sent a quote.'
              : 'You can record payments once you confirm the order.'}{' '}
          Money is never taken through the system.
        </p>
      ) : owed === 0 ? (
        <p className="small muted">Paid in full.</p>
      ) : (
        <form className="stack-lg" onSubmit={ask} noValidate>
          <div className="field">
            <label htmlFor="pay-amount">Amount received</label>
            <div className="input-group">
              <span>{order.currency}</span>
              <input id="pay-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!error} />
            </div>
          </div>
          {methods.length > 1 && (
            <fieldset className="stack">
              <legend className="label">Method</legend>
              <div className="segmented" role="radiogroup" aria-label="Payment method">
                {methods.map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)}>
                    {m === 'CASH' ? 'Cash' : 'Mobile Money'}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <div className="field">
            <label htmlFor="pay-note">
              Note <span className="optional">· optional</span>
            </label>
            <input id="pay-note" className="input" placeholder="For example the Mobile Money reference" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-secondary">
            Record payment
          </button>
          <span className="hint">For your records only. Money is never taken through the system.</span>
        </form>
      )}

      <ConfirmDialog
        open={confirming}
        title={`Record ${money(value || 0)} as ${completes ? 'paid in full' : order.amountPaid > 0 ? 'a payment' : 'a deposit'}?`}
        confirmLabel="Record payment"
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          const result = await recordPayment(order.id, { amount: value, method, note: note.trim() }).catch((e: unknown) => {
            onConflict(e)
            throw e
          })
          setNote('')
          const left = result.total != null ? result.total - result.amountPaid : null
          setAmount(left ? String(left) : '')
          onChange(result, `${money(value)} recorded. ${order.customer.name ?? 'The customer'} gets a notification.`)
        }}
      >
        <dl className="dl-rows">
          <dt>Order</dt>
          <dd>
            {orderTitle(order)}, {orderRef(order)}
          </dd>
          <dt>Method</dt>
          <dd>{method === 'CASH' ? 'Cash' : 'Mobile Money'}</dd>
          {order.amountPaid > 0 && (
            <>
              <dt>Already paid</dt>
              <dd>{money(order.amountPaid)}</dd>
            </>
          )}
          <dt>This payment</dt>
          <dd className="strong">{money(value || 0)}</dd>
        </dl>
        <p>The customer gets a notification with the amount. You can remove it later if it was a mistake.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={removing !== null}
        title={`Remove the ${removing ? money(removing.amount) : ''} payment?`}
        confirmLabel="Remove payment"
        tone="danger"
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return
          onChange(await removePayment(order.id, removing.id), 'Payment removed.')
        }}
      >
        <p>Only do this if it was entered by mistake. The amount owed goes back up.</p>
      </ConfirmDialog>
    </section>
  )
}

const CANCEL_REASONS = ["We're fully booked that day", "We can't make this design", 'The customer asked us to cancel', 'Something else']

function CancelDialog({
  open,
  order,
  onClose,
  onCancelled,
  onConflict,
}: {
  open: boolean
  order: Order
  onClose: () => void
  onCancelled: (o: Order) => void
  onConflict: (e: unknown) => void
}) {
  const [reason, setReason] = useState(CANCEL_REASONS[0]!)
  const [other, setOther] = useState('')
  const name = order.customer.name ?? 'The customer'

  return (
    <ConfirmDialog
      open={open}
      title={`Cancel ${order.customer.name ? `${order.customer.name}'s` : 'this'} ${orderTitle(order).toLowerCase()}?`}
      confirmLabel="Cancel order"
      cancelLabel="Keep order"
      tone="danger"
      onClose={onClose}
      onConfirm={async () => {
        const text = reason === 'Something else' ? other.trim() : reason
        if (!text) throw new Error('Tell the customer why')
        const result = await cancelOrder(order.id, text).catch((e: unknown) => {
          onConflict(e)
          throw e
        })
        onCancelled(result)
      }}
    >
      <p>{name} gets a notification straight away. You can't undo this.</p>
      {order.amountPaid > 0 && (
        <p className="strong">
          {name} has paid {formatMoney(order.amountPaid, order.currency)}. Arrange the refund with them directly; the payment records stay on the order.
        </p>
      )}
      <div className="field">
        <label htmlFor="cancel-reason">Reason, shown to the customer</label>
        <select id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
          {CANCEL_REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
      {reason === 'Something else' && (
        <div className="field">
          <label htmlFor="cancel-other">Your reason</label>
          <input id="cancel-other" className="input" value={other} onChange={(e) => setOther(e.target.value)} />
        </div>
      )}
    </ConfirmDialog>
  )
}
