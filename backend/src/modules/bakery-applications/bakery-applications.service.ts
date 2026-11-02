import { firebaseAuth, firebaseConfigured } from "../../lib/firebase.js";
import { conflict, notFound } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { addMember } from "../bakeries/bakeries.service.js";
import type { BakeryApplicationInput } from "./bakery-applications.schemas.js";

const OPEN = ["PENDING", "CONTACTED"] as const;

export async function createApplication(data: BakeryApplicationInput) {
  const email = data.email.toLowerCase();
  const waiting = await prisma.bakeryApplication.findFirst({ where: { email, status: { in: [...OPEN] } }, select: { id: true } });
  if (waiting) throw conflict("We already have an application from this email. We'll be in touch soon");
  return prisma.bakeryApplication.create({
    data: {
      ...data,
      email,
      notes: data.notes || null,
    },
    select: { id: true, status: true, createdAt: true },
  });
}

// "LINKED" once the applicant owns the bakery, "INVITED" while it waits for them to sign in.
async function ownerStatus(bakeryId: string, email: string) {
  const [owners, invite] = await Promise.all([
    prisma.bakeryMember.count({ where: { bakeryId, role: "OWNER" } }),
    prisma.bakeryInvite.findUnique({ where: { bakeryId_email: { bakeryId, email } }, select: { id: true } }),
  ]);
  return owners > 0 ? "LINKED" : invite ? "INVITED" : "NONE";
}

export async function listApplications() {
  const applications = await prisma.bakeryApplication.findMany({
    orderBy: { createdAt: "desc" },
    include: { bakery: { select: { id: true, name: true, slug: true, isPublished: true, isActive: true } } },
  });
  return Promise.all(
    applications.map(async (a) => ({ ...a, owner: a.bakeryId ? await ownerStatus(a.bakeryId, a.email) : null })),
  );
}

export async function updateApplicationStatus(id: string, status: "PENDING" | "CONTACTED" | "DECLINED") {
  const application = await prisma.bakeryApplication.findUnique({ where: { id }, select: { id: true, bakeryId: true } });
  if (!application) throw notFound("Bakery application");
  if (application.bakeryId) throw conflict("This bakery is already set up. Manage it under Bakeries");
  return prisma.bakeryApplication.update({ where: { id }, data: { status } });
}

function baseSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "bakery";
}

// Makes sure the applicant has a Firebase account to sign in with. The dashboard then has
// Firebase email them a link to choose a password. "EXISTING" means they already sign in.
async function ensureFirebaseAccount(email: string, displayName: string) {
  if (!firebaseConfigured) return "UNAVAILABLE" as const;
  const auth = firebaseAuth();
  try {
    await auth.getUserByEmail(email);
    return "EXISTING" as const;
  } catch (err) {
    if ((err as { code?: string }).code !== "auth/user-not-found") {
      console.error("Couldn't look up the applicant's Firebase account", err);
      return "UNAVAILABLE" as const;
    }
  }
  try {
    await auth.createUser({ email, displayName, emailVerified: false });
    return "CREATED" as const;
  } catch (err) {
    console.error("Couldn't create the applicant's Firebase account", err);
    return "UNAVAILABLE" as const;
  }
}

// Creates the bakery, hidden until its owner publishes it, and makes the applicant its owner.
// Safe to call again: it returns the bakery made the first time.
export async function onboardApplication(id: string) {
  const application = await prisma.bakeryApplication.findUnique({ where: { id } });
  if (!application) throw notFound("Bakery application");
  if (application.status === "DECLINED") throw conflict("Reopen this application before approving it");

  const bakery = application.bakeryId
    ? await prisma.bakery.findUniqueOrThrow({ where: { id: application.bakeryId } })
    : await prisma.$transaction(async (tx) => {
        const existing = await tx.bakeryApplication.findUniqueOrThrow({ where: { id } });
        if (existing.bakeryId) return tx.bakery.findUniqueOrThrow({ where: { id: existing.bakeryId } });

        const slugRoot = baseSlug(existing.bakeryName);
        let slug = slugRoot;
        for (let suffix = 2; await tx.bakery.findUnique({ where: { slug }, select: { id: true } }); suffix += 1) {
          slug = `${slugRoot}-${suffix}`;
        }
        const created = await tx.bakery.create({
          data: { slug, name: existing.bakeryName, city: existing.city, phone: existing.phone },
        });
        await tx.bakeryApplication.update({ where: { id }, data: { bakeryId: created.id, status: "APPROVED" } });
        return created;
      });

  if ((await ownerStatus(bakery.id, application.email)) === "NONE") {
    await addMember(bakery.id, application.email, "OWNER");
  }
  const account = await ensureFirebaseAccount(application.email, application.contactName);
  return {
    bakery: { id: bakery.id, name: bakery.name, slug: bakery.slug },
    owner: await ownerStatus(bakery.id, application.email),
    account,
  };
}
