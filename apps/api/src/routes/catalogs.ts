import { FastifyInstance } from "fastify";
import { CatalogSyncSchema } from "@app/shared";
import { syncSsActivewearCatalog } from "../services/catalogs/ssactivewear.js";
import { syncPrintfulCatalog } from "../services/catalogs/printful.js";

export async function catalogRoutes(app: FastifyInstance) {
  app.post("/api/catalogs/sync", async (request, reply) => {
    const parse = CatalogSyncSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ ok: false, error: parse.error.flatten() });
    }

    const { tenantId, storeId, source, limit } = parse.data;

    if (source === "ssactivewear") {
      const result = await syncSsActivewearCatalog({ tenantId, storeId, limit });
      return reply.send({ ok: true, source, result });
    }

    const result = await syncPrintfulCatalog({ tenantId, storeId, limit });
    return reply.send({ ok: true, source, result });
  });
}
