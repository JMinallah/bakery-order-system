import { Router } from "express";
import { requireMember } from "../../lib/access.js";
import { optionalAuth, requireAuth } from "../../middleware/auth.js";
import { findVisibleBakery } from "../bakeries/bakeries.service.js";
import { BuilderQuery, OptionGroupInput, OptionGroupUpdate, OptionInput, OptionUpdate } from "./builder.schemas.js";
import * as builder from "./builder.service.js";

// Mounted at /api/bakeries.
export const builderRouter = Router();

// Public: what the app's cake builder offers.
builderRouter.get("/:bakeryId/builder", optionalAuth, async (req, res) => {
  const { category } = BuilderQuery.parse(req.query);
  const bakery = await findVisibleBakery(req.params.bakeryId, req.user);
  res.json(await builder.customerBuilder(bakery.id, category));
});

builderRouter.get("/:bakeryId/option-groups", requireAuth, requireMember(), async (req, res) => {
  const { category } = BuilderQuery.parse(req.query);
  res.json(await builder.staffBuilder(req.params.bakeryId, category));
});

builderRouter.post("/:bakeryId/option-groups", requireAuth, requireMember(), async (req, res) => {
  res.status(201).json(await builder.createGroup(req.params.bakeryId, OptionGroupInput.parse(req.body)));
});

builderRouter.patch("/:bakeryId/option-groups/:groupId", requireAuth, requireMember(), async (req, res) => {
  res.json(await builder.updateGroup(req.params.bakeryId, req.params.groupId, OptionGroupUpdate.parse(req.body)));
});

builderRouter.post("/:bakeryId/option-groups/:groupId/options", requireAuth, requireMember(), async (req, res) => {
  const data = OptionInput.parse(req.body);
  res.status(201).json(await builder.createOption(req.params.bakeryId, req.params.groupId, data));
});

builderRouter.patch("/:bakeryId/options/:optionId", requireAuth, requireMember(), async (req, res) => {
  res.json(await builder.updateOption(req.params.bakeryId, req.params.optionId, OptionUpdate.parse(req.body)));
});

builderRouter.delete("/:bakeryId/option-groups/:groupId", requireAuth, requireMember(), async (req, res) => {
  await builder.deleteGroup(req.params.bakeryId, req.params.groupId);
  res.status(204).end();
});

builderRouter.delete("/:bakeryId/options/:optionId", requireAuth, requireMember(), async (req, res) => {
  await builder.deleteOption(req.params.bakeryId, req.params.optionId);
  res.status(204).end();
});
