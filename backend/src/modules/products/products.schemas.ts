import { z } from "zod";
import { Amount, ImageUrl } from "../../lib/validation.js";

// Keep in sync with the ProductCategory enum in prisma/schema.prisma.
export const PRODUCT_CATEGORIES = ["CAKE", "CUPCAKE", "BREAD", "PASTRY", "COOKIE", "EXTRA"] as const;

// No defaults here, so PATCH only changes what it is sent.
const ProductFields = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(1000).nullable(),
  category: z.enum(PRODUCT_CATEGORIES),
  price: Amount,
  imageUrl: ImageUrl.nullable(),
  sizeLabel: z.string().max(40).nullable(),
  serves: z.number().int().positive().nullable(),
  leadTimeDays: z.number().int().min(0).max(60),
  customisable: z.boolean(),
  isActive: z.boolean(),
});

export const ProductInput = ProductFields.extend({
  description: ProductFields.shape.description.optional(),
  imageUrl: ProductFields.shape.imageUrl.optional(),
  sizeLabel: ProductFields.shape.sizeLabel.optional(),
  serves: ProductFields.shape.serves.optional(),
  leadTimeDays: ProductFields.shape.leadTimeDays.default(1),
  customisable: ProductFields.shape.customisable.default(false),
  isActive: ProductFields.shape.isActive.default(true),
});
export const ProductUpdate = ProductFields.partial();

export const ProductsQuery = z.object({
  category: z.enum(PRODUCT_CATEGORIES).optional(),
  // Staff only: include hidden products.
  all: z.enum(["true", "false"]).optional(),
});
