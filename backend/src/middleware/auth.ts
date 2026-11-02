import type { NextFunction, Request, Response } from "express";
import { env, isProduction } from "../config/env.js";
import { firebaseAuth, firebaseConfigured } from "../lib/firebase.js";
import { HttpError } from "../lib/http-error.js";
import { prisma, type Role, type User } from "../lib/prisma.js";

interface Identity {
  uid: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  dev?: { role: "CUSTOMER" | "STAFF" | "ADMIN"; bakerySlug: string };
}

// Seeded by prisma/seed.ts; dev staff join it unless `x-dev-bakery` names another bakery.
const DEFAULT_DEV_BAKERY = "sweet-crumbs";

function hasCredentials<P>(req: Request<P>) {
  return Boolean(req.header("authorization") || (env.AUTH_DEV_BYPASS && !isProduction && req.header("x-dev-user")));
}

async function identify<P>(req: Request<P>): Promise<Identity> {
  if (env.AUTH_DEV_BYPASS && !isProduction) {
    const devUser = req.header("x-dev-user");
    if (devUser) {
      const role = req.header("x-dev-role");
      return {
        uid: `dev:${devUser}`,
        name: devUser,
        // Lets tests act as someone with an email, verified unless x-dev-unverified is "true".
        email: req.header("x-dev-email") ?? undefined,
        emailVerified: req.header("x-dev-unverified") !== "true",
        dev: {
          role: role === "STAFF" || role === "ADMIN" ? role : "CUSTOMER",
          bakerySlug: req.header("x-dev-bakery") ?? DEFAULT_DEV_BAKERY,
        },
      };
    }
  }

  const token = req.header("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, "Missing bearer token");

  if (!firebaseConfigured && env.AUTH_DEV_BYPASS && !isProduction) {
    return {
      uid: "dev:customer",
      name: "Customer",
      emailVerified: false,
      dev: {
        role: "CUSTOMER",
        bakerySlug: DEFAULT_DEV_BAKERY,
      },
    };
  }

  const auth = firebaseAuth();
  try {
    const decoded = await auth.verifyIdToken(token, isProduction);
    return { uid: decoded.uid, email: decoded.email, emailVerified: decoded.email_verified === true, name: decoded.name };
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }
}

async function loadUser({ uid, email, emailVerified, name, dev }: Identity): Promise<User> {
  const role: Role = dev?.role === "ADMIN" ? "ADMIN" : "CUSTOMER";
  let user = await prisma.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) {
    try {
      user = await prisma.user.create({ data: { firebaseUid: uid, email, emailVerified, name, role } });
    } catch (error) {
      // Two first requests from the same person raced to create the account.
      user = await prisma.user.findUnique({ where: { firebaseUid: uid } });
      if (!user) throw error;
    }
  }
  // Keep the email in step with Firebase, which changes when it is verified or edited.
  const changes = {
    ...(email !== undefined && email !== user.email ? { email } : {}),
    ...(emailVerified !== user.emailVerified ? { emailVerified } : {}),
    ...(dev && role !== user.role ? { role } : {}),
  };
  if (Object.keys(changes).length) user = await prisma.user.update({ where: { id: user.id }, data: changes });
  // Dev staff are made owners of the bakery they name, so every dashboard screen works locally.
  if (dev?.role === "STAFF") {
    const bakery = await prisma.bakery.findUnique({ where: { slug: dev.bakerySlug }, select: { id: true } });
    if (bakery) {
      await prisma.bakeryMember.upsert({
        where: { bakeryId_userId: { bakeryId: bakery.id, userId: user.id } },
        update: {},
        create: { bakeryId: bakery.id, userId: user.id, role: "OWNER" },
      });
    }
  }
  return user;
}

// Verifies the caller and attaches their User record as req.user, creating it on first sign-in.
// Generic so Express keeps the route's typed params (e.g. :id) in the handlers that follow.
export async function requireAuth<P>(req: Request<P>, _res: Response, next: NextFunction) {
  req.user = await loadUser(await identify(req));
  next();
}

// For public routes that show more to signed-in staff. Bad credentials still fail.
export async function optionalAuth<P>(req: Request<P>, _res: Response, next: NextFunction) {
  if (hasCredentials(req)) req.user = await loadUser(await identify(req));
  next();
}
