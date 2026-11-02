import { notifyBakery, notifyUser } from "../lib/notifications.js";
import { prisma } from "../lib/prisma.js";
import { expiryReason } from "../modules/orders/order-rules.js";

const HOUR_MS = 60 * 60 * 1000;

// Cancels orders nobody moved on: quotes the customer never answered, and orders still
// waiting on their due date. Frees the day's custom-cake slot for someone else.
export async function runOrderExpiryCheck(now: Date = new Date()) {
  const candidates = await prisma.order.findMany({
    where: { status: { in: ["SUBMITTED", "QUOTED"] } },
    select: {
      id: true,
      number: true,
      status: true,
      dueDate: true,
      bakeryId: true,
      customerId: true,
      bakery: { select: { name: true, quoteExpiryDays: true } },
      quotations: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });

  let cancelled = 0;
  for (const order of candidates) {
    const reason = expiryReason(
      { status: order.status, dueDate: order.dueDate, latestQuoteAt: order.quotations[0]?.createdAt ?? null },
      order.bakery.quoteExpiryDays,
      now,
    );
    if (!reason) continue;
    // Only if nobody changed it since it was read, e.g. the customer accepting at the last minute.
    const { count } = await prisma.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: "CANCELLED", cancelledBy: "SYSTEM", cancelReason: reason },
    });
    if (!count) continue;
    cancelled += 1;
    const notification = { title: `Order BK${order.number} cancelled`, body: reason, orderId: order.id };
    void notifyUser(order.customerId, notification);
    void notifyBakery(order.bakeryId, notification);
  }
  return cancelled;
}

export function startOrderExpiryJob() {
  const run = () =>
    void runOrderExpiryCheck().catch((error) => {
      console.error("Order expiry job failed", error);
    });
  run();
  return setInterval(run, HOUR_MS);
}
