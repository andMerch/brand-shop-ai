import { FastifyInstance } from "fastify";
import { prisma } from "../lib/db.js";
import { routeOrder } from "../services/routing.js";
import { RoutingRuleSchema, RouteOrderSchema } from "@app/shared";

export async function routingRoutes(app: FastifyInstance) {
  app.post("/api/routing/rules", async (request, reply) => {
    const parse = RoutingRuleSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ ok: false, error: parse.error.flatten() });
    }

    const rule = await prisma.routingRule.create({
      data: {
        tenantId: parse.data.tenantId,
        priority: parse.data.priority ?? 0,
        productType: parse.data.productType,
        supplierId: parse.data.supplierId,
        decorationMethod: parse.data.decorationMethod,
        decoratorId: parse.data.decoratorId
      }
    });

    return reply.send({ ok: true, rule });
  });

  app.post("/api/routing/route", async (request, reply) => {
    const parse = RouteOrderSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ ok: false, error: parse.error.flatten() });
    }

    const result = await routeOrder({
      tenantId: parse.data.tenantId,
      orderId: parse.data.orderId,
      order: parse.data.order
    });

    return reply.send({ ok: true, result });
  });
}
