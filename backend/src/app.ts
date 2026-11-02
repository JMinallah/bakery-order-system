import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { bakeriesRouter } from "./modules/bakeries/bakeries.routes.js";
import { builderRouter } from "./modules/builder/builder.routes.js";
import { bakeryOrdersRouter, ordersRouter } from "./modules/orders/orders.routes.js";
import { productsRouter } from "./modules/products/products.routes.js";
import { stockRouter } from "./modules/stock/stock.routes.js";
import { uploadsRouter } from "./modules/uploads/uploads.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { bakeryApplicationsRouter } from "./modules/bakery-applications/bakery-applications.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { aiRouter } from "./modules/ai/ai.routes.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => env.NODE_ENV === "test",
  });
  // The application form needs no account, so it gets a much tighter limit against spam.
  const applicationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Only the public form itself; admins approving applications are signed in and not limited here.
    skip: (req) => env.NODE_ENV === "test" || req.method !== "POST" || req.path !== "/",
    message: { error: "Too many applications from this connection. Please try again in an hour" },
  });

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS.split(",").map((o) => o.trim()) }));
  app.use(express.json({ limit: "1mb" }));
  if (env.NODE_ENV !== "test") app.use(morgan("dev"));
  app.use("/api", apiLimiter);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/users", usersRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/bakery-applications", applicationLimiter, bakeryApplicationsRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/uploads", uploadsRouter);
  app.use("/api/ai", aiRouter);
  // Everything that belongs to one bakery lives under /api/bakeries/:bakeryId.
  app.use("/api/bakeries", productsRouter, builderRouter, stockRouter, bakeryOrdersRouter, bakeriesRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  app.use(errorHandler);

  return app;
}
