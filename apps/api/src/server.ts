import fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rawBody from "@fastify/raw-body";
import { config } from "./lib/config.js";
import { webhooksRoutes } from "./routes/webhooks.js";
import { storeBuilderRoutes } from "./routes/storeBuilder.js";
import { aiVisionRoutes } from "./routes/aiVision.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { routingRoutes } from "./routes/routing.js";
import { reputationRoutes } from "./routes/reputation.js";
import { integrationsRoutes } from "./routes/integrations.js";
import { ghlRoutes } from "./routes/ghl.js";

export function buildServer() {
  const app = fastify({ logger: true, bodyLimit: 25 * 1024 * 1024 });

  app.register(cors, {
    origin: true
  });

  app.register(rawBody, {
    field: "rawBody",
    global: true,
    encoding: "utf8",
    runFirst: true
  });

  app.register(multipart, {
    limits: {
      fileSize: 25 * 1024 * 1024
    }
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

  return app;
}
