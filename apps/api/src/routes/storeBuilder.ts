import { FastifyInstance } from "fastify";
import { prisma } from "../lib/db.js";
import { StoreBuilderTriggerSchema } from "@app/shared";
import { resolveTenantId } from "../lib/tenant.js";
import { config } from "../lib/config.js";
import { slugify } from "../lib/slug.js";
import { buildDefaultPricing } from "../services/pricing.js";

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

    const { tenantId, locationId, storeName, clientName, brandVertical, metadata, pricingModel } = parse.data;
    let resolvedTenantId: string;
    try {
      resolvedTenantId = await resolveTenantId({ tenantId, locationId });
    } catch (error) {
      return reply.status(400).send({ ok: false, error: "location_not_linked" });
    }

    const baseSlug = slugify(storeName || "store");
    let slug = baseSlug || `store-${Date.now()}`;
    let domain = `${slug}.${config.brandBaseDomain}`;
    let suffix = 1;
    while (await prisma.storefrontDomain.findFirst({ where: { domain } })) {
      slug = `${baseSlug}-${suffix++}`;
      domain = `${slug}.${config.brandBaseDomain}`;
    }

    const store = await prisma.store.create({
      data: {
        tenant: {
          connect: { id: resolvedTenantId }
        },
        name: storeName,
        status: "DRAFT",
        config: {
          clientName,
          brandVertical,
          metadata,
          storefront: {
            slug,
            primaryDomain: domain
          },
          pricing: buildDefaultPricing(pricingModel ?? "DISTRIBUTOR"),
          billing: {
            mode: "DISTRIBUTOR_COLLECTS",
            chargeTiming: "IMMEDIATE"
          }
        },
        ghlLocation: {
          connectOrCreate: {
            where: { locationId },
            create: { locationId }
          }
        }
      }
    });

    await prisma.storefrontDomain.create({
      data: {
        storeId: store.id,
        domain,
        type: "SUBDOMAIN",
        isPrimary: true
      }
    });

    const catalog = await prisma.catalog.create({
      data: {
        tenant: {
          connect: { id: resolvedTenantId }
        },
        store: {
          connect: { id: store.id }
        },
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
          tenant: {
            connect: { id: resolvedTenantId }
          },
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
