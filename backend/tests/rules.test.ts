import { describe, expect, it } from "vitest";
import { addDays, dayKey, isDayKey, isoWeekday } from "../src/lib/dates.js";
import { orderNeedsDeadlineReminder } from "../src/jobs/deadline-reminders.js";
import { buildCalendar, dayStatus, type CapacityRules } from "../src/modules/bakeries/availability.js";
import { isAvailable, resolveSelections, type BuilderGroup } from "../src/modules/builder/selection.js";
import { uploadIdFrom } from "../src/lib/validation.js";
import {
  canRecordPayment,
  cancelError,
  expiryReason,
  paymentStatusFor,
  quoteError,
  staffStatusError,
} from "../src/modules/orders/order-rules.js";
import { stockLevel } from "../src/modules/stock/stock-level.js";
import { detectImageType } from "../src/modules/uploads/image-type.js";

// Pure business rules; no database needed.

describe("dates", () => {
  it("puts a late evening order on the bakery's local day", () => {
    // 21:30 UTC is 00:30 the next day in Kampala (UTC+3).
    expect(dayKey(new Date("2026-11-06T21:30:00Z"), "Africa/Kampala")).toBe("2026-11-07");
    expect(dayKey(new Date("2026-11-06T20:30:00Z"), "Africa/Kampala")).toBe("2026-11-06");
  });

  it("knows the weekday and moves across months", () => {
    expect(isoWeekday("2026-11-01")).toBe(7); // a Sunday
    expect(isoWeekday("2026-11-02")).toBe(1);
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
  });

  it("rejects dates that don't exist", () => {
    expect(isDayKey("2026-02-28")).toBe(true);
    expect(isDayKey("2026-02-30")).toBe(false);
    expect(isDayKey("7/11/2026")).toBe(false);
  });
});

describe("capacity", () => {
  const rules: CapacityRules = { customCakesPerDay: 2, noticeDays: 3, closedWeekdays: [7] };
  const today = "2026-10-16"; // a Friday

  it("explains why a day can't be picked", () => {
    expect(dayStatus("2026-10-18", today, rules, 0, false)).toBe("CLOSED"); // Sunday
    expect(dayStatus("2026-10-17", today, rules, 0, false)).toBe("TOO_SOON");
    expect(dayStatus("2026-10-20", today, rules, 0, true)).toBe("BLOCKED");
    expect(dayStatus("2026-10-20", today, rules, 2, false)).toBe("FULL");
    expect(dayStatus("2026-10-20", today, rules, 1, false)).toBe("OPEN");
  });

  it("ignores the daily limit for ready-made orders", () => {
    expect(dayStatus("2026-10-20", today, rules, 5, false, false)).toBe("OPEN");
  });

  it("builds a calendar with counts", () => {
    const days = buildCalendar("2026-10-19", 3, today, rules, new Map([["2026-10-20", 2]]), new Set());
    expect(days.map((d) => [d.date, d.status, d.booked])).toEqual([
      ["2026-10-19", "OPEN", 0],
      ["2026-10-20", "FULL", 2],
      ["2026-10-21", "OPEN", 0],
    ]);
  });
});

describe("builder choices", () => {
  const option = (id: string, price: number, extra: Partial<BuilderGroup["options"][number]> = {}) => ({
    id,
    name: id,
    price,
    value: null,
    isActive: true,
    stockItem: null,
    ...extra,
  });
  const groups: BuilderGroup[] = [
    { id: "size", name: "Size", multiple: false, required: true, options: [option("1kg", 60000), option("2kg", 110000)] },
    {
      id: "deco",
      name: "Decorations",
      multiple: true,
      required: false,
      options: [option("pearls", 10000), option("flowers", 15000), option("gold", 20000, { stockItem: { quantity: 0 } })],
    },
  ];

  it("adds up the estimate", () => {
    const { estimate, selections } = resolveSelections(groups, ["2kg", "pearls", "flowers", "pearls"]);
    expect(estimate).toBe(135000);
    expect(selections).toHaveLength(3);
  });

  it("hides options whose stock ran out or that are switched off", () => {
    expect(isAvailable(groups[1]!.options[2]!)).toBe(false);
    expect(isAvailable(option("x", 0, { isActive: false }))).toBe(false);
    expect(() => resolveSelections(groups, ["1kg", "gold"])).toThrow(/no longer available/);
  });

  it("enforces one choice and required groups", () => {
    expect(() => resolveSelections(groups, ["1kg", "2kg"])).toThrow(/only one/);
    expect(() => resolveSelections(groups, ["pearls"])).toThrow(/Size/);
    expect(() => resolveSelections(groups, ["someone-elses-option"])).toThrow(/doesn't belong/);
  });
});

describe("order status rules", () => {
  it("lets staff confirm ready-made orders but not custom ones", () => {
    expect(staffStatusError({ status: "SUBMITTED", type: "STANDARD" }, "CONFIRMED")).toBeNull();
    expect(staffStatusError({ status: "SUBMITTED", type: "CUSTOM" }, "CONFIRMED")).toMatch(/accepts your quote/);
  });

  it("only moves forward one step at a time", () => {
    expect(staffStatusError({ status: "CONFIRMED", type: "CUSTOM" }, "PREPARING")).toBeNull();
    expect(staffStatusError({ status: "CONFIRMED", type: "CUSTOM" }, "READY")).toMatch(/can't be moved/);
    expect(staffStatusError({ status: "READY", type: "STANDARD" }, "COMPLETED")).toBeNull();
    expect(staffStatusError({ status: "PREPARING", type: "STANDARD" }, "CANCELLED")).toMatch(/cancel instead/);
  });

  it("stops customers cancelling once the cake is being made", () => {
    expect(cancelError("CONFIRMED", "CUSTOMER")).toBeNull();
    expect(cancelError("PREPARING", "CUSTOMER")).toMatch(/call them/);
    expect(cancelError("PREPARING", "BAKERY")).toBeNull();
    expect(cancelError("COMPLETED", "BAKERY")).toMatch(/already completed/);
  });

  it("only quotes custom and bulk orders that aren't confirmed yet", () => {
    expect(quoteError({ status: "SUBMITTED", type: "CUSTOM" })).toBeNull();
    expect(quoteError({ status: "QUOTED", type: "BULK" })).toBeNull();
    expect(quoteError({ status: "SUBMITTED", type: "STANDARD" })).toMatch(/fixed price/);
    expect(quoteError({ status: "CONFIRMED", type: "CUSTOM" })).toMatch(/before the order is confirmed/);
  });

  it("records deposits from the moment a quote is sent", () => {
    expect(canRecordPayment("SUBMITTED")).toBe(false);
    expect(canRecordPayment("QUOTED")).toBe(true);
    expect(canRecordPayment("CANCELLED")).toBe(false);
  });

  it("closes unanswered quotes and orders that missed their day", () => {
    const now = new Date("2026-11-09T12:00:00Z");
    const due = new Date("2026-11-20T11:00:00Z");
    const quote = (sent: string) => ({ status: "QUOTED" as const, dueDate: due, latestQuoteAt: new Date(sent) });
    expect(expiryReason(quote("2026-11-05T12:00:00Z"), 7, now)).toBeNull();
    expect(expiryReason(quote("2026-11-01T12:00:00Z"), 7, now)).toMatch(/quote expired/);
    expect(expiryReason({ status: "SUBMITTED", dueDate: new Date("2026-11-09T08:00:00Z"), latestQuoteAt: null }, 7, now)).toMatch(/due date passed/);
    expect(expiryReason({ status: "CONFIRMED", dueDate: new Date("2026-11-09T08:00:00Z"), latestQuoteAt: null }, 7, now)).toBeNull();
  });

  it("works out the payment status", () => {
    expect(paymentStatusFor(165000, 0)).toBe("UNPAID");
    expect(paymentStatusFor(165000, 80000)).toBe("DEPOSIT_PAID");
    expect(paymentStatusFor(165000, 165000)).toBe("PAID");
    expect(paymentStatusFor(null, 50000)).toBe("DEPOSIT_PAID");
  });

  it("flags stale open orders that are due soon for a reminder", () => {
    const now = new Date("2026-11-09T12:00:00Z");
    expect(
      orderNeedsDeadlineReminder(
        {
          status: "CONFIRMED",
          dueDate: new Date("2026-11-10T18:00:00Z"),
          updatedAt: new Date("2026-11-08T10:00:00Z"),
          lastReminderAt: null,
        },
        now,
      ),
    ).toBe(true);

    expect(
      orderNeedsDeadlineReminder(
        {
          status: "READY",
          dueDate: new Date("2026-11-12T18:00:00Z"),
          updatedAt: new Date("2026-11-08T10:00:00Z"),
          lastReminderAt: null,
        },
        now,
      ),
    ).toBe(false);

    expect(
      orderNeedsDeadlineReminder(
        {
          status: "CONFIRMED",
          dueDate: new Date("2026-11-12T18:00:00Z"),
          updatedAt: new Date("2026-11-08T10:00:00Z"),
          lastReminderAt: new Date("2026-11-08T12:00:00Z"),
        },
        now,
      ),
    ).toBe(false);
  });
});

describe("stock levels", () => {
  it("marks low and empty stock", () => {
    expect(stockLevel({ quantity: 0, lowAt: 5 })).toBe("OUT");
    expect(stockLevel({ quantity: 4, lowAt: 5 })).toBe("LOW");
    expect(stockLevel({ quantity: 6, lowAt: 5 })).toBe("OK");
    expect(stockLevel({ quantity: 1, lowAt: null })).toBe("OK");
  });
});

describe("photo uploads", () => {
  it("reads the upload id from links built with any host, and nothing else", () => {
    expect(uploadIdFrom("https://api.example.com/api/uploads/cm3abc_1")).toBe("cm3abc_1");
    expect(uploadIdFrom("http://10.0.2.2:4000/api/uploads/cm3abc")).toBe("cm3abc");
    expect(uploadIdFrom("https://evil.example/cake.jpg")).toBeNull();
    expect(uploadIdFrom("javascript:alert(1)//uploads/abc")).toBeNull();
  });

  it("knows images by their first bytes, not their name", () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(detectImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(detectImageType(new Uint8Array([]))).toBeNull();
  });
});
