import { prisma } from "../lib/prisma.js";
import { notifyBakery } from "../lib/notifications.js";
import { OPEN_STATUSES } from "../modules/orders/order-rules.js";

const HOUR_MS = 60 * 60 * 1000;
const STALE_ORDER_MS = 24 * HOUR_MS;
const REMINDER_WINDOW_MS = 48 * HOUR_MS;
const REMINDER_INTERVAL_MS = HOUR_MS;

export function orderNeedsDeadlineReminder(
  order: { status: string; dueDate: Date | string; updatedAt: Date | string; lastReminderAt?: Date | string | null },
  now: Date = new Date(),
) {
  if (!OPEN_STATUSES.includes(order.status as (typeof OPEN_STATUSES)[number])) return false;

  const dueDate = new Date(order.dueDate).getTime();
  const updatedAt = new Date(order.updatedAt).getTime();
  const lastReminderAt = order.lastReminderAt ? new Date(order.lastReminderAt).getTime() : null;
  const nowMs = now.getTime();

  if (dueDate <= nowMs || dueDate > nowMs + REMINDER_WINDOW_MS) return false;
  if (updatedAt > nowMs - STALE_ORDER_MS) return false;
  if (lastReminderAt !== null && lastReminderAt > nowMs - STALE_ORDER_MS) return false;

  return true;
}

export async function runDeadlineReminderCheck(now: Date = new Date()) {
  const nowMs = now.getTime();
  const candidates = await prisma.order.findMany({
    where: {
      status: { in: OPEN_STATUSES },
      dueDate: { gt: now, lt: new Date(nowMs + REMINDER_WINDOW_MS) },
      updatedAt: { lt: new Date(nowMs - STALE_ORDER_MS) },
      OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: new Date(nowMs - STALE_ORDER_MS) } }],
    },
    select: { id: true, bakeryId: true, number: true },
    orderBy: { dueDate: "asc" },
  });

  if (!candidates.length) return 0;

  const byBakery = new Map<string, string[]>();
  for (const order of candidates) {
    const ids = byBakery.get(order.bakeryId) ?? [];
    ids.push(order.id);
    byBakery.set(order.bakeryId, ids);
  }

  let sent = 0;
  for (const [bakeryId, orderIds] of byBakery) {
    const firstOrder = candidates.find((candidate) => candidate.bakeryId === bakeryId)!;
    const count = orderIds.length;
    const body = count === 1 ? `BK${firstOrder.number} needs attention soon.` : `${count} orders need attention soon.`;

    try {
      await notifyBakery(bakeryId, {
        title: "Orders due soon",
        body,
        orderId: firstOrder.id,
      });
      sent += 1;
    } finally {
      // Raw SQL so updatedAt stays put: a reminder is not someone looking after the order,
      // and the dashboard's "needs attention" count goes by updatedAt.
      await prisma.$executeRaw`UPDATE "Order" SET "lastReminderAt" = ${now} WHERE id = ANY(${orderIds})`;
    }
  }

  return sent;
}

export function startDeadlineReminderJob() {
  void runDeadlineReminderCheck().catch((error) => {
    console.error("Deadline reminder job failed", error);
  });

  return setInterval(() => {
    void runDeadlineReminderCheck().catch((error) => {
      console.error("Deadline reminder job failed", error);
    });
  }, REMINDER_INTERVAL_MS);
}
