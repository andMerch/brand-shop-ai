import { FastifyInstance } from "fastify";
import { prisma } from "../lib/db.js";
import { PricingConfigUpsertSchema } from "@app/shared";

export async function pricingConfigRoutes(app: FastifyInstance) {
  app.get("/api/pricing-config", async (request, reply) => {
    const query = request.query as { scope?: string; scopeId?: string } | undefined;
    const scope = query?.scope;
    if (!scope) {
      return reply.status(400).send({ ok: false, error: "scope_required" });
    }

    const config = await prisma.pricingConfig.findFirst({
      where: {
        scope: scope as any,
        scopeId: query?.scopeId ?? null
      }
    });

    return reply.send({ ok: true, config: config?.config ?? null });
  });

  app.post("/api/pricing-config", async (request, reply) => {
    const parse = PricingConfigUpsertSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ ok: false, error: parse.error.flatten() });
    }

    const { scope, scopeId, config } = parse.data;
    if (scope !== "GLOBAL" && !scopeId) {
      return reply.status(400).send({ ok: false, error: "scope_id_required" });
    }

    const existing = await prisma.pricingConfig.findFirst({
      where: { scope, scopeId: scopeId ?? null }
    });

    const record = existing
      ? await prisma.pricingConfig.update({
          where: { id: existing.id },
          data: { config }
        })
      : await prisma.pricingConfig.create({
          data: { scope, scopeId: scopeId ?? null, config }
        });

    return reply.send({ ok: true, pricingConfigId: record.id });
  });
}
