import { FastifyInstance } from "fastify";
import { prisma } from "../lib/db.js";
import { StoreBuilderTriggerSchema } from "@app/shared";
import { resolveTenantId } from "../lib/tenant.js";
import { config } from "../lib/config.js";

export async function storeBuilderRoutes(app: FastifyInstance) {
  app.post("/api/store-builder/trigger", async (request, reply) => {
    const headerSecret =
      (request.headers["x-ghl-webhook-secret"] as string | undefined) ||
      (request.headers["x-webhook-secret"] as string | undefined) ||
      (request.headers["x-ghl-secret"] as string | undefined);
    const querySecret = (request.query as { secret?: string; webhook_secret?: string } | undefined)?.secret ??
      (request.query as { secret?: string; webhook_secret?: string } | undefined)?.webhook_secret;
    const providedSecret = headerSecret ?? querySecret;
    if (config.ghlWebhookSecret && providedSecret !== config.ghlWebhookSecret) {
      return reply.status(401).send({ ok: false, error: "invalid_webhook_secret" });
    }

    const parse = StoreBuilderTriggerSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ ok: false, error: parse.error.flatten() });
    }

    const { tenantId, locationId, storeName, clientName, brandVertical, metadata } = parse.data;
    let resolvedTenantId: string;
    try {
      resolvedTenantId = await resolveTenantId({ tenantId, locationId });
    } catch (error) {
      return reply.status(400).send({ ok: false, error: "location_not_linked" });
    }

    const store = await prisma.store.create({
      data: {
        tenantId: resolvedTenantId,
        name: storeName,
        status: "DRAFT",
        config: {
          clientName,
          brandVertical,
          metadata
        },
        ghlLocation: {
          connectOrCreate: {
            where: { locationId },
            create: { locationId }
          }
        }
      }
    });

    const catalog = await prisma.catalog.create({
      data: {
        tenantId,
        storeId: store.id,
        name: `${storeName} Starter Catalog`
      }
    });

    const suggestions = [
      { name: "Spirit T-Shirt", productType: "apparel" },
      { name: "Team Hoodie", productType: "apparel" },
      { name: "Baseball Cap", productType: "headwear" },
      { name: "Staff Polo", productType: "apparel" }
    ];

    for (const suggestion of suggestions) {
      const product = await prisma.product.create({
        data: {
          tenantId,
          name: suggestion.name,
          productType: suggestion.productType
        }
      });
      await prisma.catalogItem.create({
        data: {
          catalogId: catalog.id,
          productId: product.id
        }
      });
    }

    return reply.send({
      ok: true,
      storeId: store.id,
      catalogId: catalog.id
    });
  });
}
