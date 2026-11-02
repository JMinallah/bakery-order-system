import { Router } from "express";
import { isMember, requireMember } from "../../lib/access.js";
import { forbidden, notFound } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { optionalAuth, requireAuth } from "../../middleware/auth.js";
import { findVisibleBakery } from "../bakeries/bakeries.service.js";
import { ProductInput, ProductsQuery, ProductUpdate } from "./products.schemas.js";

// Mounted at /api/bakeries.
export const productsRouter = Router();

// Public, so the app can show a bakery's products before sign-in. Staff add ?all=true to see hidden ones.
productsRouter.get("/:bakeryId/products", optionalAuth, async (req, res) => {
  const { category, all } = ProductsQuery.parse(req.query);
  const includeHidden = all === "true";
  const bakery = await findVisibleBakery(req.params.bakeryId, req.user);
  if (includeHidden && !(await isMember(req.user, bakery.id))) throw forbidden();
  res.json(
    await prisma.product.findMany({
      where: { bakeryId: bakery.id, category, isActive: includeHidden ? undefined : true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
  );
});

productsRouter.get("/:bakeryId/products/:productId", optionalAuth, async (req, res) => {
  const bakery = await findVisibleBakery(req.params.bakeryId, req.user);
  const product = await prisma.product.findFirst({
    where: { id: req.params.productId, bakeryId: bakery.id, isActive: true },
  });
  if (!product) throw notFound("Product");
  res.json(product);
});

productsRouter.post("/:bakeryId/products", requireAuth, requireMember(), async (req, res) => {
  const data = ProductInput.parse(req.body);
  res.status(201).json(await prisma.product.create({ data: { ...data, bakeryId: req.params.bakeryId } }));
});

// Products are hidden rather than deleted, so past orders keep pointing at them.
productsRouter.patch("/:bakeryId/products/:productId", requireAuth, requireMember(), async (req, res) => {
  const data = ProductUpdate.parse(req.body);
  const existing = await prisma.product.findFirst({ where: { id: req.params.productId, bakeryId: req.params.bakeryId } });
  if (!existing) throw notFound("Product");
  res.json(await prisma.product.update({ where: { id: existing.id }, data }));
});
