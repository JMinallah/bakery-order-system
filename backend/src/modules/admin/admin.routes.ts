import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../../lib/access.js";
import { badRequest, conflict, notFound } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { assignOwner } from "../bakeries/bakeries.service.js";
import { OPEN_STATUSES } from "../orders/order-rules.js";

export const adminRouter = Router();

// All admin routes require a verified user with the platform ADMIN role.
adminRouter.use(requireAuth, requireRole("ADMIN"));

/**
 * Platform overview metrics: high-level marketplace statistics.
 * Does not expose any individual bakery's private recipes, stock items, or order details.
 */
adminRouter.get("/overview", async (_req, res) => {
  const [totalBakeries, activeBakeries, pendingApplications, totalUsers, totalOrders] = await Promise.all([
    prisma.bakery.count(),
    prisma.bakery.count({ where: { isActive: true } }),
    prisma.bakeryApplication.count({ where: { status: "PENDING" } }),
    prisma.user.count(),
    prisma.order.count(),
  ]);

  res.json({
    totalBakeries,
    activeBakeries,
    suspendedBakeries: totalBakeries - activeBakeries,
    pendingApplications,
    totalUsers,
    totalOrders,
  });
});

/**
 * Platform bakery directory: high-level list of bakeries registered on the platform.
 * Allows the platform admin to view status and active member/product/order counts.
 */
adminRouter.get("/bakeries", async (_req, res) => {
  const bakeries = await prisma.bakery.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      city: true,
      phone: true,
      address: true,
      isActive: true,
      isPublished: true,
      createdAt: true,
      _count: {
        select: {
          members: true,
          products: true,
          orders: true,
          invites: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const [open, owners] = await Promise.all([
    prisma.order.groupBy({ by: ["bakeryId"], where: { status: { in: OPEN_STATUSES } }, _count: true }),
    prisma.bakeryMember.groupBy({ by: ["bakeryId"], where: { role: "OWNER" }, _count: true }),
  ]);
  const openBy = new Map(open.map((o) => [o.bakeryId, o._count]));
  const ownersBy = new Map(owners.map((o) => [o.bakeryId, o._count]));

  res.json(bakeries.map((b) => ({ ...b, openOrders: openBy.get(b.id) ?? 0, owners: ownersBy.get(b.id) ?? 0 })));
});

/**
 * Gives a bakery an owner, e.g. when its only owner has left. The person joins now if their
 * email is verified, or when they first sign in with it. The admin still can't see the bakery's data.
 */
adminRouter.post("/bakeries/:bakeryId/owner", async (req, res) => {
  const { email } = z.object({ email: z.string().trim().email() }).parse(req.body);
  res.status(201).json(await assignOwner(req.params.bakeryId, email));
});

const BakeryStatusInput = z.object({
  isActive: z.boolean(),
});

/**
 * Suspend or reactivate a bakery on the platform.
 * Suspended bakeries are immediately hidden from customer ordering on mobile.
 */
adminRouter.patch("/bakeries/:bakeryId/status", async (req, res) => {
  const { isActive } = BakeryStatusInput.parse(req.body);
  const exists = await prisma.bakery.findUnique({ where: { id: req.params.bakeryId }, select: { id: true } });
  if (!exists) throw notFound("Bakery");

  const updated = await prisma.bakery.update({
    where: { id: req.params.bakeryId },
    data: { isActive },
    select: { id: true, name: true, slug: true, isActive: true },
  });

  res.json(updated);
});

/**
 * Platform user directory: list registered users, their roles, and account dates.
 */
adminRouter.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          memberships: true,
          orders: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(users);
});

const UserRoleInput = z.object({
  role: z.enum(["ADMIN", "CUSTOMER"]),
});

/**
 * Promote or demote a user to/from platform ADMIN.
 * Admins cannot revoke their own admin role to prevent accidental lockout.
 */
adminRouter.patch("/users/:userId/role", async (req, res) => {
  const { role } = UserRoleInput.parse(req.body);

  if (req.user!.id === req.params.userId && role !== "ADMIN") {
    throw badRequest("You cannot remove your own administrator role");
  }

  const exists = await prisma.user.findUnique({ where: { id: req.params.userId }, select: { id: true } });
  if (!exists) throw notFound("User");

  // Promotion removes every bakery membership, so it mustn't leave a bakery without an owner.
  if (role === "ADMIN") {
    const owned = await prisma.bakeryMember.findMany({
      where: { userId: req.params.userId, role: "OWNER" },
      select: { bakery: { select: { id: true, name: true } } },
    });
    const soleOwnerOf: string[] = [];
    for (const { bakery } of owned) {
      const owners = await prisma.bakeryMember.count({ where: { bakeryId: bakery.id, role: "OWNER" } });
      if (owners <= 1) soleOwnerOf.push(bakery.name);
    }
    if (soleOwnerOf.length) {
      throw conflict(`They're the only owner of ${soleOwnerOf.join(", ")}. Give that bakery another owner first`);
    }
  }

  // Admins must remain completely independent from bakeries.
  // If promoting to ADMIN, remove any existing bakery memberships.
  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: req.params.userId },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    }),
    ...(role === "ADMIN" ? [prisma.bakeryMember.deleteMany({ where: { userId: req.params.userId } })] : []),
  ]);

  res.json(updated);
});
