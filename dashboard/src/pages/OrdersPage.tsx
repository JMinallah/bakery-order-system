import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getOrdersSummary, listBakeryOrders } from '../api/orders'
import { Icon } from '../components/Icon'
import { PaymentBadge, StatusBadge } from '../components/StatusBadge'
import { useBakery } from '../context/bakery-context'
import { useAsync } from '../hooks/useAsync'
import { dueHint, formatDay, formatMoney, formatTime } from '../lib/format'
import { needsAttention, orderTitle, STATUS_LABELS, TYPE_LABELS, waitingFor } from '../lib/order-flow'
import { ORDER_STATUSES, type OrderStatus, type OrderSummary } from '../types/api'

type Tab = OrderStatus | 'ALL' | 'ATTENTION'

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

export function OrdersPage() {
  // newOrders changes when the background check finds new orders, which reloads the list.
  const { bakery, newOrders } = useBakery()
  const [tab, setTab] = useState<Tab>('ALL')
  const [search, setSearch] = useState('')
  const q = useDebounced(search.trim(), 300)

  const status = tab === 'ALL' || tab === 'ATTENTION' ? undefined : tab
  const orders = useAsync(() => listBakeryOrders(bakery.id, { status, q: q || undefined }), [bakery.id, status, q, newOrders])
  const summary = useAsync(() => getOrdersSummary(bakery.id), [bakery.id, newOrders])

  const rows = useMemo(
    () => (tab === 'ATTENTION' ? (orders.data ?? []).filter((o) => needsAttention(o)) : (orders.data ?? [])),
    [orders.data, tab],
  )
  const counts = summary.data?.counts ?? {}
  const total = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0)
  const attention = summary.data?.needsAttention ?? 0

  return (
    <>
      <div className="page-header">
        <div className="stack">
          <h1>Orders</h1>
          <p>Soonest due first. Times are in {bakery.timezone.replace('_', ' ')}.</p>
        </div>
        <div className="input-group" style={{ width: 'min(320px, 100%)' }}>
          <Icon name="search" size={18} />
          <label htmlFor="order-search" className="visually-hidden">
            Search orders
          </label>
          <input id="order-search" type="search" placeholder="Customer, phone or BK number" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {attention > 0 && tab !== 'ATTENTION' && (
        <div className="alert" role="alert">
          <Icon name="clock" size={22} />
          <span>
            <strong>
              {attention} {attention === 1 ? 'order is' : 'orders are'} due within 48 hours
            </strong>{' '}
            and {attention === 1 ? "hasn't" : "haven't"} been updated since yesterday.
          </span>
          <button type="button" className="btn btn-sm" onClick={() => setTab('ATTENTION')}>
            Show {attention === 1 ? 'it' : 'them'}
          </button>
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="Filter by status">
        <TabButton tab="ALL" current={tab} onSelect={setTab} label="All" count={total} />
        {tab === 'ATTENTION' && <TabButton tab="ATTENTION" current={tab} onSelect={setTab} label="Due soon, untouched" count={rows.length} />}
        {ORDER_STATUSES.map((s) => (
          <TabButton key={s} tab={s} current={tab} onSelect={setTab} label={STATUS_LABELS[s]} count={counts[s] ?? 0} />
        ))}
      </div>

      {orders.error && <p className="form-error">{orders.error}</p>}
      {orders.loading && !orders.data && <p className="loading">Loading orders…</p>}
      {orders.data && rows.length === 0 && (
        <div className="empty">
          <h2>{q ? 'No orders match that search' : 'Nothing here right now'}</h2>
          <p>{q ? 'Try part of the customer’s name, their phone number, or an order number like BK1043.' : 'New orders from the app appear here as soon as they are placed.'}</p>
        </div>
      )}
      {rows.length > 0 && <OrdersTable orders={rows} />}
    </>
  )
}

function TabButton({ tab, current, onSelect, label, count }: { tab: Tab; current: Tab; onSelect: (t: Tab) => void; label: string; count: number }) {
  return (
    <button type="button" role="tab" aria-selected={tab === current} onClick={() => onSelect(tab)}>
      {label} <span className="count">{count}</span>
    </button>
  )
}

function OrdersTable({ orders }: { orders: OrderSummary[] }) {
  const { bakery } = useBakery()
  const tz = bakery.timezone

  return (
    <div className="table-wrap">
      <table className="table table-stack-wide" style={{ minWidth: 860 }}>
        <thead>
          <tr>
            <th scope="col">Due</th>
            <th scope="col">Customer</th>
            <th scope="col">Order</th>
            <th scope="col">Status</th>
            <th scope="col">Payment</th>
            <th scope="col" className="right">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const hint = dueHint(o.dueDate, tz)
            const soon = hint === 'Today' || hint === 'Tomorrow' || hint.endsWith('late')
            return (
              <tr key={o.id} className={o.status === 'CANCELLED' ? 'row-muted' : undefined}>
                <td data-label="Due" className="nowrap">
                  <Link to={`/orders/${o.id}`} className="strong" style={{ color: 'var(--ink)' }}>
                    {formatDay(o.dueDate, tz)}
                  </Link>
                  <div className="sub" style={soon ? { color: 'var(--warn)', fontWeight: 600 } : undefined}>
                    {[formatTime(o.dueDate, tz), hint].filter(Boolean).join(' · ')}
                  </div>
                </td>
                <td data-label="Customer">
                  <div>{o.customer.name ?? 'Customer'}</div>
                  <div className="sub">{o.customer.phone ?? o.customer.email ?? ''}</div>
                </td>
                <td data-label="Order">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600 }}>{orderTitle(o)}</span>
                    {o.designImageUrl && (
                      <span
                        title="Includes custom cake design / AI concept"
                        style={{
                          fontSize: 11,
                          padding: '1px 6px',
                          borderRadius: 6,
                          background: 'var(--accent-soft)',
                          color: 'var(--accent)',
                          fontWeight: 700,
                        }}
                      >
                        ✨ Design
                      </span>
                    )}
                  </div>
                  <div className="sub">
                    BK{o.number} · {TYPE_LABELS[o.type]} · {o.fulfilment === 'PICKUP' ? 'Pickup' : `Delivery, ${o.deliveryArea ?? ''}`}
                  </div>
                </td>
                <td data-label="Status">
                  <StatusBadge status={o.status} />
                  <div className="sub order-next-action">{waitingFor(o) ?? (o.status === 'SUBMITTED' ? 'Review and quote' : o.status === 'READY' ? 'Arrange collection' : 'No action needed')}</div>
                </td>
                <td data-label="Payment">
                  <PaymentBadge status={o.paymentStatus} />
                </td>
                <td data-label="Total" className="right nowrap">
                  {o.total != null ? (
                    formatMoney(o.total, o.currency)
                  ) : o.quotations[0] ? (
                    <>
                      {formatMoney(o.quotations[0].amount, o.currency)}
                      <div className="sub">quoted</div>
                    </>
                  ) : (
                    <span className="muted">Not quoted</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
