import { z } from "zod";
import { isDayKey } from "../../lib/dates.js";
import { Amount, PositiveAmount, UploadUrl } from "../../lib/validation.js";

// Keep these lists in sync with the enums in prisma/schema.prisma.
export const ORDER_STATUSES = ["SUBMITTED", "QUOTED", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"] as const;
export const PAYMENT_METHODS = ["CASH", "MOBILE_MONEY"] as const;

const OrderItemInput = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().max(500).default(1),
});

// Most design fields are optional: a customer who is unsure can leave them to the bakery.
export const CreateOrderInput = z.object({
  bakeryId: z.string().min(1),
  // A random id made by the app for this submission. Sending the same one again
  // returns the first order instead of creating a duplicate.
  clientRequestId: z.string().min(8).max(100).optional(),
  type: z.enum(["STANDARD", "CUSTOM", "BULK"]),
  occasion: z.string().trim().max(100).optional(),
  flavour: z.string().trim().max(100).optional(),
  icing: z.string().trim().max(100).optional(),
  size: z.string().trim().max(50).optional(),
  colours: z.string().trim().max(200).optional(),
  theme: z.string().trim().max(200).optional(),
  inscription: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  budget: Amount.optional(),
  dueDate: z.coerce.date(),
  fulfilment: z.enum(["PICKUP", "DELIVERY"]),
  deliveryArea: z.string().trim().max(80).optional(),
  deliveryAddress: z.string().trim().max(300).optional(),
  items: z.array(OrderItemInput).max(50).default([]),
  // Builder choices, from GET /bakeries/:bakeryId/builder.
  optionIds: z.array(z.string().min(1)).max(50).default([]),
  // Links from POST /uploads.
  designImageUrl: UploadUrl.optional(),
  inspirationImageUrls: z.array(UploadUrl).max(5).default([]),
});
export type CreateOrderInput = z.infer<typeof CreateOrderInput>;

export const UpdateStatusInput = z.object({
  status: z.enum(ORDER_STATUSES),
});

export const CreateQuotationInput = z.object({
  amount: PositiveAmount,
  note: z.string().trim().max(1000).optional(),
});

// The quote the customer saw, so a newer quote isn't accepted by mistake.
export const AcceptQuoteInput = z.object({
  quotationId: z.string().min(1),
});

export const CancelInput = z.object({
  reason: z.string().trim().max(300).optional(),
});

export const PaymentInput = z.object({
  amount: PositiveAmount,
  method: z.enum(PAYMENT_METHODS),
  note: z.string().trim().max(300).optional(),
});
export type PaymentInput = z.infer<typeof PaymentInput>;

export const CreateCommentInput = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const ListOrdersQuery = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
});

const DayKey = z.string().refine(isDayKey, "Use a real date written as YYYY-MM-DD");

export const BakeryOrdersQuery = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  // Due date range, inclusive, in the bakery's timezone.
  from: DayKey.optional(),
  to: DayKey.optional(),
  // Customer name or phone, or an order number such as BK1042.
  q: z.string().trim().min(1).max(80).optional(),
});
export type BakeryOrdersQuery = z.infer<typeof BakeryOrdersQuery>;
