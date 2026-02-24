import { FastifyInstance } from "fastify";
import { prisma } from "../lib/db.js";
import { StorefrontCheckoutSchema, StorefrontDomainSchema } from "@app/shared";
import { buildDefaultPricing, calculateItemPrice } from "../services/pricing.js";

function calculateOrderTotals(pricing: any, subtotal: number) {
  const fees = pricing.checkoutFees ?? {};
  const shipping = Number(fees.shipping ?? 0);
  const platformFee = Number(fees.platformFee ?? 0);
  const fulfillmentDecorator = Number(fees.fulfillmentFeeDecorator ?? 0);
  const fulfillmentPlatform = Number(fees.fulfillmentFeePlatform ?? 0);
  const orderFee = Number(fees.orderFee ?? 0);
  const transactionFeeRate = Number(fees.transactionFeeRate ?? 0);
  const taxRate = Number(fees.taxRate ?? 0);
  const ccRate = Number(fees.ccRate ?? 0);

  const transactionFee = subtotal * transactionFeeRate;
  const taxableBase = subtotal + shipping;
  const tax = taxableBase * taxRate;
  const ccFee = (subtotal + shipping + tax) * ccRate;

  const total =
    subtotal +
    shipping +
    platformFee +
    fulfillmentDecorator +
    fulfillmentPlatform +
    orderFee +
    transactionFee +
    tax +
    ccFee;

  return {
    subtotal,
    shipping,
    platformFee,
    fulfillmentDecorator,
    fulfillmentPlatform,
    orderFee,
    transactionFee,
    tax,
    ccFee,
    total
  };
}

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

  app.post("/api/storefront/checkout", async (request, reply) => {
    const parse = StorefrontCheckoutSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ ok: false, error: parse.error.flatten() });
    }

    const { storeId, items, decorationLocations } = parse.data;
    const store = await prisma.store.findFirst({ where: { id: storeId } });
    if (!store) {
      return reply.status(404).send({ ok: false, error: "store_not_found" });
    }

    const config = (store.config as Record<string, unknown> | null) ?? {};
    const pricing = (config.pricing as Record<string, unknown> | null) ?? buildDefaultPricing("DISTRIBUTOR");
    const locationCount = Math.max(decorationLocations ?? 1, 1);

    const productIds = items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId: store.tenantId }
    });
    const productMap = new Map(products.map((product) => [product.id, product]));

    for (const item of items) {
      if (!productMap.has(item.productId)) {
        return reply
          .status(400)
          .send({ ok: false, error: "product_not_found", productId: item.productId });
      }
    }

    const lineItems = items.map((item) => {
      const product = productMap.get(item.productId)!;
      const baseCost = product.price ?? 0;
      const priceBreakdown = calculateItemPrice(pricing as any, {
        baseCost,
        decorationLocations: locationCount
      });
      return {
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: priceBreakdown.price
      };
    });

    const subtotal = lineItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );
    const totals = calculateOrderTotals(pricing as any, subtotal);

    const order = await prisma.order.create({
      data: {
        tenantId: store.tenantId,
        storeId: store.id,
        status: "NEW",
        total: totals.total,
        currency: "USD",
        items: {
          create: lineItems
        }
      }
    });

    return reply.send({
      ok: true,
      orderId: order.id,
      total: totals.total,
      currency: order.currency,
      breakdown: totals
    });
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
