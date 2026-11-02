import { badRequest, notFound } from "../../lib/http-error.js";
import { prisma, type Prisma, type ProductCategory } from "../../lib/prisma.js";
import { stockLevel } from "../stock/stock-level.js";
import type { OptionGroupInput, OptionGroupUpdate, OptionInput, OptionUpdate } from "./builder.schemas.js";
import { isAvailable } from "./selection.js";
import type { z } from "zod";

const withOptions = {
  options: {
    orderBy: [{ position: "asc" as const }, { name: "asc" as const }],
    include: { stockItem: { select: { id: true, name: true, quantity: true, lowAt: true, unit: true } } },
  },
} satisfies Prisma.OptionGroupInclude;

export function loadGroups(bakeryId: string, category: ProductCategory) {
  return prisma.optionGroup.findMany({
    where: { bakeryId, category },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: withOptions,
  });
}

// What customers see: available options only, and no stock details.
export async function customerBuilder(bakeryId: string, category: ProductCategory) {
  const groups = await loadGroups(bakeryId, category);
  return groups
    .map((g) => ({
      id: g.id,
      kind: g.kind,
      name: g.name,
      multiple: g.multiple,
      required: g.required,
      options: g.options.filter(isAvailable).map((o) => ({
        id: o.id,
        name: o.name,
        price: o.price,
        value: o.value,
        serves: o.serves,
        imageUrl: o.imageUrl,
      })),
    }))
    .filter((g) => g.options.length > 0);
}

// What staff see: every option, why it is hidden, and its stock.
export async function staffBuilder(bakeryId: string, category: ProductCategory) {
  const groups = await loadGroups(bakeryId, category);
  return groups.map((g) => ({
    ...g,
    options: g.options.map((o) => ({
      ...o,
      available: isAvailable(o),
      hiddenBecause: !o.isActive ? "SWITCHED_OFF" : !isAvailable(o) ? "OUT_OF_STOCK" : null,
      stockItem: o.stockItem && { ...o.stockItem, level: stockLevel(o.stockItem) },
    })),
  }));
}

async function assertStockItem(bakeryId: string, stockItemId: string | null | undefined) {
  if (!stockItemId) return;
  const item = await prisma.stockItem.findFirst({ where: { id: stockItemId, bakeryId }, select: { id: true } });
  if (!item) throw badRequest("That stock item doesn't belong to this bakery");
}

async function findGroup(bakeryId: string, groupId: string) {
  const group = await prisma.optionGroup.findFirst({ where: { id: groupId, bakeryId } });
  if (!group) throw notFound("Option group");
  return group;
}

export function createGroup(bakeryId: string, data: z.infer<typeof OptionGroupInput>) {
  return prisma.optionGroup.create({ data: { ...data, bakeryId }, include: withOptions });
}

export async function updateGroup(bakeryId: string, groupId: string, data: z.infer<typeof OptionGroupUpdate>) {
  await findGroup(bakeryId, groupId);
  return prisma.optionGroup.update({ where: { id: groupId }, data, include: withOptions });
}

export async function createOption(bakeryId: string, groupId: string, data: z.infer<typeof OptionInput>) {
  await findGroup(bakeryId, groupId);
  await assertStockItem(bakeryId, data.stockItemId);
  return prisma.option.create({ data: { ...data, groupId } });
}

export async function updateOption(bakeryId: string, optionId: string, data: z.infer<typeof OptionUpdate>) {
  const option = await prisma.option.findFirst({ where: { id: optionId, group: { bakeryId } } });
  if (!option) throw notFound("Option");
  await assertStockItem(bakeryId, data.stockItemId);
  return prisma.option.update({ where: { id: optionId }, data });
}

// Past orders keep their own copy of each choice's name and price, so deleting is safe.
export async function deleteGroup(bakeryId: string, groupId: string) {
  await findGroup(bakeryId, groupId);
  await prisma.optionGroup.delete({ where: { id: groupId } });
}

export async function deleteOption(bakeryId: string, optionId: string) {
  const option = await prisma.option.findFirst({ where: { id: optionId, group: { bakeryId } } });
  if (!option) throw notFound("Option");
  await prisma.option.delete({ where: { id: optionId } });
}
