import { FastifyInstance } from "fastify";
import { prisma } from "../lib/db.js";
import { PricingConfigSchema } from "@app/shared";

export async function storesRoutes(app: FastifyInstance) {
  app.get("/api/stores/:storeId", async (request, reply) => {
    const { storeId } = request.params as { storeId: string };
    const store = await prisma.store.findFirst({ where: { id: storeId } });
    if (!store) {
      return reply.status(404).send({ ok: false, error: "store_not_found" });
    }
    return reply.send({ ok: true, store });
  });

  app.patch("/api/stores/:storeId/pricing", async (request, reply) => {
    const { storeId } = request.params as { storeId: string };
    const parse = PricingConfigSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ ok: false, error: parse.error.flatten() });
    }

    const store = await prisma.store.findFirst({ where: { id: storeId } });
    if (!store) {
      return reply.status(404).send({ ok: false, error: "store_not_found" });
    }

    const config = (store.config as Record<string, unknown> | null) ?? {};
    await prisma.store.update({
      where: { id: store.id },
      data: {
        config: {
          ...config,
          pricing: parse.data
        }
      }
    });

    return reply.send({ ok: true });
  });

  app.patch("/api/stores/:storeId/billing", async (request, reply) => {
    const { storeId } = request.params as { storeId: string };
    const body = request.body as { mode?: string; chargeTiming?: string } | undefined;

    const store = await prisma.store.findFirst({ where: { id: storeId } });
    if (!store) {
      return reply.status(404).send({ ok: false, error: "store_not_found" });
    }

    const config = (store.config as Record<string, unknown> | null) ?? {};
    const billing = {
      ...(config.billing as Record<string, unknown> | null),
      ...(body ?? {})
    };

    await prisma.store.update({
      where: { id: store.id },
      data: {
        config: {
          ...config,
          billing
        }
      }
    });

    return reply.send({ ok: true });
  });
}
