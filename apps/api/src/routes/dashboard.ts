import { FastifyInstance } from "fastify";
import { computeDashboardSummary } from "../services/analytics.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/api/dashboard/summary", async (request, reply) => {
    const tenantId = (request.query as { tenantId?: string }).tenantId;
    if (!tenantId) {
      return reply.status(400).send({ ok: false, error: "tenantId_required" });
    }

    const summary = await computeDashboardSummary(tenantId);
    return reply.send({ ok: true, summary });
  });
}
