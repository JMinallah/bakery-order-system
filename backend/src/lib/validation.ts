import { z } from "zod";

// Money is a whole number of the bakery's currency. The cap keeps sums well inside
// PostgreSQL's 32-bit Int, so a typo is a clear 400 rather than a database error.
export const MAX_AMOUNT = 1_000_000_000;

export const Amount = z.number().int().nonnegative().max(MAX_AMOUNT, "That amount is too large");
export const PositiveAmount = Amount.positive();

const isWebUrl = (value: string) => {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
};

// A picture staff link to, e.g. a product photo. Any web address, but never javascript: or data:.
export const ImageUrl = z.string().url().max(2000).refine(isWebUrl, "Use a link that starts with http or https");

// The id in a link from POST /uploads, whatever host it was built with.
export function uploadIdFrom(value: string): string | null {
  if (!isWebUrl(value)) return null;
  return new URL(value).pathname.match(/\/uploads\/([A-Za-z0-9_-]+)$/)?.[1] ?? null;
}

// A photo on an order. Customers can only attach photos uploaded through the API,
// so staff never open a link a stranger chose.
export const UploadUrl = z
  .string()
  .url()
  .max(2000)
  .refine((value) => uploadIdFrom(value) !== null, "Upload the photo first, then send the link you got back");
