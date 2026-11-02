import { isMember } from "../../lib/access.js";
import { dateFromKey } from "../../lib/dates.js";
import { badRequest, conflict, notFound } from "../../lib/http-error.js";
import { prisma, Prisma, type Bakery, type MemberRole, type User } from "../../lib/prisma.js";
import { nextCustomDate, todayFor } from "./availability.service.js";
import type { BakerySettingsUpdate } from "./bakeries.schemas.js";

// What anyone may see about a bakery. Capacity rules and staff stay private.
const publicFields = {
  id: true,
  slug: true,
  name: true,
  about: true,
  phone: true,
  address: true,
  city: true,
  country: true,
  currency: true,
  imageUrl: true,
  deliveryAreas: true,
  deliveryFee: true,
  pickupAvailable: true,
  acceptsCash: true,
  acceptsMobileMoney: true,
  mobileMoneyNumber: true,
  customNoticeDays: true,
  handoverTimes: true,
  occasions: true,
} as const;

export const sameText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" }) === 0;

async function cakePricesFrom(bakeryIds: string[]) {
  const rows = await prisma.product.groupBy({
    by: ["bakeryId"],
    where: { bakeryId: { in: bakeryIds }, isActive: true, category: "CAKE" },
    _min: { price: true },
  });
  return new Map(rows.map((r) => [r.bakeryId, r._min.price]));
}

function toPublic(bakery: Bakery, priceFrom: number | null | undefined, next: string | null) {
  const visible = Object.fromEntries(Object.keys(publicFields).map((k) => [k, bakery[k as keyof Bakery]]));
  return { ...visible, cakesFrom: priceFrom ?? null, nextCustomDate: next };
}

// Sorted by the soonest day a custom cake could be ready, then by name.
export async function listBakeries(filters: { area?: string; country?: string; q?: string }) {
  const bakeries = await prisma.bakery.findMany({
    where: {
      ...customerVisible,
      country: filters.country,
      name: filters.q ? { contains: filters.q, mode: "insensitive" } : undefined,
    },
    orderBy: { name: "asc" },
  });
  const inArea = filters.area
    ? bakeries.filter((b) => b.deliveryAreas.some((a) => sameText(a, filters.area!)) || sameText(b.city, filters.area!))
    : bakeries;

  const [prices, nextDates] = await Promise.all([
    cakePricesFrom(inArea.map((b) => b.id)),
    Promise.all(inArea.map((b) => nextCustomDate(b))),
  ]);
  return inArea
    .map((b, i) => toPublic(b, prices.get(b.id), nextDates[i]))
    .sort((a, b) => (a.nextCustomDate ?? "9999").localeCompare(b.nextCustomDate ?? "9999"));
}

// Customers only see bakeries the owner has published and the platform hasn't suspended.
const customerVisible = { isActive: true, isPublished: true } as const;

// A bakery customers can order from. Accepts the bakery's id or its slug.
export async function findActiveBakery(idOrSlug: string) {
  const bakery = await prisma.bakery.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], ...customerVisible } });
  if (!bakery) throw notFound("Bakery");
  return bakery;
}

// Like findActiveBakery, but the bakery's own staff also see it while it is unpublished or
// suspended, so the dashboard keeps working during setup.
export async function findVisibleBakery(idOrSlug: string, user: User | undefined) {
  const bakery = await prisma.bakery.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] } });
  if (!bakery) throw notFound("Bakery");
  if ((bakery.isActive && bakery.isPublished) || (await isMember(user, bakery.id))) return bakery;
  throw notFound("Bakery");
}

export async function getPublicBakery(idOrSlug: string, user: User | undefined) {
  const bakery = await findVisibleBakery(idOrSlug, user);
  const [prices, next] = await Promise.all([cakePricesFrom([bakery.id]), nextCustomDate(bakery)]);
  return toPublic(bakery, prices.get(bakery.id), next);
}

export async function getStaffBakery(bakeryId: string) {
  const bakery = await prisma.bakery.findUnique({ where: { id: bakeryId } });
  if (!bakery) throw notFound("Bakery");
  return bakery;
}

// What still stops the bakery going live. Empty when it can be published.
export async function publishProblems(bakery: Bakery) {
  const [products, options] = await Promise.all([
    prisma.product.count({ where: { bakeryId: bakery.id, isActive: true } }),
    prisma.option.count({ where: { group: { bakeryId: bakery.id }, isActive: true } }),
  ]);
  const problems: string[] = [];
  if (products + options === 0) problems.push("Add at least one product or cake builder option");
  if (!bakery.phone) problems.push("Add a phone number customers can call");
  if (!bakery.pickupAvailable && bakery.deliveryAreas.length === 0) problems.push("Offer pickup or at least one delivery area");
  if (bakery.handoverTimes.length === 0) problems.push("Add at least one handover time");
  if (bakery.acceptsMobileMoney && !bakery.mobileMoneyNumber) problems.push("Add the Mobile Money number customers pay to");
  return problems;
}

// The settings screen: every field, plus what is left before the bakery can go live.
export async function staffSettings(bakeryId: string) {
  const bakery = await getStaffBakery(bakeryId);
  return { ...bakery, publishProblems: await publishProblems(bakery) };
}

export async function setPublished(bakeryId: string, isPublished: boolean) {
  const bakery = await getStaffBakery(bakeryId);
  if (isPublished) {
    const problems = await publishProblems(bakery);
    if (problems.length) throw conflict(`Before going live: ${problems.join(", ").toLowerCase()}`);
  }
  await prisma.bakery.update({ where: { id: bakeryId }, data: { isPublished } });
  return staffSettings(bakeryId);
}

export async function updateSettings(bakeryId: string, data: BakerySettingsUpdate) {
  const current = await getStaffBakery(bakeryId);
  const next = { ...current, ...data };
  if (!next.acceptsCash && !next.acceptsMobileMoney) throw badRequest("Accept at least one way to pay");
  if (!next.pickupAvailable && next.deliveryAreas.length === 0) {
    throw badRequest("Offer pickup or at least one delivery area, or customers can't receive their cakes");
  }
  if (data.closedWeekdays) data.closedWeekdays = [...new Set(data.closedWeekdays)].sort();
  if (data.deliveryAreas) {
    data.deliveryAreas = data.deliveryAreas.filter((a, i, all) => all.findIndex((b) => sameText(a, b)) === i);
  }
  if (data.handoverTimes) {
    data.handoverTimes = [...new Set(data.handoverTimes.map((t) => t.trim()).filter(Boolean))].sort();
  }
  if (data.occasions) {
    data.occasions = [...new Set(data.occasions.map((o) => o.trim()).filter(Boolean))];
  }
  await prisma.bakery.update({ where: { id: bakeryId }, data });
  return staffSettings(bakeryId);
}

// ---------------------------------------------------------------------------
// Staff members
// ---------------------------------------------------------------------------

const memberSelect = {
  id: true,
  role: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
} as const;

export function listMembers(bakeryId: string) {
  return prisma.bakeryMember.findMany({ where: { bakeryId }, select: memberSelect, orderBy: { createdAt: "asc" } });
}

const inviteSelect = { id: true, email: true, role: true, createdAt: true } as const;

// Someone with a verified account joins straight away. Anyone else gets an invite that
// turns into membership when they open the dashboard with that email verified.
export async function addMember(bakeryId: string, email: string, role: MemberRole) {
  const address = email.trim().toLowerCase();
  const accounts = await prisma.user.findMany({ where: { email: { equals: address, mode: "insensitive" } } });
  if (accounts.some((u) => u.role === "ADMIN")) {
    throw badRequest("Platform administrators can't join a bakery. Use a different email");
  }
  const verified = accounts.find((u) => u.emailVerified);
  if (verified) {
    try {
      const member = await prisma.bakeryMember.create({ data: { bakeryId, userId: verified.id, role }, select: memberSelect });
      return { status: "ADDED" as const, member };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw conflict("That person is already on your staff");
      }
      throw err;
    }
  }
  const invite = await prisma.bakeryInvite.upsert({
    where: { bakeryId_email: { bakeryId, email: address } },
    update: { role },
    create: { bakeryId, email: address, role },
    select: inviteSelect,
  });
  return { status: "INVITED" as const, invite };
}

// Platform admins use this to give a bakery an owner again, e.g. when the only owner left.
export async function assignOwner(bakeryId: string, email: string) {
  await getStaffBakery(bakeryId);
  const verified = await prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" }, emailVerified: true },
    select: { id: true, role: true },
  });
  if (verified && verified.role !== "ADMIN") {
    const existing = await prisma.bakeryMember.findUnique({ where: { bakeryId_userId: { bakeryId, userId: verified.id } } });
    if (existing) {
      const member = await prisma.bakeryMember.update({ where: { id: existing.id }, data: { role: "OWNER" }, select: memberSelect });
      return { status: "ADDED" as const, member };
    }
  }
  return addMember(bakeryId, email, "OWNER");
}

export function listInvites(bakeryId: string) {
  return prisma.bakeryInvite.findMany({ where: { bakeryId }, select: inviteSelect, orderBy: { createdAt: "asc" } });
}

export async function cancelInvite(bakeryId: string, inviteId: string) {
  const invite = await prisma.bakeryInvite.findFirst({ where: { id: inviteId, bakeryId } });
  if (!invite) throw notFound("Invite");
  await prisma.bakeryInvite.delete({ where: { id: invite.id } });
}

// Turns invites for this person's verified email into memberships.
export async function claimInvites(user: User) {
  if (!user.email || !user.emailVerified || user.role === "ADMIN") return;
  const invites = await prisma.bakeryInvite.findMany({ where: { email: user.email.toLowerCase() } });
  for (const invite of invites) {
    await prisma.$transaction([
      prisma.bakeryMember.upsert({
        where: { bakeryId_userId: { bakeryId: invite.bakeryId, userId: user.id } },
        update: invite.role === "OWNER" ? { role: "OWNER" } : {},
        create: { bakeryId: invite.bakeryId, userId: user.id, role: invite.role },
      }),
      prisma.bakeryInvite.delete({ where: { id: invite.id } }),
    ]);
  }
}

async function assertOtherOwner(bakeryId: string) {
  const owners = await prisma.bakeryMember.count({ where: { bakeryId, role: "OWNER" } });
  if (owners <= 1) throw conflict("A bakery needs at least one owner. Make someone else an owner first");
}

export async function changeMemberRole(bakeryId: string, memberId: string, role: MemberRole) {
  const member = await prisma.bakeryMember.findFirst({ where: { id: memberId, bakeryId } });
  if (!member) throw notFound("Staff member");
  if (member.role === role) return prisma.bakeryMember.findUniqueOrThrow({ where: { id: member.id }, select: memberSelect });
  if (member.role === "OWNER") await assertOtherOwner(bakeryId);
  return prisma.bakeryMember.update({ where: { id: member.id }, data: { role }, select: memberSelect });
}

export async function removeMember(bakeryId: string, memberId: string) {
  const member = await prisma.bakeryMember.findFirst({ where: { id: memberId, bakeryId } });
  if (!member) throw notFound("Staff member");
  if (member.role === "OWNER") await assertOtherOwner(bakeryId);
  await prisma.bakeryMember.delete({ where: { id: member.id } });
}

// ---------------------------------------------------------------------------
// Blocked dates
// ---------------------------------------------------------------------------

export async function listBlockedDates(bakeryId: string) {
  const bakery = await getStaffBakery(bakeryId);
  return prisma.blockedDate.findMany({
    where: { bakeryId, date: { gte: dateFromKey(todayFor(bakery)) } },
    orderBy: { date: "asc" },
  });
}

export async function blockDate(bakeryId: string, date: string, reason?: string) {
  try {
    return await prisma.blockedDate.create({ data: { bakeryId, date: dateFromKey(date), reason } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw conflict("That date is already blocked");
    }
    throw err;
  }
}

export async function unblockDate(bakeryId: string, blockedDateId: string) {
  const row = await prisma.blockedDate.findFirst({ where: { id: blockedDateId, bakeryId } });
  if (!row) throw notFound("Blocked date");
  await prisma.blockedDate.delete({ where: { id: row.id } });
}
