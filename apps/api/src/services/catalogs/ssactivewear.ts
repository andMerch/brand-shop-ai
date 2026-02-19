import { prisma } from "../../lib/db.js";
import { config } from "../../lib/config.js";

type SsProduct = {
  productId?: string;
  styleID?: string;
  styleId?: string;
  title?: string;
  name?: string;
  styleName?: string;
  brandName?: string;
  casePrice?: number;
  customerPrice?: number;
  piecePrice?: number;
};

function resolveProductName(item: SsProduct) {
  return item.title || item.name || item.styleName || "SSActivewear Product";
}

function resolveExternalId(item: SsProduct) {
  return item.productId || item.styleID || item.styleId;
}

function resolveBaseCost(item: SsProduct) {
  const value = item.casePrice ?? item.customerPrice ?? item.piecePrice;
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  return 0;
}

export async function syncSsActivewearCatalog(input: {
  tenantId: string;
  storeId?: string;
  limit?: number;
}) {
  if (!config.ssactivewear.accountNumber || !config.ssactivewear.apiKey) {
    throw new Error("ssactivewear_credentials_missing");
  }

  const auth = Buffer.from(
    `${config.ssactivewear.accountNumber}:${config.ssactivewear.apiKey}`
  ).toString("base64");

  const url = new URL(`${config.ssactivewear.baseUrl}/products/`);
  if (input.limit) {
    url.searchParams.set("limit", String(input.limit));
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ssactivewear_request_failed:${response.status}:${body}`);
  }

  const data = (await response.json()) as unknown;
  const products: SsProduct[] = Array.isArray(data)
    ? (data as SsProduct[])
    : ((data as { products?: SsProduct[] }).products ?? []);

  const existingSupplier = await prisma.supplier.findFirst({
    where: { tenantId: input.tenantId, name: "SSActivewear" }
  });
  const supplier = existingSupplier
    ? existingSupplier
    : await prisma.supplier.create({
        data: {
          tenantId: input.tenantId,
          name: "SSActivewear",
          metadata: {}
        }
      });

  let catalogId: string | null = null;
  if (input.storeId) {
    const catalog = await prisma.catalog.findFirst({
      where: { storeId: input.storeId }
    });
    if (catalog) {
      catalogId = catalog.id;
    } else {
      const created = await prisma.catalog.create({
        data: {
          tenantId: input.tenantId,
          storeId: input.storeId,
          name: "SSActivewear Catalog"
        }
      });
      catalogId = created.id;
    }
  }

  const synced: string[] = [];
  for (const item of products) {
    const externalId = resolveExternalId(item);
    const name = resolveProductName(item);
    const baseCost = resolveBaseCost(item);

    const existing = externalId
      ? await prisma.product.findFirst({
          where: {
            tenantId: input.tenantId,
            supplierId: supplier.id,
            externalId
          }
        })
      : null;

    const product = existing
      ? await prisma.product.update({
          where: { id: existing.id },
          data: {
            name,
            price: baseCost,
            source: "SSACTIVEWEAR",
            metadata: item as unknown as Record<string, unknown>
          }
        })
      : await prisma.product.create({
          data: {
            tenantId: input.tenantId,
            supplierId: supplier.id,
            name,
            price: baseCost,
            source: "SSACTIVEWEAR",
            externalId: externalId ?? undefined,
            metadata: item as unknown as Record<string, unknown>
          }
        });

    if (catalogId) {
      const exists = await prisma.catalogItem.findFirst({
        where: { catalogId, productId: product.id }
      });
      if (!exists) {
        await prisma.catalogItem.create({
          data: {
            catalogId,
            productId: product.id
          }
        });
      }
    }

    synced.push(product.id);
  }

  return { synced, count: synced.length };
}
