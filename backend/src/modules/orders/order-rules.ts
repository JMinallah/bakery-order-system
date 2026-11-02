import type { OrderStatus, OrderType, PaymentStatus } from "../../lib/prisma.js";

// Pure rules for how an order moves through its life, kept apart from the database
// so they are easy to test.
//
//   STANDARD:      SUBMITTED → CONFIRMED (by staff) → PREPARING → READY → COMPLETED
//   CUSTOM, BULK:  SUBMITTED → QUOTED (staff send a quote) → CONFIRMED (customer accepts) → ...
//   Any open order can be CANCELLED; customers only until the bakery starts making it.
//   Unanswered quotes and orders still unconfirmed on their due date are cancelled by the system.

const label = (status: OrderStatus) => status.toLowerCase();

// The single step staff may take from each status with the status endpoint.
const NEXT_BY_STAFF: Partial<Record<OrderStatus, OrderStatus>> = {
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
  READY: "COMPLETED",
};

// Why staff can't move the order to `to`, or null when they can.
export function staffStatusError(order: { status: OrderStatus; type: OrderType }, to: OrderStatus): string | null {
  if (order.status === to) return `The order is already ${label(to)}`;
  if (to === "CANCELLED") return "Use cancel instead, so the customer is told why";
  if (to === "QUOTED") return "Send a quote instead";
  if (order.status === "SUBMITTED" && to === "CONFIRMED") {
    return order.type === "STANDARD" ? null : "Custom and bulk orders are confirmed when the customer accepts your quote";
  }
  if (NEXT_BY_STAFF[order.status] === to) return null;
  return `An order that is ${label(order.status)} can't be moved to ${label(to)}`;
}

const FINISHED: OrderStatus[] = ["COMPLETED", "CANCELLED"];
const CUSTOMER_CAN_CANCEL: OrderStatus[] = ["SUBMITTED", "QUOTED", "CONFIRMED"];

export function cancelError(status: OrderStatus, by: "CUSTOMER" | "BAKERY"): string | null {
  if (FINISHED.includes(status)) return `The order is already ${label(status)}`;
  if (by === "CUSTOMER" && !CUSTOMER_CAN_CANCEL.includes(status)) {
    return "The bakery has already started on this order. Please call them to cancel";
  }
  return null;
}

// Why staff can't send a quote, or null when they can.
export function quoteError(order: { status: OrderStatus; type: OrderType }): string | null {
  if (order.type === "STANDARD") return "Ready-made orders have a fixed price, so they don't need a quote";
  if (order.status !== "SUBMITTED" && order.status !== "QUOTED") return "Quotes can only be sent before the order is confirmed";
  return null;
}

// A deposit is often paid to hold the date while the customer decides on the quote.
export const canRecordPayment = (status: OrderStatus) =>
  status === "QUOTED" || status === "CONFIRMED" || status === "PREPARING" || status === "READY" || status === "COMPLETED";

const DAY_MS = 24 * 3600_000;

// When an unanswered quote stops holding the order's day.
export const quoteExpiresAt = (sentAt: Date, expiryDays: number) => new Date(sentAt.getTime() + expiryDays * DAY_MS);

// Why the system closes an order that nobody moved on, or null to leave it open.
export function expiryReason(
  order: { status: OrderStatus; dueDate: Date; latestQuoteAt: Date | null },
  quoteExpiryDays: number,
  now: Date,
): string | null {
  if (order.status !== "SUBMITTED" && order.status !== "QUOTED") return null;
  if (order.dueDate <= now) return "The due date passed before the order was confirmed";
  if (order.status === "QUOTED" && order.latestQuoteAt && quoteExpiresAt(order.latestQuoteAt, quoteExpiryDays) <= now) {
    return "The quote expired before it was accepted";
  }
  return null;
}

export function paymentStatusFor(total: number | null, paid: number): PaymentStatus {
  if (paid <= 0) return "UNPAID";
  if (total !== null && paid >= total) return "PAID";
  return "DEPOSIT_PAID";
}

// Orders that may still need the bakery's attention before they are due.
export const OPEN_STATUSES: OrderStatus[] = ["SUBMITTED", "QUOTED", "CONFIRMED", "PREPARING"];
