import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { runDeadlineReminderCheck } from "../src/jobs/deadline-reminders.js";
import { runOrderExpiryCheck } from "../src/jobs/order-expiry.js";
import { addDays, dayKey } from "../src/lib/dates.js";
import { prisma } from "../src/lib/prisma.js";

// Admin and bakery flows against a real database: applications, going live, staff
// invites, and the order rules staff rely on. Same setup as api.db.test.ts.

const app = createApp();
const api = request(app);
const run = Date.now().toString(36);

const admin = { "x-dev-user": `admin-${run}`, "x-dev-role": "ADMIN" };
const customer = { "x-dev-user": `flow-customer-${run}` };
const sweetStaff = { "x-dev-user": "dev-staff", "x-dev-role": "STAFF" };
const applicantEmail = `owner-${run}@example.com`;
const applicant = { "x-dev-user": `owner-${run}`, "x-dev-email": applicantEmail };

const at = (day: string, time = "14:00") => `${day}T${time}:00+03:00`;
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe.skipIf(!process.env.RUN_DB_TESTS)("admin and bakery flows", () => {
  let sweetId: string;
  let productId: string;
  let readyDay: string;
  let customDay: string;

  beforeAll(async () => {
    const sweet = await api.get("/api/bakeries/sweet-crumbs");
    sweetId = sweet.body.id;
    productId = (await api.get(`/api/bakeries/${sweetId}/products?category=CAKE`)).body[0].id;
    const calendar = await api.get(`/api/bakeries/${sweetId}/availability?days=60`);
    const open = (calendar.body as { date: string; status: string }[]).filter((d) => d.status === "OPEN").map((d) => d.date);
    readyDay = open[20]!;
    customDay = open[21]!;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("a bakery application", () => {
    let applicationId: string;
    let bakeryId: string;
    let slug: string;

    it("is accepted once per email while it waits", async () => {
      const body = { bakeryName: `Flow Bakes ${run}`, contactName: "Amina", email: applicantEmail, phone: "0700 111 222", city: "Kampala" };
      const first = await api.post("/api/bakery-applications").send(body);
      expect(first.status).toBe(201);
      applicationId = first.body.id;
      expect((await api.post("/api/bakery-applications").send(body)).status).toBe(409);
    });

    it("can only be approved by creating the bakery", async () => {
      const res = await api.patch(`/api/bakery-applications/${applicationId}`).set(admin).send({ status: "APPROVED" });
      expect(res.status).toBe(400);
    });

    it("creates a hidden bakery that waits for the applicant to sign in", async () => {
      const res = await api.post(`/api/bakery-applications/${applicationId}/onboard`).set(admin);
      expect(res.status).toBe(201);
      expect(res.body.owner).toBe("INVITED");
      bakeryId = res.body.bakery.id;
      slug = res.body.bakery.slug;
      expect((await api.get(`/api/bakeries/${slug}`)).status).toBe(404);

      const again = await api.post(`/api/bakery-applications/${applicationId}/onboard`).set(admin);
      expect(again.body.bakery.id).toBe(bakeryId);
      const changed = await api.patch(`/api/bakery-applications/${applicationId}`).set(admin).send({ status: "DECLINED" });
      expect(changed.status).toBe(409);
    });

    it("doesn't hand the bakery to someone whose email isn't verified", async () => {
      const unverified = { "x-dev-user": `impostor-${run}`, "x-dev-email": applicantEmail, "x-dev-unverified": "true" };
      const me = await api.get("/api/users/me").set(unverified);
      expect(me.body.emailVerified).toBe(false);
      expect(me.body.bakeries).toEqual([]);
    });

    it("makes the applicant the owner when they sign in with that email verified", async () => {
      const me = await api.get("/api/users/me").set(applicant);
      expect(me.body.bakeries).toEqual([expect.objectContaining({ id: bakeryId, memberRole: "OWNER" })]);
      const list = await api.get("/api/bakery-applications").set(admin);
      expect(list.body.find((a: { id: string }) => a.id === applicationId).owner).toBe("LINKED");
    });

    it("lets the owner work on the bakery while it is hidden", async () => {
      const product = await api
        .post(`/api/bakeries/${bakeryId}/products`)
        .set(applicant)
        .send({ name: "Vanilla sponge", category: "CAKE", price: 60000, isActive: false });
      expect(product.status).toBe(201);
      const all = await api.get(`/api/bakeries/${bakeryId}/products?all=true`).set(applicant);
      expect(all.body).toHaveLength(1);
      expect((await api.get(`/api/bakeries/${bakeryId}/availability`).set(applicant)).status).toBe(200);
      expect((await api.get(`/api/bakeries/${bakeryId}/availability`)).status).toBe(404);
    });

    it("can't go live until setup is finished", async () => {
      const settings = await api.get(`/api/bakeries/${bakeryId}/settings`).set(applicant);
      expect(settings.body.publishProblems).toContain("Add at least one product or cake builder option");
      expect((await api.post(`/api/bakeries/${bakeryId}/publish`).set(applicant)).status).toBe(409);

      const products = await api.get(`/api/bakeries/${bakeryId}/products?all=true`).set(applicant);
      await api.patch(`/api/bakeries/${bakeryId}/products/${products.body[0].id}`).set(applicant).send({ isActive: true });
      await api.patch(`/api/bakeries/${bakeryId}`).set(applicant).send({ mobileMoneyNumber: "0700 111 222" });
      const published = await api.post(`/api/bakeries/${bakeryId}/publish`).set(applicant);
      expect(published.status).toBe(200);
      expect(published.body.isPublished).toBe(true);
      expect((await api.get(`/api/bakeries/${slug}`)).status).toBe(200);
    });

    it("hides the bakery again when its owner unpublishes it", async () => {
      await api.post(`/api/bakeries/${bakeryId}/unpublish`).set(applicant);
      expect((await api.get(`/api/bakeries/${slug}`)).status).toBe(404);
      await api.post(`/api/bakeries/${bakeryId}/publish`).set(applicant);
    });

    describe("staff", () => {
      const staffEmail = `baker-${run}@example.com`;
      const baker = { "x-dev-user": `baker-${run}`, "x-dev-email": staffEmail };

      it("are invited before they have an account, and join once they sign in", async () => {
        const added = await api.post(`/api/bakeries/${bakeryId}/members`).set(applicant).send({ email: staffEmail });
        expect(added.body.status).toBe("INVITED");
        expect((await api.get(`/api/bakeries/${bakeryId}/invites`).set(applicant)).body).toHaveLength(1);

        const me = await api.get("/api/users/me").set(baker);
        expect(me.body.bakeries).toEqual([expect.objectContaining({ id: bakeryId, memberRole: "STAFF" })]);
        expect((await api.get(`/api/bakeries/${bakeryId}/invites`).set(applicant)).body).toHaveLength(0);
      });

      it("join straight away when their email is already verified", async () => {
        const email = `ready-${run}@example.com`;
        await api.get("/api/users/me").set({ "x-dev-user": `ready-${run}`, "x-dev-email": email });
        const added = await api.post(`/api/bakeries/${bakeryId}/members`).set(applicant).send({ email });
        expect(added.body.status).toBe("ADDED");
      });

      it("can have their invite cancelled", async () => {
        const added = await api.post(`/api/bakeries/${bakeryId}/members`).set(applicant).send({ email: `nobody-${run}@example.com` });
        expect((await api.delete(`/api/bakeries/${bakeryId}/invites/${added.body.invite.id}`).set(applicant)).status).toBe(204);
      });

      it("can be made owners, but the last owner can't step down", async () => {
        const members = (await api.get(`/api/bakeries/${bakeryId}/members`).set(applicant)).body as {
          id: string;
          role: string;
          user: { email: string };
        }[];
        const owner = members.find((m) => m.user.email === applicantEmail)!;
        const staffMember = members.find((m) => m.user.email === staffEmail)!;
        expect((await api.patch(`/api/bakeries/${bakeryId}/members/${owner.id}`).set(applicant).send({ role: "STAFF" })).status).toBe(409);
        expect((await api.patch(`/api/bakeries/${bakeryId}/members/${staffMember.id}`).set(baker).send({ role: "OWNER" })).status).toBe(403);
        const promoted = await api.patch(`/api/bakeries/${bakeryId}/members/${staffMember.id}`).set(applicant).send({ role: "OWNER" });
        expect(promoted.body.role).toBe("OWNER");
        await api.patch(`/api/bakeries/${bakeryId}/members/${staffMember.id}`).set(applicant).send({ role: "STAFF" });
      });
    });

    describe("platform admins", () => {
      it("can't promote a bakery's only owner, which would leave it ownerless", async () => {
        const users = (await api.get("/api/admin/users").set(admin)).body as { id: string; email: string }[];
        const owner = users.find((u) => u.email === applicantEmail)!;
        const res = await api.patch(`/api/admin/users/${owner.id}/role`).set(admin).send({ role: "ADMIN" });
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/only owner/);
      });

      it("can give a bakery a new owner", async () => {
        const res = await api.post(`/api/admin/bakeries/${bakeryId}/owner`).set(admin).send({ email: `rescue-${run}@example.com` });
        expect(res.body.status).toBe("INVITED");
        const bakeries = (await api.get("/api/admin/bakeries").set(admin)).body as { id: string; owners: number; openOrders: number }[];
        expect(bakeries.find((b) => b.id === bakeryId)).toMatchObject({ owners: 1, openOrders: 0 });
      });
    });
  });

  describe("orders", () => {
    const readyMade = () => ({ bakeryId: sweetId, type: "STANDARD", dueDate: at(readyDay), fulfilment: "PICKUP", items: [{ productId }] });
    const custom = (extra: object = {}) => ({ bakeryId: sweetId, type: "CUSTOM", dueDate: at(customDay), fulfilment: "PICKUP", ...extra });

    it("only take photos uploaded through the API", async () => {
      const outside = await api.post("/api/orders").set(customer).send(custom({ designImageUrl: "https://example.com/cake.jpg" }));
      expect(outside.status).toBe(400);
      const script = await api.post("/api/orders").set(customer).send(custom({ designImageUrl: "javascript:alert(1)//uploads/abc" }));
      expect(script.status).toBe(400);
      const missing = await api.post("/api/orders").set(customer).send(custom({ inspirationImageUrls: ["http://localhost:4000/api/uploads/nope"] }));
      expect(missing.status).toBe(400);

      const upload = await api.post("/api/uploads").set(customer).set("Content-Type", "image/png").send(PNG);
      // The emulator builds links with another host; only the upload id matters.
      const viaEmulator = upload.body.url.replace(/^https?:\/\/[^/]+/, "http://10.0.2.2:4000");
      const ok = await api.post("/api/orders").set(customer).send(custom({ designImageUrl: viaEmulator }));
      expect(ok.status).toBe(201);
      await api.post(`/api/orders/${ok.body.id}/cancel`).set(customer).send({});
    });

    it("refuse amounts too large to store", async () => {
      expect((await api.post("/api/orders").set(customer).send(custom({ budget: 5_000_000_000 }))).status).toBe(400);
      const order = (await api.post("/api/orders").set(customer).send(custom())).body;
      expect((await api.post(`/api/orders/${order.id}/quotations`).set(sweetStaff).send({ amount: 3_000_000_000 })).status).toBe(400);
      await api.post(`/api/orders/${order.id}/cancel`).set(customer).send({});
    });

    it("don't quote ready-made orders", async () => {
      const order = (await api.post("/api/orders").set(customer).send(readyMade())).body;
      const res = await api.post(`/api/orders/${order.id}/quotations`).set(sweetStaff).send({ amount: 1000 });
      expect(res.status).toBe(409);
      await api.post(`/api/orders/${order.id}/cancel`).set(customer).send({});
    });

    it("take a deposit while the customer thinks about the quote", async () => {
      const order = (await api.post("/api/orders").set(customer).send(custom())).body;
      const quote = await api.post(`/api/orders/${order.id}/quotations`).set(sweetStaff).send({ amount: 100000 });
      const deposit = await api.post(`/api/orders/${order.id}/payments`).set(sweetStaff).send({ amount: 30000, method: "MOBILE_MONEY" });
      expect(deposit.status).toBe(201);
      expect(deposit.body.paymentStatus).toBe("DEPOSIT_PAID");
      const accepted = await api.post(`/api/orders/${order.id}/accept-quote`).set(customer).send({ quotationId: quote.body.id });
      expect(accepted.body).toMatchObject({ status: "CONFIRMED", total: 100000, paymentStatus: "DEPOSIT_PAID" });
      await api.post(`/api/orders/${order.id}/cancel`).set(customer).send({});
    });

    it("never let two payments at once go over the total", async () => {
      const order = (await api.post("/api/orders").set(customer).send(readyMade())).body;
      await api.patch(`/api/orders/${order.id}/status`).set(sweetStaff).send({ status: "CONFIRMED" });
      const half = Math.ceil((order.total * 2) / 3);
      const results = await Promise.all(
        [0, 1].map(() => api.post(`/api/orders/${order.id}/payments`).set(sweetStaff).send({ amount: half, method: "CASH" })),
      );
      expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
      const saved = await api.get(`/api/orders/${order.id}`).set(sweetStaff);
      expect(saved.body.amountPaid).toBe(half);
      await api.post(`/api/orders/${order.id}/cancel`).set(sweetStaff).send({ reason: "Test" });
    });

    it("don't skip a step when two people press the same button", async () => {
      const order = (await api.post("/api/orders").set(customer).send(readyMade())).body;
      await api.patch(`/api/orders/${order.id}/status`).set(sweetStaff).send({ status: "CONFIRMED" });
      const results = await Promise.all(
        [0, 1].map(() => api.patch(`/api/orders/${order.id}/status`).set(sweetStaff).send({ status: "PREPARING" })),
      );
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      await api.post(`/api/orders/${order.id}/cancel`).set(sweetStaff).send({ reason: "Test" });
    });

    it("still go through when a required builder group has nothing left to choose", async () => {
      const group = await api
        .post(`/api/bakeries/${sweetId}/option-groups`)
        .set(sweetStaff)
        .send({ kind: "OTHER", name: `Topper ${run}`, required: true });
      const option = await api.post(`/api/bakeries/${sweetId}/option-groups/${group.body.id}/options`).set(sweetStaff).send({ name: "Gold topper" });
      // One option from each of the seeded groups, leaving out the new one.
      const builder = (await api.get(`/api/bakeries/${sweetId}/builder`)).body as { name: string; options: { id: string }[] }[];
      const design = builder.filter((g) => g.name !== `Topper ${run}`).map((g) => g.options[0]!.id);

      expect((await api.post("/api/orders").set(customer).send(custom({ optionIds: design }))).status).toBe(400);
      await api.patch(`/api/bakeries/${sweetId}/options/${option.body.id}`).set(sweetStaff).send({ isActive: false });
      const res = await api.post("/api/orders").set(customer).send(custom({ optionIds: design }));
      expect(res.status).toBe(201);

      await api.post(`/api/orders/${res.body.id}/cancel`).set(customer).send({});
      expect((await api.delete(`/api/bakeries/${sweetId}/option-groups/${group.body.id}`).set(sweetStaff)).status).toBe(204);
    });
  });

  describe("background jobs", () => {
    it("cancel quotes nobody answered and orders whose day passed unconfirmed", async () => {
      const quoted = (await api.post("/api/orders").set(customer).send({ bakeryId: sweetId, type: "CUSTOM", dueDate: at(customDay), fulfilment: "PICKUP" })).body;
      await api.post(`/api/orders/${quoted.id}/quotations`).set(sweetStaff).send({ amount: 90000 });
      await prisma.quotation.updateMany({ where: { orderId: quoted.id }, data: { createdAt: new Date(Date.now() - 30 * 24 * 3600_000) } });

      const waiting = (await api.post("/api/orders").set(customer).send({ bakeryId: sweetId, type: "STANDARD", dueDate: at(readyDay), fulfilment: "PICKUP", items: [{ productId }] })).body;
      await prisma.order.update({ where: { id: waiting.id }, data: { dueDate: new Date(Date.now() - 3600_000) } });

      await runOrderExpiryCheck();
      const [a, b] = await Promise.all([api.get(`/api/orders/${quoted.id}`).set(customer), api.get(`/api/orders/${waiting.id}`).set(customer)]);
      expect(a.body).toMatchObject({ status: "CANCELLED", cancelledBy: "SYSTEM", cancelReason: "The quote expired before it was accepted" });
      expect(b.body).toMatchObject({ status: "CANCELLED", cancelledBy: "SYSTEM", cancelReason: "The due date passed before the order was confirmed" });
    });

    it("send reminders without making an order look recently handled", async () => {
      const tomorrow = addDays(dayKey(new Date(), "Africa/Kampala"), 1);
      const order = (await api.post("/api/orders").set(customer).send({ bakeryId: sweetId, type: "STANDARD", dueDate: at(readyDay), fulfilment: "PICKUP", items: [{ productId }] })).body;
      const stale = new Date(Date.now() - 3 * 24 * 3600_000);
      await prisma.order.update({ where: { id: order.id }, data: { dueDate: new Date(at(tomorrow, "20:00")), updatedAt: stale } });

      await runDeadlineReminderCheck();
      const saved = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(saved.lastReminderAt).not.toBeNull();
      expect(saved.updatedAt.getTime()).toBe(stale.getTime());
      await api.post(`/api/orders/${order.id}/cancel`).set(customer).send({});
    });
  });
});
