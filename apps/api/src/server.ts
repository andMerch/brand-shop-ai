import fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { config } from "./lib/config.js";
import { prisma } from "./lib/db.js";
import { webhooksRoutes } from "./routes/webhooks.js";
import { storeBuilderRoutes } from "./routes/storeBuilder.js";
import { aiVisionRoutes } from "./routes/aiVision.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { routingRoutes } from "./routes/routing.js";
import { reputationRoutes } from "./routes/reputation.js";
import { integrationsRoutes } from "./routes/integrations.js";
import { ghlRoutes } from "./routes/ghl.js";
import { catalogRoutes } from "./routes/catalogs.js";
import { storefrontRoutes } from "./routes/storefront.js";
import { storesRoutes } from "./routes/stores.js";

export function buildServer() {
  const app = fastify({ logger: true, bodyLimit: 25 * 1024 * 1024 });

  app.register(cors, {
    origin: true
  });

  app.register(multipart, {
    limits: {
      fileSize: 25 * 1024 * 1024
    }
  });

  app.get("/internal/caddy-ask", async (request, reply) => {
    const host =
      (request.query as { domain?: string; host?: string } | undefined)?.domain ??
      (request.query as { domain?: string; host?: string } | undefined)?.host;
    if (!host) {
      return reply.status(400).send("missing_domain");
    }

    const baseDomain = config.brandBaseDomain;
    if (host === `app.${baseDomain}` || host === `api.${baseDomain}`) {
      return reply.send("ok");
    }
    if (host.endsWith(`.${baseDomain}`)) {
      return reply.send("ok");
    }

    const existing = await prisma.storefrontDomain.findFirst({
      where: { domain: host }
    });
    if (existing) {
      return reply.send("ok");
    }

    return reply.status(403).send("forbidden");
  });

  app.get("/health", async () => ({ ok: true }));

  app.register(webhooksRoutes);
  app.register(storeBuilderRoutes);
  app.register(aiVisionRoutes);
  app.register(dashboardRoutes);
  app.register(routingRoutes);
  app.register(reputationRoutes);
  app.register(integrationsRoutes);
  app.register(ghlRoutes);
  app.register(catalogRoutes);
  app.register(storefrontRoutes);
  app.register(storesRoutes);

  return app;
}
