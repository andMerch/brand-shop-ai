import { FastifyInstance } from "fastify";
import { prisma } from "../lib/db.js";
import { StorefrontDomainSchema } from "@app/shared";
import { buildDefaultPricing, calculateItemPrice } from "../services/pricing.js";

export async function storefrontRoutes(app: FastifyInstance) {
  app.get("/api/storefront/resolve", async (request, reply) => {
    const host = (request.query as { host?: string } | undefined)?.host;
    if (!host) {
      return reply.status(400).send({ ok: false, error: "host_required" });
    }

    const domain = await prisma.storefrontDomain.findFirst({
      where: { domain: host },
      include: { store: true }
    });

    if (!domain) {
      return reply.status(404).send({ ok: false, error: "store_not_found" });
    }

    const config = (domain.store.config as Record<string, unknown> | null) ?? {};
    const pricing = (config.pricing as Record<string, unknown> | null) ?? buildDefaultPricing("DISTRIBUTOR");

    return reply.send({
      ok: true,
      store: {
        id: domain.store.id,
        name: domain.store.name,
        status: domain.store.status,
        config
      },
      domain: domain.domain,
      pricing
    });
  });

  app.get("/api/storefront/:storeId/catalog", async (request, reply) => {
    const { storeId } = request.params as { storeId: string };
    const locationCountRaw = (request.query as { locations?: string } | undefined)?.locations;
    const locationCount = Number(locationCountRaw ?? 1) || 1;

    const store = await prisma.store.findFirst({
      where: { id: storeId },
      include: {
        catalogs: {
          include: {
            items: {
              include: { product: true }
            }
          }
        }
      }
    });

    if (!store) {
      return reply.status(404).send({ ok: false, error: "store_not_found" });
    }

    const config = (store.config as Record<string, unknown> | null) ?? {};
    const pricing = (config.pricing as Record<string, unknown> | null) ?? buildDefaultPricing("DISTRIBUTOR");

    const catalogItems = store.catalogs.flatMap((catalog) =>
      catalog.items.map((item) => ({
        catalogId: catalog.id,
        product: item.product
      }))
    );

    const priced = catalogItems
      .filter((item) => item.product)
      .map((item) => {
        const product = item.product!;
        const baseCost = product.price ?? 0;
        const priceBreakdown = calculateItemPrice(pricing as any, {
          baseCost,
          decorationLocations: locationCount
        });
        return {
          id: product.id,
          name: product.name,
          productType: product.productType,
          supplierId: product.supplierId,
          baseCost,
          price: priceBreakdown.price,
          priceBreakdown
        };
      });

    return reply.send({ ok: true, storeId, items: priced });
  });

  app.post("/api/storefront/domains", async (request, reply) => {
    const parse = StorefrontDomainSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ ok: false, error: parse.error.flatten() });
    }

    const domain = await prisma.storefrontDomain.create({
      data: {
        storeId: parse.data.storeId,
        domain: parse.data.domain,
        type: parse.data.type,
        isPrimary: parse.data.isPrimary ?? false
      }
    });

    if (parse.data.isPrimary) {
      await prisma.storefrontDomain.updateMany({
        where: { storeId: parse.data.storeId, id: { not: domain.id } },
        data: { isPrimary: false }
      });

      const store = await prisma.store.findFirst({ where: { id: parse.data.storeId } });
      if (store) {
        const config = (store.config as Record<string, unknown> | null) ?? {};
        const storefront = (config.storefront as Record<string, unknown> | null) ?? {};
        await prisma.store.update({
          where: { id: store.id },
          data: {
            config: {
              ...config,
              storefront: {
                ...storefront,
                primaryDomain: parse.data.domain
              }
            }
          }
        });
      }
    }

    return reply.send({ ok: true, domain });
  });
}
