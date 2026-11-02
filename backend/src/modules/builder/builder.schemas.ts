import { z } from "zod";
import { Amount, ImageUrl } from "../../lib/validation.js";
import { PRODUCT_CATEGORIES } from "../products/products.schemas.js";

// Keep in sync with the OptionKind enum in prisma/schema.prisma.
export const OPTION_KINDS = ["SHAPE", "TIERS", "SIZE", "FLAVOUR", "ICING_COLOUR", "DECORATION", "OTHER"] as const;

export const BuilderQuery = z.object({
  category: z.enum(PRODUCT_CATEGORIES).default("CAKE"),
});

// Field rules without defaults: zod applies defaults even inside .partial(), which
// would make a PATCH silently reset fields the caller left out.
const GroupFields = z.object({
  category: z.enum(PRODUCT_CATEGORIES),
  kind: z.enum(OPTION_KINDS),
  name: z.string().trim().min(1).max(60),
  multiple: z.boolean(),
  required: z.boolean(),
  position: z.number().int().min(0),
});

export const OptionGroupInput = GroupFields.extend({
  category: GroupFields.shape.category.default("CAKE"),
  multiple: GroupFields.shape.multiple.default(false),
  required: GroupFields.shape.required.default(false),
  position: GroupFields.shape.position.default(0),
});
export const OptionGroupUpdate = GroupFields.partial();

const OptionFields = z.object({
  name: z.string().trim().min(1).max(60),
  price: Amount,
  value: z.string().max(40).nullable(),
  serves: z.number().int().positive().nullable(),
  imageUrl: ImageUrl.nullable(),
  isActive: z.boolean(),
  position: z.number().int().min(0),
  stockItemId: z.string().min(1).nullable(),
});

export const OptionInput = OptionFields.extend({
  price: OptionFields.shape.price.default(0),
  value: OptionFields.shape.value.optional(),
  serves: OptionFields.shape.serves.optional(),
  imageUrl: OptionFields.shape.imageUrl.optional(),
  isActive: OptionFields.shape.isActive.default(true),
  position: OptionFields.shape.position.default(0),
  stockItemId: OptionFields.shape.stockItemId.optional(),
});
export const OptionUpdate = OptionFields.partial();
