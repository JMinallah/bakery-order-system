import { useState } from 'react'
import { Link } from 'react-router-dom'
import { blockDate, getAvailability, listBlockedDates, unblockDate, updateSettings } from '../api/bakeries'
import { listBakeryOrders } from '../api/orders'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Icon } from '../components/Icon'
import { StatusBadge } from '../components/StatusBadge'
import { useBakery } from '../context/bakery-context'
import { useToast } from '../context/toast-context'
import { useAsync } from '../hooks/useAsync'
import { addDays, dayKey, formatDayKey, formatTime, isoWeekday, mondayOf } from '../lib/format'
import { isOpen, needsQuote, orderTitle } from '../lib/order-flow'
import type { CalendarDay, OrderSummary } from '../types/api'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const NOTES: Record<CalendarDay['status'], (d: CalendarDay) => string> = {
  OPEN: (d) => `${d.booked} of ${d.limit} booked`,
  FULL: () => 'Full',
  CLOSED: () => 'Closed',
  BLOCKED: () => 'Blocked by you',
  TOO_SOON: (d) => (d.booked ? `${d.booked} booked, too soon for new` : 'Too soon for new orders'),
}

export function SchedulePage() {
  const { bakery, isOwner, refreshBakery } = useBakery()
  const toast = useToast()
  // Fixed for the visit; the page doesn't need to roll over at midnight.
  const [today] = useState(() => dayKey(new Date(), bakery.timezone))
  const [week, setWeek] = useState(0)
  const from = addDays(mondayOf(today), week * 7)
  const [selected, setSelected] = useState(today)
  const [blocking, setBlocking] = useState(false)
  const [reason, setReason] = useState('')

  const calendar = useAsync(() => getAvailability(bakery.id, from, 14), [bakery.id, from, bakery.customCakesPerDay, bakery.customNoticeDays, bakery.closedWeekdays.join()])
  const blocked = useAsync(() => listBlockedDates(bakery.id), [bakery.id])
  const dayOrders = useAsync(
    () => listBakeryOrders(bakery.id, { from: selected, to: selected }).then((list) => list.filter((o) => dayKey(new Date(o.dueDate), bakery.timezone) === selected && o.status !== 'CANCELLED')),
    [bakery.id, selected],
  )

  const day = calendar.data?.find((d) => d.date === selected)
  const blockedRow = blocked.data?.find((b) => b.date.slice(0, 10) === selected)
  const refresh = () => {
    calendar.reload()
    blocked.reload()
  }

  const unblock = async () => {
    if (!blockedRow) return
    try {
      await unblockDate(bakery.id, blockedRow.id)
      refresh()
      toast(`${formatDayKey(selected)} is open for orders again.`)
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="stack">
          <h1>Schedule</h1>
          <p>How many custom cakes you can take each day. Customers can't pick days that are full or closed.</p>
        </div>
      </div>

      <div className="split">
        <div className="split-main">
          <div className="stack-lg">
            <div className="row-between">
              <h2 style={{ fontFamily: 'var(--font-body)', fontSize: 18 }}>
                {formatDayKey(from)} to {formatDayKey(addDays(from, 13))}
              </h2>
              <div className="row" style={{ gap: 6 }}>
                <button type="button" className="btn btn-sm btn-outline" aria-label="Earlier weeks" onClick={() => setWeek((w) => w - 2)} disabled={week <= 0}>
                  <Icon name="prev" size={18} />
                </button>
                {week !== 0 && (
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => setWeek(0)}>
                    This week
                  </button>
                )}
                <button type="button" className="btn btn-sm btn-outline" aria-label="Later weeks" onClick={() => setWeek((w) => w + 2)}>
                  <Icon name="next" size={18} />
                </button>
              </div>
            </div>

            {calendar.error && <p className="form-error">{calendar.error}</p>}
            <div className="table-wrap">
              <div className="calendar">
                {(calendar.data ?? []).map((d) => {
                  const open = d.status === 'OPEN' || d.status === 'FULL' || d.status === 'TOO_SOON'
                  return (
                    <button
                      key={d.date}
                      type="button"
                      aria-pressed={d.date === selected}
                      aria-label={`${formatDayKey(d.date)}, ${NOTES[d.status](d)}`}
                      className={open ? undefined : 'unavailable'}
                      onClick={() => setSelected(d.date)}
                    >
                      <span className="dow">{WEEKDAYS[isoWeekday(d.date) - 1]!.slice(0, 3)}</span>
                      <span className="num">{Number(d.date.slice(8))}</span>
                      {open && (
                        <span className={`slots ${d.status === 'FULL' ? 'full' : ''}`} aria-hidden="true">
                          {Array.from({ length: Math.max(d.limit, d.booked) }, (_, i) => (
                            <span key={i} className={i < d.booked ? 'taken' : undefined} />
                          ))}
                        </span>
                      )}
                      <span className={`note ${d.status === 'FULL' ? 'full' : ''}`}>{d.date === today ? `Today · ${NOTES[d.status](d)}` : NOTES[d.status](d)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <section className="stack-lg" aria-labelledby="day-h">
            <div className="row-between">
              <h2 id="day-h" style={{ fontFamily: 'var(--font-body)', fontSize: 18 }}>
                {formatDayKey(selected)}
                {day ? `, ${NOTES[day.status](day).toLowerCase()}` : ''}
              </h2>
              {day?.status === 'BLOCKED' && blockedRow ? (
                <button type="button" className="btn btn-sm btn-outline" onClick={unblock}>
                  Open this day again
                </button>
              ) : day && day.status !== 'CLOSED' && selected >= today ? (
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setBlocking(true)}>
                  Block this day
                </button>
              ) : null}
            </div>
            {blockedRow?.reason && <p className="muted">Blocked: {blockedRow.reason}</p>}
            {dayOrders.data && dayOrders.data.length === 0 && <p className="muted">No orders due this day.</p>}
            {dayOrders.data && dayOrders.data.length > 0 && (
              <ul className="list">
                {dayOrders.data.map((o) => (
                  <li key={o.id}>
                    <Link to={`/orders/${o.id}`} className="row" style={{ textDecoration: 'none', color: 'var(--ink)', gap: 16 }}>
                      <span style={{ width: 80 }} className="muted">
                        {formatTime(o.dueDate, bakery.timezone)}
                      </span>
                      <span className="strong" style={{ flex: 1 }}>
                        {orderTitle(o)}
                        {!needsQuote(o.type) && <span className="muted small"> · ready made, doesn't use a slot</span>}
                      </span>
                      <span className="muted">{o.customer.name}</span>
                      <StatusBadge status={o.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="split-side">
          <LimitsForm
            key={`${bakery.customCakesPerDay}:${bakery.customNoticeDays}:${bakery.closedWeekdays.join()}`}
            editable={isOwner}
            today={today}
            onSaved={() => {
              refreshBakery()
              toast('Limits saved. New orders follow them straight away.')
            }}
          />
        </div>
      </div>

      <ConfirmDialog
        open={blocking}
        title={`Block ${formatDayKey(selected)}?`}
        confirmLabel="Block this day"
        onClose={() => {
          setBlocking(false)
          setReason('')
        }}
        onConfirm={async () => {
          await blockDate(bakery.id, selected, reason.trim())
          refresh()
          toast(`${formatDayKey(selected)} is blocked. Customers can't pick it.`)
        }}
      >
        <p>Customers won't be able to choose this day for new orders.</p>
        <AffectedOrders orders={(dayOrders.data ?? []).filter((o) => isOpen(o.status))} />
        <div className="field">
          <label htmlFor="block-reason">
            Reason <span className="optional">· only staff see it</span>
          </label>
          <input id="block-reason" className="input" placeholder="For example Staff training" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </ConfirmDialog>
    </>
  )
}

function LimitsForm({ editable, today, onSaved }: { editable: boolean; today: string; onSaved: () => void }) {
  const { bakery } = useBakery()
  const [perDay, setPerDay] = useState(bakery.customCakesPerDay)
  const [notice, setNotice] = useState(bakery.customNoticeDays)
  const [closed, setClosed] = useState<number[]>(bakery.closedWeekdays)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Open orders due on a weekday that is about to close, shown before saving.
  const [affected, setAffected] = useState<OrderSummary[] | null>(null)

  const dirty = perDay !== bakery.customCakesPerDay || notice !== bakery.customNoticeDays || closed.join() !== bakery.closedWeekdays.join()
  const toggle = (day: number) => setClosed((list) => (list.includes(day) ? list.filter((d) => d !== day) : [...list, day].sort()))

  const saveLimits = async () => {
    await updateSettings(bakery.id, { customCakesPerDay: perDay, customNoticeDays: notice, closedWeekdays: closed })
    onSaved()
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const closing = closed.filter((d) => !bakery.closedWeekdays.includes(d))
      if (closing.length) {
        const upcoming = await listBakeryOrders(bakery.id, { from: today })
        const hit = upcoming.filter((o) => isOpen(o.status) && closing.includes(isoWeekday(dayKey(new Date(o.dueDate), bakery.timezone))))
        if (hit.length) {
          setAffected(hit)
          return
        }
      }
      await saveLimits()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="panel">
      <h2>Your limits</h2>
      {!editable && <p className="small muted">Only the bakery owner can change these.</p>}
      <div className="row-between">
        <span id="per-day" className="strong">
          Custom cakes per day
        </span>
        <div className="stepper" role="group" aria-labelledby="per-day">
          <button type="button" aria-label="One fewer" disabled={!editable || perDay <= 0} onClick={() => setPerDay((n) => n - 1)}>
            −
          </button>
          <output aria-live="polite">{perDay}</output>
          <button type="button" aria-label="One more" disabled={!editable} onClick={() => setPerDay((n) => n + 1)}>
            +
          </button>
        </div>
      </div>
      <div className="stack">
        <div className="row-between">
          <span id="notice" className="strong">
            Days of notice for custom cakes
          </span>
          <div className="stepper" role="group" aria-labelledby="notice">
            <button type="button" aria-label="One day less" disabled={!editable || notice <= 0} onClick={() => setNotice((n) => n - 1)}>
              −
            </button>
            <output aria-live="polite">{notice}</output>
            <button type="button" aria-label="One day more" disabled={!editable} onClick={() => setNotice((n) => n + 1)}>
              +
            </button>
          </div>
        </div>
        <span className="hint">Today that means the earliest is {formatDayKey(addDays(today, notice))}.</span>
      </div>
      <fieldset className="stack">
        <legend className="label strong" style={{ marginBottom: 8 }}>
          Closed on
        </legend>
        <div className="weekdays">
          {WEEKDAYS.map((name, i) => (
            <button key={name} type="button" aria-pressed={closed.includes(i + 1)} aria-label={name} disabled={!editable} onClick={() => toggle(i + 1)}>
              {name.slice(0, 2)}
            </button>
          ))}
        </div>
      </fieldset>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {editable && (
        <div className="stack" style={{ paddingTop: 16, borderTop: '1px solid var(--line)' }}>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty || saving}>
            {saving ? 'Saving…' : 'Save limits'}
          </button>
          <span className="hint">New limits apply to new orders. Orders you already accepted stay booked.</span>
        </div>
      )}

      <ConfirmDialog
        open={affected !== null}
        title="Close on those days anyway?"
        confirmLabel="Save limits"
        onClose={() => setAffected(null)}
        onConfirm={saveLimits}
      >
        <p>Customers won't be able to pick these weekdays for new orders.</p>
        <AffectedOrders orders={affected ?? []} withDay />
      </ConfirmDialog>
    </div>
  )
}

// Orders already booked on a day the bakery is about to close.
function AffectedOrders({ orders, withDay }: { orders: OrderSummary[]; withDay?: boolean }) {
  const { bakery } = useBakery()
  if (!orders.length) return null
  return (
    <div className="stack">
      <p className="strong">
        {orders.length === 1 ? 'This order is' : `These ${orders.length} orders are`} already due then and stay booked. Contact the{' '}
        {orders.length === 1 ? 'customer' : 'customers'} if you can't make {orders.length === 1 ? 'it' : 'them'}:
      </p>
      <ul className="list">
        {orders.map((o) => (
          <li key={o.id} className="row-between">
            <Link to={`/orders/${o.id}`}>
              {orderTitle(o)} for {o.customer.name ?? 'a customer'}
            </Link>
            <span className="muted small">
              {withDay ? `${formatDayKey(dayKey(new Date(o.dueDate), bakery.timezone))}, ` : ''}
              {formatTime(o.dueDate, bakery.timezone)}
              {o.customer.phone ? ` · ${o.customer.phone}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
