import type { OrderBase, OrderStatus, OrderType } from '../types/api'

// How the dashboard talks about an order's life. Matches the rules in
// backend/src/modules/orders/order-rules.ts.

export const STATUS_LABELS: Record<OrderStatus, string> = {
  SUBMITTED: 'New',
  QUOTED: 'Quoted',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY: 'Ready',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export const TYPE_LABELS: Record<OrderType, string> = {
  STANDARD: 'Ready made',
  CUSTOM: 'Custom',
  BULK: 'Bulk',
}

export const needsQuote = (type: OrderType) => type !== 'STANDARD'

// The progress steps shown on an order. Ready made orders skip the quote.
export function stepsFor(type: OrderType): OrderStatus[] {
  return needsQuote(type)
    ? ['SUBMITTED', 'QUOTED', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED']
    : ['SUBMITTED', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED']
}

// The one button that moves the order on, or null when it's waiting on someone else.
export function nextAction(order: Pick<OrderBase, 'status' | 'type' | 'fulfilment'>): { label: string; status: OrderStatus } | null {
  switch (order.status) {
    case 'SUBMITTED':
      return needsQuote(order.type) ? null : { label: 'Confirm order', status: 'CONFIRMED' }
    case 'CONFIRMED':
      return { label: 'Start making it', status: 'PREPARING' }
    case 'PREPARING':
      return { label: 'Mark as ready', status: 'READY' }
    case 'READY':
      return { label: order.fulfilment === 'PICKUP' ? 'Mark as collected' : 'Mark as delivered', status: 'COMPLETED' }
    default:
      return null
  }
}

// A short line under the status saying what happens next.
export function waitingFor(order: Pick<OrderBase, 'status' | 'type'>): string {
  switch (order.status) {
    case 'SUBMITTED':
      return needsQuote(order.type) ? 'Needs a quote' : 'Needs confirming'
    case 'QUOTED':
      return 'Waiting for the customer'
    default:
      return ''
  }
}

export const isOpen = (status: OrderStatus) => status !== 'COMPLETED' && status !== 'CANCELLED'

export const canQuote = (status: OrderStatus) => status === 'SUBMITTED' || status === 'QUOTED'

// A deposit can hold the date while the customer thinks about the quote.
export const canRecordPayment = (status: OrderStatus) =>
  status === 'QUOTED' || status === 'CONFIRMED' || status === 'PREPARING' || status === 'READY' || status === 'COMPLETED'

// When an unanswered quote is cancelled automatically, freeing the day.
export const quoteExpiresAt = (sentAt: string, expiryDays: number) => new Date(new Date(sentAt).getTime() + expiryDays * 24 * 3600_000)

export const CANCELLED_BY_LABELS: Record<NonNullable<OrderBase['cancelledBy']>, string> = {
  CUSTOMER: 'Cancelled by the customer',
  BAKERY: 'Cancelled by the bakery',
  SYSTEM: 'Closed automatically',
}

// Same rule as the backend's needsAttention count: open, due within 48 hours, untouched for a day.
export function needsAttention(order: Pick<OrderBase, 'status' | 'dueDate' | 'updatedAt'>, now = Date.now()) {
  return (
    ['SUBMITTED', 'QUOTED', 'CONFIRMED', 'PREPARING'].includes(order.status) &&
    new Date(order.dueDate).getTime() < now + 48 * 3600_000 &&
    new Date(order.updatedAt).getTime() < now - 24 * 3600_000
  )
}

// A name for the order, e.g. "Birthday cake" or "Red velvet cake".
export function orderTitle(order: Pick<OrderBase, 'occasion' | 'items' | 'type'>) {
  if (order.occasion) return `${order.occasion} cake`
  if (order.items.length === 1) return order.items[0]!.product.name
  if (order.items.length > 1) return `${order.items.length} items`
  return order.type === 'BULK' ? 'Bulk order' : 'Custom cake'
}
