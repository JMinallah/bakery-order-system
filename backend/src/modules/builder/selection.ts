import { badRequest } from "../../lib/http-error.js";

// Pure rules for builder choices, kept apart from the database so they are easy to test.

export interface BuilderOption {
  id: string;
  name: string;
  price: number;
  value: string | null;
  isActive: boolean;
  stockItem: { quantity: number } | null;
}

export interface BuilderGroup {
  id: string;
  name: string;
  multiple: boolean;
  required: boolean;
  options: BuilderOption[];
}

// Switched on, and its linked stock (if any) hasn't run out.
export const isAvailable = (option: Pick<BuilderOption, "isActive" | "stockItem">) =>
  option.isActive && (!option.stockItem || option.stockItem.quantity > 0);

export interface ResolvedSelection {
  optionId: string;
  groupName: string;
  optionName: string;
  value: string | null;
  price: number;
}

export function resolveSelections(groups: BuilderGroup[], optionIds: string[]) {
  const byId = new Map<string, { group: BuilderGroup; option: BuilderOption }>();
  for (const group of groups) for (const option of group.options) byId.set(option.id, { group, option });

  const chosen = new Map<string, ResolvedSelection[]>();
  for (const id of new Set(optionIds)) {
    const found = byId.get(id);
    if (!found) throw badRequest("One of the chosen options doesn't belong to this bakery");
    const { group, option } = found;
    if (!isAvailable(option)) throw badRequest(`${option.name} is no longer available. Please choose something else`);
    const list = chosen.get(group.id) ?? [];
    list.push({ optionId: option.id, groupName: group.name, optionName: option.name, value: option.value, price: option.price });
    chosen.set(group.id, list);
  }

  for (const group of groups) {
    const count = chosen.get(group.id)?.length ?? 0;
    if (!group.multiple && count > 1) throw badRequest(`Pick only one option for ${group.name}`);
    // Customers never see a group whose options are all switched off or sold out, so it can't be required.
    if (group.required && count === 0 && group.options.some(isAvailable)) throw badRequest(`Pick an option for ${group.name}`);
  }

  const selections = [...chosen.values()].flat();
  const estimate = selections.reduce((sum, s) => sum + s.price, 0);
  return { selections, estimate };
}
