import express, { type Express } from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./_core/oauth";
import { publicPlatformScript } from "./_core/publicConfig";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { createPortfolioRouter } from "./api/routes";
import { apiErrorHandler } from "./api/middleware";

/** Register every API before the Vite/static SPA catch-all. Does not listen. */
export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  // Manus uses one trusted reverse proxy hop. Do not use trust proxy=true,
  // which would allow arbitrary client-controlled forwarding chains.
  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      frameguard: false,
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60 * 1000,
      limit: 240,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: "Too many requests. Please wait a moment before trying again.",
      },
    })
  );
  app.use(express.json({ limit: "32kb", strict: true }));
  app.use(express.urlencoded({ limit: "32kb", extended: false }));
  app.get("/api/platform/config.js", (_req, res) => {
    res
      .set("Cache-Control", "no-store")
      .type("application/javascript")
      .send(publicPlatformScript());
  });
  registerOAuthRoutes(app);
  app.use("/api", createPortfolioRouter());
  // Preserve the starter OAuth/account integration. Portfolio administration is REST.
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext })
  );
  // Deliberately no permissive CORS: cross-origin custom-header requests cannot
  // pass browser preflight. State-changing admin requests require that header.
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "This API endpoint could not be found." })
  );
  app.use(apiErrorHandler);
  return app;
}
