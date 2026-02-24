import { FastifyInstance } from "fastify";
import { prisma } from "../lib/db.js";
import { StorefrontCheckoutSchema, StorefrontDomainSchema } from "@app/shared";
import { buildDefaultPricing, applyPricingRules, PricingRule } from "../services/pricing.js";

function mergeDeep<T extends Record<string, any>>(...sources: Array<T | null | undefined>) {
  const result: Record<string, any> = {};
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    for (const [key, value] of Object.entries(source)) {
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        typeof result[key] === "object" &&
        !Array.isArray(result[key])
      ) {
        result[key] = mergeDeep(result[key], value);
      } else if (value !== undefined) {
        result[key] = value;
      }
    }
  }
  return result as T;
}

async function resolvePricingConfig(params: { storeId?: string; tenantId?: string; storeConfig?: any }) {
  const base = buildDefaultPricing("DISTRIBUTOR");
  const globalConfig = await prisma.pricingConfig.findFirst({
    where: { scope: "GLOBAL" }
  });
  const tenantConfig = params.tenantId
    ? await prisma.pricingConfig.findFirst({
        where: { scope: "TENANT", scopeId: params.tenantId }
      })
    : null;
  const storeConfig = params.storeId
    ? await prisma.pricingConfig.findFirst({
        where: { scope: "STORE", scopeId: params.storeId }
      })
    : null;
  const embedded = params.storeConfig?.pricing ?? null;
  return mergeDeep(base as any, globalConfig?.config as any, tenantConfig?.config as any, storeConfig?.config as any, embedded as any);
}

function calculateOrderTotals(pricing: any, subtotal: number) {
  const fees = pricing.checkoutFees ?? {};
  const shipping = Number(fees.shipping ?? 0);
  const platformFeeFixed = Number(fees.platformFee ?? 0);
  const fulfillmentDecorator = Number(fees.fulfillmentFeeDecorator ?? 0);
  const fulfillmentPlatform = Number(fees.fulfillmentFeePlatform ?? 0);
  const orderFee = Number(fees.orderFee ?? 0);
  const platformFeeRate = Number(
    fees.platformFeeRate ?? fees.transactionFeeRate ?? 0
  );
  const taxRate = Number(fees.taxRate ?? 0);
  const ccRate = Number(fees.ccRate ?? 0);

  const fixedFees =
    platformFeeFixed + fulfillmentDecorator + fulfillmentPlatform + orderFee;
  const platformFeeRateAmount = (subtotal + fixedFees) * platformFeeRate;
  const taxableBase = subtotal + shipping;
  const tax = taxableBase * taxRate;
  const ccFee = (subtotal + shipping + tax) * ccRate;
  const platformFees = fixedFees + platformFeeRateAmount + ccFee;

  const total = subtotal + shipping + tax + platformFees;

  return {
    subtotal,
    shipping,
    platformFees,
    fulfillmentDecorator,
    fulfillmentPlatform,
    orderFee,
    tax,
    ccFee,
    platformFeeRate,
    platformFeeFixed,
    platformFeeRateAmount,
    total
  };
}

function computeVariantPricing(params: {
  product: {
    id: string;
    category?: string | null;
    price?: number | null;
    imageUrl?: string | null;
  };
  variant?: {
    id: string;
    sku?: string | null;
    size?: string | null;
    color?: string | null;
    imageUrl?: string | null;
    baseCost?: number | null;
  } | null;
  pricing: any;
  brandShopRules: PricingRule[];
  distributorRules: PricingRule[];
  locationCount: number;
}) {
  const { product, variant, pricing, brandShopRules, distributorRules, locationCount } = params;
  const baseCost = variant?.baseCost ?? product.price ?? 0;
  const decorationBase = pricing.decoration.baseFee * locationCount;
  const decorationMarkup = pricing.decoration.markupFixed * locationCount;
  const decorationTotal = decorationBase + decorationMarkup;

  const context = {
    productId: product.id,
    category: product.category ?? undefined,
    variantId: variant?.id ?? undefined,
    size: variant?.size ?? undefined,
    color: variant?.color ?? undefined
  };

  const brandShopAdjust = applyPricingRules({
    baseCost,
    decorationBase,
    decorationTotal,
    config: pricing as any,
    rules: brandShopRules,
    context,
    defaultPercent: 0
  });

  const brandShopPrice =
    baseCost +
    decorationTotal +
    brandShopAdjust.percentAmount +
    brandShopAdjust.fixedTotal;

  const distributorAdjust = applyPricingRules({
    baseCost: brandShopPrice,
    decorationBase: 0,
    decorationTotal: 0,
    config: pricing as any,
    rules: distributorRules,
    context,
    defaultPercent: pricing.distributorMarkupPercent ?? 0,
    percentBaseOverride: brandShopPrice
  });

  const distributorPrice =
    brandShopPrice +
    (brandShopPrice * distributorAdjust.percentTotal) / 100 +
    distributorAdjust.fixedTotal;

  return {
    baseCost,
    brandShopPrice,
    price: Math.max(brandShopPrice, distributorPrice)
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
    const pricing = await resolvePricingConfig({
      storeId: domain.store.id,
      tenantId: domain.store.tenantId,
      storeConfig: config
    });

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
              include: { product: { include: { variants: true } } }
            }
          }
        }
      }
    });

    if (!store) {
      return reply.status(404).send({ ok: false, error: "store_not_found" });
    }

    const config = (store.config as Record<string, unknown> | null) ?? {};
    const pricing = await resolvePricingConfig({
      storeId: store.id,
      tenantId: store.tenantId,
      storeConfig: config
    });

    const catalogItems = store.catalogs.flatMap((catalog) =>
      catalog.items.map((item) => ({
        catalogId: catalog.id,
        product: item.product
      }))
    );

    const brandShopRules = (await prisma.pricingRule.findMany({
      where: { tenantId: null }
    })) as unknown as PricingRule[];
    const distributorRules = (await prisma.pricingRule.findMany({
      where: { tenantId: store.tenantId }
    })) as unknown as PricingRule[];

    const priced = catalogItems
      .filter((item) => item.product)
      .map((item) => {
        const product = item.product!;
        const variantList = (product.variants ?? []).map((variant) => {
          const pricingResult = computeVariantPricing({
            product,
            variant,
            pricing,
            brandShopRules,
            distributorRules,
            locationCount
          });

          return {
            id: variant.id,
            sku: variant.sku,
            size: variant.size,
            color: variant.color,
            imageUrl: variant.imageUrl ?? product.imageUrl,
            baseCost: pricingResult.baseCost,
            brandShopPrice: pricingResult.brandShopPrice,
            price: pricingResult.price
          };
        });

        const fallbackPricing = computeVariantPricing({
          product,
          variant: null,
          pricing,
          brandShopRules,
          distributorRules,
          locationCount
        });

        const defaultVariant = variantList[0];

        return {
          id: product.id,
          name: product.name,
          brand: product.brand,
          description: product.description,
          category: product.category,
          imageUrl: product.imageUrl,
          productType: product.productType,
          supplierId: product.supplierId,
          baseCost: defaultVariant?.baseCost ?? fallbackPricing.baseCost,
          price: defaultVariant?.price ?? fallbackPricing.price,
          variants: variantList
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
    const pricing = await resolvePricingConfig({
      storeId: store.id,
      tenantId: store.tenantId,
      storeConfig: config
    });
    const locationCount = Math.max(decorationLocations ?? 1, 1);

    const productIds = items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId: store.tenantId },
      include: { variants: true }
    });
    const productMap = new Map(products.map((product) => [product.id, product]));

    for (const item of items) {
      if (!productMap.has(item.productId)) {
        return reply
          .status(400)
          .send({ ok: false, error: "product_not_found", productId: item.productId });
      }
    }

    const brandShopRules = (await prisma.pricingRule.findMany({
      where: { tenantId: null }
    })) as unknown as PricingRule[];
    const distributorRules = (await prisma.pricingRule.findMany({
      where: { tenantId: store.tenantId }
    })) as unknown as PricingRule[];

    const lineItems = items.map((item) => {
      const product = productMap.get(item.productId)!;
      const variant = item.variantId
        ? product.variants.find((entry) => entry.id === item.variantId)
        : product.variants[0];
      const pricingResult = computeVariantPricing({
        product,
        variant: variant ?? null,
        pricing,
        brandShopRules,
        distributorRules,
        locationCount
      });
      return {
        productId: product.id,
        variantId: variant?.id ?? null,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: pricingResult.price,
        metadata: {
          size: variant?.size,
          color: variant?.color,
          sku: variant?.sku,
          imageUrl: variant?.imageUrl ?? product.imageUrl
        }
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
