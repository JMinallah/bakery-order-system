import { z } from "zod";

export const BakeryApplicationInput = z.object({
  bakeryName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  phone: z.string().trim().min(5).max(30),
  city: z.string().trim().min(2).max(80),
  notes: z.string().trim().max(1000).optional(),
});

// Approval happens through onboarding, which creates the bakery.
export const BakeryApplicationStatusUpdate = z.object({
  status: z.enum(["PENDING", "CONTACTED", "DECLINED"]),
});

export type BakeryApplicationInput = z.infer<typeof BakeryApplicationInput>;
