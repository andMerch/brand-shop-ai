import { FastifyInstance } from "fastify";
import { PricingRuleBatchSchema, PricingRuleSchema } from "@app/shared";
import { prisma } from "../lib/db.js";

export async function pricingRulesRoutes(app: FastifyInstance) {
  app.get("/api/pricing-rules", async (request, reply) => {
    const tenantId = (request.query as { tenantId?: string } | undefined)?.tenantId;
    const rules = await prisma.pricingRule.findMany({
      where: tenantId ? { tenantId } : { tenantId: null },
      orderBy: [{ target: "asc" }, { createdAt: "desc" }]
    });
    return reply.send({ ok: true, rules });
  });

  app.post("/api/pricing-rules", async (request, reply) => {
    const parse = PricingRuleSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ ok: false, error: parse.error.flatten() });
    }

    const rule = await prisma.pricingRule.create({
      data: {
        tenantId: parse.data.tenantId ?? null,
        target: parse.data.target,
        targetValue: parse.data.targetValue,
        deltaType: parse.data.deltaType,
        deltaValue: parse.data.deltaValue
      }
    });

    return reply.send({ ok: true, rule });
  });

  app.post("/api/pricing-rules/batch", async (request, reply) => {
    const parse = PricingRuleBatchSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ ok: false, error: parse.error.flatten() });
    }

    const tenantId = parse.data.tenantId ?? null;

    await prisma.pricingRule.deleteMany({
      where: { tenantId }
    });

    const rules = await prisma.pricingRule.createMany({
      data: parse.data.rules.map((rule) => ({
        tenantId,
        target: rule.target,
        targetValue: rule.targetValue,
        deltaType: rule.deltaType,
        deltaValue: rule.deltaValue
      }))
    });

    return reply.send({ ok: true, count: rules.count });
  });

  app.delete("/api/pricing-rules/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.pricingRule.delete({ where: { id } });
    return reply.send({ ok: true });
  });
}
